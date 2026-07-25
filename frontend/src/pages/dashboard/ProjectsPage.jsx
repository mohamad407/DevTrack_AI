import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, FolderKanban, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

export default function ProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', key: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/projects').then(({ data }) => setProjects(data.projects)).catch(() => setProjects([]));

  useEffect(() => { load(); }, []);

  const createProject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/projects', form);
      toast.success('Project created');
      setModalOpen(false);
      setForm({ name: '', key: '', description: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create project');
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (id) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success('Project deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete project');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-ink-400">Every workspace your team ships from.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">
          <Plus size={16} /> New project
        </button>
      </div>

      {projects === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 py-16 text-center">
          <FolderKanban size={32} className="text-ink-600" />
          <p className="text-ink-300">No projects yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p._id} className="glass-card flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="badge font-mono text-primary-light">{p.key}</span>
                <button onClick={() => deleteProject(p._id)} className="text-ink-600 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
              <Link to={`/dashboard/projects/${p._id}/board`} className="font-display text-base font-semibold hover:text-primary-light">
                {p.name}
              </Link>
              <p className="line-clamp-2 text-sm text-ink-400">{p.description || 'No description yet.'}</p>
              <div className="mt-1 flex gap-2 text-xs text-ink-500">
                <Link to={`/dashboard/projects/${p._id}/backlog`} className="hover:text-primary-light">Backlog</Link>·
                <Link to={`/dashboard/projects/${p._id}/team`} className="hover:text-primary-light">Team</Link>·
                <Link to={`/dashboard/projects/${p._id}/devops`} className="hover:text-primary-light">DevOps</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">New project</h2>
              <button onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={createProject} className="space-y-4">
              <input
                required
                placeholder="Project name"
                className="input-glass"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                placeholder="Key (e.g. DTA) — auto-generated if left blank"
                className="input-glass"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })}
              />
              <textarea
                placeholder="Description"
                rows={3}
                className="input-glass resize-none"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
