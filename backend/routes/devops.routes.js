import { Router } from 'express';
import { Deployment } from '../models/Misc.models.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Connect a GitHub repo to the project
router.put('/:projectId/repo', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    let repoInput = req.body.githubRepo || '';

    // Accept either a full GitHub URL or a plain "owner/repo" string.
    // Strip protocol + domain, trailing ".git", and any trailing slash
    // so what gets saved is always a clean "owner/repo".
    repoInput = repoInput
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');

    req.project.githubRepo = repoInput; // "owner/repo"
    await req.project.save();
    res.json({ project: req.project });
  } catch (err) {
    next(err);
  }
});

/**
 * CI/CD pipeline status + build history, sourced from GitHub Actions.
 * Requires GITHUB_TOKEN in .env with `repo` + `actions:read` scope.
 * Falls back to a helpful error if not connected, so the dashboard can show an empty state.
 */
router.get('/:projectId/pipeline', requireProjectRole([]), async (req, res, next) => {
  try {
    if (!req.project.githubRepo) {
      return res.json({ connected: false, runs: [] });
    }
    if (!process.env.GITHUB_TOKEN) {
      return res.status(503).json({ message: 'GITHUB_TOKEN not configured on the server' });
    }
    const resp = await fetch(`https://api.github.com/repos/${req.project.githubRepo}/actions/runs?per_page=15`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
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
      startedAt: r.run_started_at,
      url: r.html_url,
    }));
    res.json({ connected: true, runs });
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

// Record a deployment (called by CI/CD webhook or manually)
router.post('/:projectId/deployments', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const deployment = await Deployment.create({
      ...req.body,
      project: req.project._id,
      triggeredBy: req.user._id,
    });
    req.app.get('io').to(`project:${req.project._id}`).emit('deployment:new', deployment);
    res.status(201).json({ deployment });
  } catch (err) {
    next(err);
  }
});

router.put('/:projectId/deployments/:id', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const deployment = await Deployment.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      req.body,
      { new: true }
    );
    res.json({ deployment });
  } catch (err) {
    next(err);
  }
});

// Docker container status (placeholder integration point — wire to your orchestrator's API,
// e.g. Render's API, Docker Engine API, or Kubernetes, using the project's env config)
router.get('/:projectId/containers', requireProjectRole([]), async (req, res) => {
  res.json({
    note: 'Wire this endpoint to your Docker/Render API using project.githubRepo and env vars.',
    containers: [],
  });
});

export default router;
