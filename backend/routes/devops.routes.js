import { Router } from 'express';
import crypto from 'crypto';
import Project from '../models/Project.model.js';
import { Deployment, Notification } from '../models/Misc.models.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();

const ENVS = ['Development', 'Testing', 'Production'];
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const HOOK_HOSTS = ['api.render.com', 'api.vercel.com', 'api.netlify.com'];

/* ------------------------------ helpers ------------------------------ */

// Only https, no localhost / private names / raw IPs (basic SSRF guard).
const isSafeUrl = (raw, allowedHosts) => {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return false;
    if (allowedHosts && !allowedHosts.some((a) => h === a || h.endsWith(`.${a}`))) return false;
    return true;
  } catch {
    return false;
  }
};

const ghHeaders = () => ({
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const envFromBranch = (b = '') => {
  if (/^(main|master|prod|production|release.*)$/i.test(b)) return 'Production';
  if (/^(dev|develop|development)$/i.test(b)) return 'Development';
  return 'Testing';
};

// In-app alert for everyone on the project when a deployment fails
const notifyFailure = async (project, deployment) => {
  try {
    const ids = [...new Set([project.owner, ...project.members.map((m) => m.user)].map(String))];
    await Notification.insertMany(
      ids.map((id) => ({
        recipient: id,
        type: 'deployment',
        message: `Deployment failed on ${deployment.environment} (${deployment.branch})`,
        link: `/dashboard/projects/${project._id}/devops`,
      }))
    );
  } catch {
    /* best effort */
  }
};

/* ------------------- GitHub webhook (no login, HMAC signed) ------------------- */
// Add in GitHub: Settings -> Webhooks -> Payload URL = <backend>/api/devops/<projectId>/webhook
// Content type: application/json, secret = GITHUB_WEBHOOK_SECRET, event: "Workflow runs".
router.post('/:projectId/webhook', async (req, res) => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: 'GITHUB_WEBHOOK_SECRET not configured on the server' });

    const sig = String(req.headers['x-hub-signature-256'] || '');
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    if (event === 'ping') return res.json({ message: 'pong' });
    if (event !== 'workflow_run' || req.body.action !== 'completed') return res.json({ ignored: event });

    const run = req.body.workflow_run;
    const project = await Project.findById(req.params.projectId);
    if (!project || !project.githubRepo || project.githubRepo.toLowerCase() !== String(req.body.repository?.full_name || '').toLowerCase()) {
      return res.status(404).json({ message: 'Project/repository mismatch' });
    }

    let status = null;
    if (run.conclusion === 'success') status = 'success';
    else if (['failure', 'timed_out', 'startup_failure'].includes(run.conclusion)) status = 'failed';
    if (!status) return res.json({ ignored: `conclusion:${run.conclusion}` });

    const durationSeconds = Math.max(0, Math.round((new Date(run.updated_at) - new Date(run.run_started_at)) / 1000)) || 0;

    const deployment = await Deployment.findOneAndUpdate(
      { project: project._id, runId: String(run.id) },
      {
        $set: {
          environment: envFromBranch(run.head_branch),
          status,
          commitSha: run.head_sha || '',
          branch: run.head_branch || 'main',
          durationSeconds,
          logs: `${run.name} - ${run.html_url}`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    req.app.get('io')?.to(`project:${project._id}`).emit('deployment:new', deployment);
    if (status === 'failed') await notifyFailure(project, deployment);
    res.json({ recorded: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* --------------------------- everything below needs login --------------------------- */
router.use(protect);

// Connect a GitHub repo to the project
router.put('/:projectId/repo', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    // Accept a full GitHub URL or plain "owner/repo"
    const repoInput = (req.body.githubRepo || '')
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');

    if (repoInput && !REPO_RE.test(repoInput)) {
      return res.status(400).json({ message: 'Repository must look like owner/repo' });
    }
    req.project.githubRepo = repoInput;
    await req.project.save();
    res.json({ project: req.project });
  } catch (err) {
    next(err);
  }
});

// Setup status + live URL + deploy hook (hook itself is never returned)
router.get('/:projectId/config', requireProjectRole([]), async (req, res, next) => {
  try {
    const p = await Project.findById(req.project._id).select('+deployHookUrl');
    res.json({
      liveUrl: p.liveUrl || '',
      hasDeployHook: !!p.deployHookUrl,
      tokenConfigured: !!process.env.GITHUB_TOKEN,
      webhookSecretConfigured: !!process.env.GITHUB_WEBHOOK_SECRET,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:projectId/config', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    const update = {};
    const { liveUrl, deployHookUrl } = req.body;

    if (liveUrl !== undefined) {
      const v = String(liveUrl).trim();
      if (v && !isSafeUrl(v)) return res.status(400).json({ message: 'Live URL must be a public https:// address' });
      update.liveUrl = v;
    }
    if (deployHookUrl !== undefined) {
      const v = String(deployHookUrl).trim();
      if (v && !isSafeUrl(v, HOOK_HOSTS)) {
        return res.status(400).json({ message: 'Deploy hook must be an https URL on api.render.com, api.vercel.com or api.netlify.com' });
      }
      update.deployHookUrl = v;
    }
    await Project.findByIdAndUpdate(req.project._id, update);
    res.json({ message: 'Saved' });
  } catch (err) {
    next(err);
  }
});

/**
 * CI/CD pipeline status + build history, sourced from GitHub Actions.
 * Requires GITHUB_TOKEN in .env with `repo` + `actions:read` scope.
 */
router.get('/:projectId/pipeline', requireProjectRole([]), async (req, res, next) => {
  try {
    if (!req.project.githubRepo) return res.json({ connected: false, runs: [] });
    if (!process.env.GITHUB_TOKEN) {
      return res.status(503).json({ message: 'GITHUB_TOKEN not configured on the server' });
    }
    const resp = await fetch(`https://api.github.com/repos/${req.project.githubRepo}/actions/runs?per_page=15`, {
      headers: ghHeaders(),
    });
    if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
    const data = await resp.json();
    const runs = (data.workflow_runs || []).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status, // queued | in_progress | completed
      conclusion: r.conclusion, // success | failure | cancelled | null
      branch: r.head_branch,
      commit: r.head_sha?.slice(0, 7),
      actor: r.actor?.login,
      startedAt: r.run_started_at,
      durationSeconds:
        r.status === 'completed' && r.run_started_at
          ? Math.max(0, Math.round((new Date(r.updated_at) - new Date(r.run_started_at)) / 1000))
          : null,
      url: r.html_url,
    }));
    res.json({ connected: true, runs });
  } catch (err) {
    next(err);
  }
});

// Recent commits + open pull requests
router.get('/:projectId/repo-activity', requireProjectRole([]), async (req, res, next) => {
  try {
    const repo = req.project.githubRepo;
    if (!repo) return res.json({ connected: false, commits: [], pulls: [] });

    const [cRes, pRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=8`, { headers: ghHeaders() }),
      fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=8`, { headers: ghHeaders() }),
    ]);
    if (!cRes.ok) throw new Error(`GitHub API error: ${cRes.status}`);
    const commitsRaw = await cRes.json();
    const pullsRaw = pRes.ok ? await pRes.json() : [];

    res.json({
      connected: true,
      commits: commitsRaw.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: (c.commit?.message || '').split('\n')[0],
        author: c.author?.login || c.commit?.author?.name,
        date: c.commit?.author?.date,
        url: c.html_url,
      })),
      pulls: pullsRaw.map((p) => ({
        number: p.number,
        title: p.title,
        author: p.user?.login,
        draft: p.draft,
        createdAt: p.created_at,
        url: p.html_url,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// DORA-style delivery metrics for the last 30 days
router.get('/:projectId/summary', requireProjectRole([]), async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000);
    const deps = await Deployment.find({ project: req.project._id, createdAt: { $gte: since } }).sort('createdAt');
    const finished = deps.filter((d) => ['success', 'failed'].includes(d.status));
    const ok = finished.filter((d) => d.status === 'success').length;

    const durations = finished.map((d) => d.durationSeconds).filter((n) => n > 0);
    const avgDurationSeconds = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    // Mean time to recover: first failure in an environment -> next success there
    const open = {};
    const recoveries = [];
    for (const d of finished) {
      if (d.status === 'failed') {
        if (!open[d.environment]) open[d.environment] = d.createdAt;
      } else if (open[d.environment]) {
        recoveries.push(d.createdAt - open[d.environment]);
        delete open[d.environment];
      }
    }
    const mttrMinutes = recoveries.length
      ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length / 60000)
      : null;

    // last 14 days, per-day counts
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({ date: key, success: 0, failed: 0 });
    }
    for (const d of finished) {
      const row = days.find((x) => x.date === d.createdAt.toISOString().slice(0, 10));
      if (row) row[d.status === 'success' ? 'success' : 'failed'] += 1;
    }

    const lastProd = await Deployment.findOne({ project: req.project._id, environment: 'Production', status: 'success' })
      .sort('-createdAt')
      .populate('triggeredBy', 'name');

    res.json({
      total: deps.length,
      perWeek: Math.round((deps.length / (30 / 7)) * 10) / 10,
      successRate: finished.length ? Math.round((ok / finished.length) * 100) : null,
      changeFailureRate: finished.length ? Math.round(((finished.length - ok) / finished.length) * 100) : null,
      avgDurationSeconds,
      mttrMinutes,
      days,
      lastProduction: lastProd
        ? { at: lastProd.createdAt, branch: lastProd.branch, commit: lastProd.commitSha?.slice(0, 7), by: lastProd.triggeredBy?.name }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// Is the deployed app up? (checked from the server)
router.get('/:projectId/health', requireProjectRole([]), async (req, res) => {
  const url = req.project.liveUrl;
  if (!url) return res.json({ configured: false });
  if (!isSafeUrl(url)) return res.json({ configured: true, url, up: false, error: 'Unsafe URL' });

  const started = Date.now();
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    res.json({ configured: true, url, up: r.status < 500, statusCode: r.status, responseMs: Date.now() - started, checkedAt: new Date() });
  } catch (err) {
    res.json({ configured: true, url, up: false, error: err.name === 'TimeoutError' ? 'Timed out after 10s' : 'Unreachable', responseMs: Date.now() - started, checkedAt: new Date() });
  }
});

// Trigger a real deploy through the project's Render/Vercel/Netlify hook
router.post('/:projectId/deploy', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const p = await Project.findById(req.project._id).select('+deployHookUrl');
    if (!p.deployHookUrl) return res.status(400).json({ message: 'No deploy hook configured for this project' });

    const environment = ENVS.includes(req.body.environment) ? req.body.environment : 'Production';
    let hookOk = false;
    let note = '';
    try {
      const r = await fetch(p.deployHookUrl, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000) });
      hookOk = r.status < 400;
      note = hookOk ? 'Deploy hook triggered' : `Deploy hook returned ${r.status}`;
    } catch {
      note = 'Deploy hook unreachable';
    }

    const deployment = await Deployment.create({
      project: p._id,
      environment,
      status: hookOk ? 'queued' : 'failed',
      branch: String(req.body.branch || 'main').slice(0, 100),
      triggeredBy: req.user._id,
      logs: note,
    });
    req.app.get('io')?.to(`project:${p._id}`).emit('deployment:new', deployment);
    if (!hookOk) await notifyFailure(p, deployment);
    res.status(hookOk ? 201 : 502).json({ deployment, message: note });
  } catch (err) {
    next(err);
  }
});

// Deployment history
router.get('/:projectId/deployments', requireProjectRole([]), async (req, res, next) => {
  try {
    const { environment } = req.query;
    const filter = { project: req.project._id };
    if (environment) filter.environment = environment;
    const deployments = await Deployment.find(filter).sort('-createdAt').limit(50).populate('triggeredBy', 'name avatarUrl');
    res.json({ deployments });
  } catch (err) {
    next(err);
  }
});

const pickDeployment = (b = {}) => {
  const out = {};
  for (const k of ['environment', 'status', 'commitSha', 'branch', 'logs', 'durationSeconds', 'dockerImage']) {
    if (b[k] !== undefined) out[k] = b[k];
  }
  return out;
};

// Record a deployment manually
router.post('/:projectId/deployments', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const deployment = await Deployment.create({
      ...pickDeployment(req.body),
      project: req.project._id,
      triggeredBy: req.user._id,
    });
    req.app.get('io')?.to(`project:${req.project._id}`).emit('deployment:new', deployment);
    if (deployment.status === 'failed') await notifyFailure(req.project, deployment);
    res.status(201).json({ deployment });
  } catch (err) {
    next(err);
  }
});

router.put('/:projectId/deployments/:id', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const deployment = await Deployment.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      pickDeployment(req.body),
      { new: true, runValidators: true }
    );
    res.json({ deployment });
  } catch (err) {
    next(err);
  }
});

export default router;
