import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GitBranch, CheckCircle2, XCircle, Loader2, Clock, Rocket, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

const ENVIRONMENTS = ['Development', 'Testing', 'Production'];

const statusIcon = {
  success: <CheckCircle2 size={16} className="text-success" />,
  failed: <XCircle size={16} className="text-danger" />,
  failure: <XCircle size={16} className="text-danger" />,
  running: <Loader2 size={16} className="animate-spin text-cyan-glow" />,
  in_progress: <Loader2 size={16} className="animate-spin text-cyan-glow" />,
  queued: <Clock size={16} className="text-ink-400" />,
};

export default function DevOpsPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [deployments, setDeployments] = useState(null);
  const [repoInput, setRepoInput] = useState('');
  const [env, setEnv] = useState('Production');

  const load = () => {
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProject(data.project);
      setRepoInput(data.project.githubRepo || '');
    });
    api.get(`/devops/${projectId}/pipeline`).then(({ data }) => setPipeline(data)).catch(() => setPipeline({ connected: false, runs: [] }));
  };

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    api.get(`/devops/${projectId}/deployments`, { params: { environment: env } })
      .then(({ data }) => setDeployments(data.deployments))
      .catch(() => setDeployments([]));
  }, [projectId, env]);

  const connectRepo = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/devops/${projectId}/repo`, { project: projectId, githubRepo: repoInput });
      toast.success('Repository connected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not connect repo');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">DevOps</h1>
        <p className="mt-1 text-ink-400">CI/CD pipeline status, builds, and deployment history.</p>
      </div>

      <div className="glass-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <GitBranch size={18} className="text-primary-light" />
          <div>
            <p className="text-sm font-medium">GitHub repository</p>
            <p className="text-xs text-ink-500">{project?.githubRepo || 'Not connected'}</p>
          </div>
        </div>
        <form onSubmit={connectRepo} className="flex gap-2">
          <input placeholder="owner/repo" className="input-glass py-2 text-sm" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} />
          <button type="submit" className="btn-ghost px-3.5 text-sm"><Link2 size={15} /> Connect</button>
        </form>
      </div>

      <div className="glass-card p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-ink-200">CI/CD pipeline runs</h3>
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
                    <p className="font-mono text-xs text-ink-500">{r.branch} · {r.commit}</p>
                  </div>
                </div>
                <span className="text-xs text-ink-500">{r.startedAt && new Date(r.startedAt).toLocaleString()}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-200">
            <Rocket size={16} className="text-cyan-glow" /> Deployment history
          </h3>
          <div className="flex gap-1">
            {ENVIRONMENTS.map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  env === e ? 'bg-white/[0.1] text-white' : 'text-ink-400 hover:bg-white/[0.05]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        {deployments === null ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : deployments.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">No deployments recorded for {env} yet.</p>
        ) : (
          <div className="space-y-2">
            {deployments.map((d) => (
              <div key={d._id} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3 text-sm">
                <div className="flex items-center gap-3">
                  {statusIcon[d.status] || <Clock size={16} />}
                  <div>
                    <p className="font-medium">{d.branch} <span className="font-mono text-xs text-ink-500">{d.commitSha?.slice(0, 7)}</span></p>
                    <p className="text-xs text-ink-500">by {d.triggeredBy?.name || 'system'}</p>
                  </div>
                </div>
                <span className="text-xs text-ink-500">{new Date(d.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
