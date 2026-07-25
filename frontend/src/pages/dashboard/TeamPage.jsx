import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

const ROLES = ['Admin', 'Scrum Master', 'Developer', 'Tester', 'Product Owner'];

export default function TeamPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'Developer' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/projects/${projectId}`).then(({ data }) => setProject(data.project));

  useEffect(() => { load(); }, [projectId]);

  const invite = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/invite`, { project: projectId, ...form });
      toast.success('Member invited');
      setModalOpen(false);
      setForm({ email: '', role: 'Developer' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not invite member');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId, role) => {
    try {
      await api.put(`/projects/${projectId}/members/${userId}/role`, { project: projectId, role });
      toast.success('Role updated');
      load();
    } catch {
      toast.error('Could not update role');
    }
  };

  const removeMember = async (userId) => {
    if (!confirm('Remove this member from the project?')) return;
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`, { params: { project: projectId } });
      toast.success('Member removed');
      load();
    } catch {
      toast.error('Could not remove member');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Team</h1>
          <p className="mt-1 text-ink-400">Manage who's on this project and their role.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">
          <UserPlus size={16} /> Invite member
        </button>
      </div>

      <div className="glass-card divide-y divide-white/[0.06]">
        {!project ? (
          <div className="p-5"><div className="skeleton h-12 w-full" /></div>
        ) : (
          project.members.map((m) => (
            <div key={m.user._id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora text-sm font-semibold text-white">
                  {m.user.name?.[0]}
                </span>
                <div>
                  <p className="text-sm font-medium">{m.user.name}</p>
                  <p className="text-xs text-ink-500">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="input-glass w-40 py-1.5 text-xs"
                  value={m.role}
                  onChange={(e) => changeRole(m.user._id, e.target.value)}
                >
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button onClick={() => removeMember(m.user._id)} className="text-ink-600 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Invite member</h2>
              <button onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={invite} className="space-y-4">
              <input required type="email" placeholder="Member's email" className="input-glass" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <select className="input-glass" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <p className="text-xs text-ink-500">They need an existing DevTrack AI account to be added.</p>
              <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">{saving ? 'Inviting…' : 'Send invite'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
