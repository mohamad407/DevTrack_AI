import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  GitBranch, CheckCircle2, XCircle, Loader2, Clock, Rocket, Link2, Activity, Globe,
  RefreshCw, Play, Plus, ExternalLink, Copy, Gauge, GitPullRequest, Timer, ShieldCheck, Trash2, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { connectSocket } from '../../services/socket.js';

const ENVIRONMENTS = ['Development', 'Testing', 'Production'];

const statusIcon = {
  success: <CheckCircle2 size={16} className="text-success" />,
  failed: <XCircle size={16} className="text-danger" />,
  failure: <XCircle size={16} className="text-danger" />,
  running: <Loader2 size={16} className="animate-spin text-cyan-glow" />,
  in_progress: <Loader2 size={16} className="animate-spin text-cyan-glow" />,
  queued: <Clock size={16} className="text-ink-400" />,
};

const fmtDuration = (s) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};
const fmtMinutes = (m) => {
  if (m === null || m === undefined) return '—';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const timeAgo = (d) => {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

function Metric({ icon: Icon, label, value, hint, tone = 'text-primary-light' }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <Icon size={14} className={tone} /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function Chip({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${ok ? 'border-success/30 text-success' : 'border-white/10 text-ink-500'}`}>
      {ok ? <CheckCircle2 size={12} /> : <Clock size={12} />} {children}
    </span>
  );
}

export default function DevOpsPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [role, setRole] = useState('');
  const [config, setConfig] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [activity, setActivity] = useState(null);
  const [deployments, setDeployments] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [checking, setChecking] = useState(false);
  const [env, setEnv] = useState('Production');

  const [repoInput, setRepoInput] = useState('');
  const [liveInput, setLiveInput] = useState('');
  const [hookInput, setHookInput] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  const [rec, setRec] = useState({ status: 'success', branch: 'main', commitSha: '', notes: '' });
  const [deploying, setDeploying] = useState(false);

  const isAdmin = role === 'Admin';
  const canManage = role === 'Admin' || role === 'Scrum Master';

  const loadProject = useCallback(() => {
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProject(data.project);
      setRole(data.role);
      setRepoInput(data.project.githubRepo || '');
      setLiveInput(data.project.liveUrl || '');
    });
    api.get(`/devops/${projectId}/config`).then(({ data }) => setConfig(data)).catch(() => setConfig({}));
  }, [projectId]);

  const loadGithub = useCallback(() => {
    api.get(`/devops/${projectId}/pipeline`).then(({ data }) => setPipeline(data)).catch(() => setPipeline({ connected: false, runs: [] }));
    api.get(`/devops/${projectId}/repo-activity`).then(({ data }) => setActivity(data)).catch(() => setActivity({ connected: false, commits: [], pulls: [] }));
  }, [projectId]);

  const loadDeployments = useCallback(() => {
    api.get(`/devops/${projectId}/deployments`, { params: { environment: env } })
      .then(({ data }) => setDeployments(data.deployments))
      .catch(() => setDeployments([]));
    api.get(`/devops/${projectId}/summary`).then(({ data }) => setSummary(data)).catch(() => setSummary({}));
  }, [projectId, env]);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await api.get(`/devops/${projectId}/health`);
      setHealth(data);
      if (data.configured) {
        setHealthHistory((h) => [...h, { up: data.up, ms: data.responseMs || 0 }].slice(-20));
      }
    } catch {
      setHealth({ configured: true, up: false, error: 'Check failed' });
    } finally {
      setChecking(false);
    }
  }, [projectId]);

  useEffect(() => { loadProject(); loadGithub(); }, [loadProject, loadGithub]);
  useEffect(() => { loadDeployments(); }, [loadDeployments]);

  // health check now + every 60s while the page is open
  useEffect(() => {
    setHealthHistory([]);
    checkHealth();
    const t = setInterval(checkHealth, 60000);
    return () => clearInterval(t);
  }, [checkHealth]);

  // live updates when a deployment is recorded (webhook / deploy button)
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('project:join', projectId);
    const onNew = () => loadDeployments();
    socket.on('deployment:new', onNew);
    return () => socket.off('deployment:new', onNew);
  }, [projectId, loadDeployments]);

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      if (repoInput !== (project?.githubRepo || '')) {
        await api.put(`/devops/${projectId}/repo`, { githubRepo: repoInput });
      }
      const body = { liveUrl: liveInput };
      if (hookInput.trim()) body.deployHookUrl = hookInput.trim();
      await api.put(`/devops/${projectId}/config`, body);
      setHookInput('');
      toast.success('DevOps settings saved');
      loadProject();
      loadGithub();
      checkHealth();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save settings');
    }
  };

  const removeHook = async () => {
    try {
      await api.put(`/devops/${projectId}/config`, { deployHookUrl: '' });
      toast.success('Deploy hook removed');
      loadProject();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove hook');
    }
  };

  const triggerDeploy = async () => {
    setDeploying(true);
    try {
      const { data } = await api.post(`/devops/${projectId}/deploy`, { environment: env });
      toast.success(data.message || 'Deploy triggered');
      loadDeployments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Deploy failed');
      loadDeployments();
    } finally {
      setDeploying(false);
    }
  };

  const recordDeployment = async (e) => {
    e.preventDefault();
    try {
      const { notes, ...rest } = rec;
      await api.post(`/devops/${projectId}/deployments`, { ...rest, logs: notes, environment: env });
      toast.success('Deployment recorded');
      setShowRecord(false);
      setRec({ status: 'success', branch: 'main', commitSha: '', notes: '' });
      loadDeployments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record deployment');
    }
  };

  const resolveDeployment = async (id, status) => {
    try {
      await api.put(`/devops/${projectId}/deployments/${id}`, { status });
      toast.success(status === 'success' ? 'Marked as success' : 'Marked as failed');
      loadDeployments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update deployment');
    }
  };

  const deleteDeployment = async (id) => {
    if (!window.confirm('Delete this deployment record?')) return;
    try {
      await api.delete(`/devops/${projectId}/deployments/${id}`);
      toast.success('Deployment deleted');
      loadDeployments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete deployment');
    }
  };

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Environment', 'Status', 'Branch', 'Commit', 'Duration (s)', 'By', 'Notes', 'Date']];
    (deployments || []).forEach((d) => rows.push([
      d.environment, d.status, d.branch, d.commitSha, d.durationSeconds || '',
      d.triggeredBy?.name || 'GitHub Actions', d.logs, new Date(d.createdAt).toISOString(),
    ]));
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deployments-${env.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text).then(() => toast.success('Copied'));
  };

  const apiBase = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
  const webhookUrl = `${apiBase.replace(/\/$/, '')}/devops/${projectId}/webhook`;

  const finishedRuns = (pipeline?.runs || []).filter((r) => r.status === 'completed');
  const pipelineRate = finishedRuns.length
    ? Math.round((finishedRuns.filter((r) => r.conclusion === 'success').length / finishedRuns.length) * 100)
    : null;

  const maxDay = Math.max(1, ...(summary?.days || []).map((d) => d.success + d.failed));
  const maxMs = Math.max(500, ...healthHistory.map((h) => h.ms));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">DevOps</h1>
          <p className="mt-1 text-ink-400">Delivery metrics, uptime, CI/CD pipeline and deployments.</p>
        </div>
        {canManage && config?.hasDeployHook && (
          <button onClick={triggerDeploy} disabled={deploying} className="btn-primary">
            {deploying ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Deploy {env}
          </button>
        )}
      </div>

      {/* Delivery metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Rocket} label="Deploys / week" value={summary?.perWeek ?? '—'} hint={summary?.total !== undefined ? `${summary.total} in last 30 days` : ''} tone="text-cyan-glow" />
        <Metric icon={ShieldCheck} label="Success rate" value={summary?.successRate != null ? `${summary.successRate}%` : '—'} hint={summary?.changeFailureRate != null ? `${summary.changeFailureRate}% change failure rate` : 'No finished deployments yet'} tone="text-success" />
        <Metric icon={Timer} label="Avg build time" value={fmtDuration(summary?.avgDurationSeconds)} hint="From GitHub Actions runs" />
        <Metric icon={Gauge} label="Avg time to recover" value={fmtMinutes(summary?.mttrMinutes)} hint="Failure → next success" tone="text-warning" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Health monitor */}
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
              <Globe size={16} className="text-cyan-glow" /> Live health
            </h3>
            {health?.configured && (
              <button onClick={checkHealth} disabled={checking} className="btn-ghost px-2.5 py-1.5" title="Check now">
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
          {!health ? (
            <div className="skeleton h-16 w-full" />
          ) : !health.configured ? (
            <p className="py-6 text-center text-sm text-ink-500">Add your deployed app's URL in settings below to monitor uptime.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${health.up ? 'bg-success' : 'bg-danger'}`} />
                <p className="font-display text-lg font-semibold">{health.up ? 'Operational' : 'Down'}</p>
                <span className="text-xs text-ink-500">
                  {health.statusCode ? `HTTP ${health.statusCode} · ` : ''}{health.responseMs}ms
                </span>
              </div>
              {health.error && <p className="mt-1 text-xs text-danger">{health.error}</p>}
              <a href={health.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
                {health.url} <ExternalLink size={11} />
              </a>
              <div className="mt-4 flex h-10 items-end gap-1">
                {healthHistory.map((h, i) => (
                  <div
                    key={i}
                    title={`${h.up ? 'Up' : 'Down'} · ${h.ms}ms`}
                    className={`flex-1 rounded-sm ${h.up ? 'bg-success/60' : 'bg-danger/70'}`}
                    style={{ height: `${Math.max(12, (h.ms / maxMs) * 100)}%` }}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-500">Response time, checked every 60s while this page is open. Free hosts can be slow on the first check (cold start).</p>
            </>
          )}
        </div>

        {/* 14 day chart */}
        <div className="glass-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
            <Activity size={16} className="text-primary-light" /> Deployments — last 14 days
          </h3>
          {!summary?.days ? (
            <div className="skeleton h-24 w-full" />
          ) : (
            <>
              <div className="flex h-24 items-end gap-1.5">
                {summary.days.map((d) => (
                  <div key={d.date} title={`${d.date}: ${d.success} ok, ${d.failed} failed`} className="flex flex-1 flex-col justify-end gap-px" style={{ height: '100%' }}>
                    <div className="rounded-sm bg-danger/70" style={{ height: `${(d.failed / maxDay) * 100}%` }} />
                    <div className="rounded-sm bg-success/60" style={{ height: `${(d.success / maxDay) * 100}%` }} />
                    {d.success + d.failed === 0 && <div className="h-0.5 rounded-sm bg-white/10" />}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink-500">
                <span>{summary.days[0].date.slice(5)}</span>
                <span>{summary.days[13].date.slice(5)}</span>
              </div>
              <p className="mt-3 text-xs text-ink-400">
                {summary.lastProduction
                  ? `Last production deploy ${timeAgo(summary.lastProduction.at)} · ${summary.lastProduction.branch}${summary.lastProduction.commit ? ` @ ${summary.lastProduction.commit}` : ''}${summary.lastProduction.by ? ` · ${summary.lastProduction.by}` : ''}`
                  : 'No successful production deploy yet'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Settings / setup */}
      <div className="glass-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
            <GitBranch size={16} className="text-primary-light" /> Setup
          </h3>
          <div className="flex flex-wrap gap-2">
            <Chip ok={!!project?.githubRepo}>Repo connected</Chip>
            <Chip ok={!!config?.tokenConfigured}>Server GitHub token</Chip>
            <Chip ok={!!config?.webhookSecretConfigured}>Webhook secret</Chip>
            <Chip ok={!!project?.liveUrl}>Live URL</Chip>
            <Chip ok={!!config?.hasDeployHook}>Deploy hook</Chip>
          </div>
        </div>

        {isAdmin ? (
          <form onSubmit={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-ink-400">
              GitHub repository
              <input placeholder="owner/repo" className="input-glass mt-1 py-2 text-sm" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} />
            </label>
            <label className="text-xs text-ink-400">
              Live app URL (for health checks)
              <input placeholder="https://your-app.vercel.app" className="input-glass mt-1 py-2 text-sm" value={liveInput} onChange={(e) => setLiveInput(e.target.value)} />
            </label>
            <label className="text-xs text-ink-400 sm:col-span-2">
              Deploy hook URL (Render / Vercel / Netlify) {config?.hasDeployHook && <span className="text-success">— saved</span>}
              <div className="mt-1 flex gap-2">
                <input type="password" autoComplete="off" placeholder={config?.hasDeployHook ? '•••••••• (enter a new one to replace)' : 'https://api.render.com/deploy/srv-...'} className="input-glass flex-1 py-2 text-sm" value={hookInput} onChange={(e) => setHookInput(e.target.value)} />
                {config?.hasDeployHook && <button type="button" onClick={removeHook} className="btn-ghost px-3 text-sm text-danger">Remove</button>}
              </div>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary text-sm"><Link2 size={15} /> Save settings</button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-ink-400">Repository: <span className="text-ink-200">{project?.githubRepo || 'Not connected'}</span>. Only a project Admin can change DevOps settings.</p>
        )}

        {project?.githubRepo && (
          <div className="rounded-xl border border-white/[0.06] p-3 text-xs text-ink-400">
            <p className="mb-1 font-medium text-ink-200">Auto-record deployments from GitHub Actions</p>
            <p>Repo → Settings → Webhooks → Add webhook. Content type <span className="font-mono">application/json</span>, secret = your <span className="font-mono">GITHUB_WEBHOOK_SECRET</span>, event "Workflow runs".</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-mono">{webhookUrl}</code>
              <button onClick={() => copy(webhookUrl)} className="btn-ghost px-2.5 py-1.5" title="Copy"><Copy size={13} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-ink-200">CI/CD pipeline runs</h3>
          {pipelineRate !== null && <span className="text-xs text-ink-400">{pipelineRate}% of last {finishedRuns.length} runs passed</span>}
        </div>
        {pipeline === null ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : !pipeline.connected ? (
          <p className="py-8 text-center text-sm text-ink-500">Connect a GitHub repo to see live build status here.</p>
        ) : pipeline.runs.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">No workflow runs found yet.</p>
        ) : (
          <div className="space-y-2">
            {pipeline.runs.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3 text-sm hover:bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  {statusIcon[r.conclusion || r.status] || <Clock size={16} className="text-ink-400" />}
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="font-mono text-xs text-ink-500">{r.branch} · {r.commit}{r.actor ? ` · ${r.actor}` : ''}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-ink-500">
                  <p>{r.startedAt && new Date(r.startedAt).toLocaleString()}</p>
                  {r.durationSeconds !== null && <p>{fmtDuration(r.durationSeconds)}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Commits + PRs */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
            <GitBranch size={16} className="text-primary-light" /> Recent commits
          </h3>
          {activity === null ? (
            <div className="skeleton h-24 w-full" />
          ) : !activity.connected || activity.commits.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No commits to show.</p>
          ) : (
            <div className="space-y-2">
              {activity.commits.map((c) => (
                <a key={c.sha} href={c.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/[0.06] p-2.5 text-sm hover:bg-white/[0.03]">
                  <p className="truncate font-medium">{c.message}</p>
                  <p className="text-xs text-ink-500"><span className="font-mono">{c.sha}</span> · {c.author} · {timeAgo(c.date)}</p>
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
            <GitPullRequest size={16} className="text-cyan-glow" /> Open pull requests
          </h3>
          {activity === null ? (
            <div className="skeleton h-24 w-full" />
          ) : !activity.connected || activity.pulls.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No open pull requests.</p>
          ) : (
            <div className="space-y-2">
              {activity.pulls.map((p) => (
                <a key={p.number} href={p.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/[0.06] p-2.5 text-sm hover:bg-white/[0.03]">
                  <p className="truncate font-medium">{p.title}{p.draft && <span className="ml-2 text-xs text-ink-500">draft</span>}</p>
                  <p className="text-xs text-ink-500">#{p.number} · {p.author} · {timeAgo(p.createdAt)}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deployment history */}
      <div className="glass-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
            <Rocket size={16} className="text-cyan-glow" /> Deployment history
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {ENVIRONMENTS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${env === e ? 'bg-white/[0.1] text-white' : 'text-ink-400 hover:bg-white/[0.05]'}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <button onClick={exportCsv} disabled={!deployments?.length} className="btn-ghost px-3 py-1.5 text-xs" title="Export CSV">
              <Download size={13} /> Export
            </button>
            {canManage && (
              <button onClick={() => setShowRecord((v) => !v)} className="btn-ghost px-3 py-1.5 text-xs">
                <Plus size={13} /> Record
              </button>
            )}
          </div>
        </div>

        {showRecord && (
          <form onSubmit={recordDeployment} className="mb-4 grid gap-2 rounded-xl border border-white/[0.06] p-3 sm:grid-cols-4">
            <select className="input-glass py-2 text-sm" value={rec.status} onChange={(e) => setRec({ ...rec, status: e.target.value })}>
              {['success', 'failed', 'running', 'queued'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input-glass py-2 text-sm" placeholder="branch" value={rec.branch} onChange={(e) => setRec({ ...rec, branch: e.target.value })} />
            <input className="input-glass py-2 font-mono text-sm" placeholder="commit sha" value={rec.commitSha} onChange={(e) => setRec({ ...rec, commitSha: e.target.value })} />
            <input className="input-glass py-2 text-sm sm:col-span-3" placeholder="Release notes (optional) - what changed in this deploy?" value={rec.notes} onChange={(e) => setRec({ ...rec, notes: e.target.value })} />
            <button type="submit" className="btn-primary text-sm">Save to {env}</button>
          </form>
        )}

        {deployments === null ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : deployments.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">No deployments recorded for {env} yet.</p>
        ) : (
          <div className="space-y-2">
            {deployments.map((d) => (
              <div key={d._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] p-3 text-sm">
                <div className="flex items-center gap-3">
                  {statusIcon[d.status] || <Clock size={16} />}
                  <div>
                    <p className="font-medium">{d.branch} <span className="font-mono text-xs text-ink-500">{d.commitSha?.slice(0, 7)}</span></p>
                    <p className="text-xs text-ink-500"><span className="capitalize">{d.status}</span> · by {d.triggeredBy?.name || 'GitHub Actions'}{d.durationSeconds > 0 ? ` · ${fmtDuration(d.durationSeconds)}` : ''}</p>
                    {d.logs && <p className="mt-0.5 max-w-md truncate text-xs text-ink-400" title={d.logs}>{d.logs}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && ['queued', 'running'].includes(d.status) && (
                    <>
                      <button onClick={() => resolveDeployment(d._id, 'success')} className="btn-ghost px-2.5 py-1 text-xs text-success">Mark success</button>
                      <button onClick={() => resolveDeployment(d._id, 'failed')} className="btn-ghost px-2.5 py-1 text-xs text-danger">Mark failed</button>
                    </>
                  )}
                  <span className="text-xs text-ink-500">{new Date(d.createdAt).toLocaleString()}</span>
                  {isAdmin && (
                    <button onClick={() => deleteDeployment(d._id)} className="btn-ghost px-2 py-1 text-danger" title="Delete record"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
