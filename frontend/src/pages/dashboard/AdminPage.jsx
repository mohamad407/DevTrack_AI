import { useEffect, useState } from 'react';
import { Users, FolderKanban, Megaphone, BarChart3, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

const TABS = ['Overview', 'Users', 'Projects', 'Announcements'];

export default function AdminPage() {
  const [tab, setTab] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [projects, setProjects] = useState(null);
  const [announcements, setAnnouncements] = useState(null);
  const [annForm, setAnnForm] = useState({ title: '', message: '', severity: 'info' });

  useEffect(() => {
    api.get('/admin/analytics/overview').then(({ data }) => setOverview(data)).catch(() => setOverview({}));
    api.get('/admin/users').then(({ data }) => setUsers(data.users)).catch(() => setUsers([]));
    api.get('/admin/projects').then(({ data }) => setProjects(data.projects)).catch(() => setProjects([]));
    api.get('/admin/announcements').then(({ data }) => setAnnouncements(data.announcements)).catch(() => setAnnouncements([]));
  }, []);

  const toggleSuspend = async (u) => {
    try {
      const status = u.status === 'active' ? 'suspended' : 'active';
      await api.put(`/admin/users/${u._id}/status`, { status });
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, status } : x)));
      toast.success(`User ${status}`);
    } catch {
      toast.error('Could not update user');
    }
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/admin/announcements', annForm);
      setAnnouncements((prev) => [data.announcement, ...prev]);
      setAnnForm({ title: '', message: '', severity: 'info' });
      toast.success('Announcement posted');
    } catch {
      toast.error('Could not post announcement');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
        <p className="mt-1 text-ink-400">Platform-wide oversight — visible to system admins only.</p>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-primary-light text-white' : 'text-ink-500 hover:text-ink-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Total users" value={overview?.totalUsers} />
          <StatCard icon={FolderKanban} label="Total projects" value={overview?.totalProjects} />
          <StatCard icon={BarChart3} label="Active this week" value={overview?.activeUsers} />
        </div>
      )}

      {tab === 'Users' && (
        <div className="glass-card divide-y divide-white/[0.06]">
          {users === null ? <div className="p-5"><div className="skeleton h-12 w-full" /></div> : users.map((u) => (
            <div key={u._id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{u.name} {u.systemRole === 'admin' && <span className="badge ml-1 text-primary-light">Admin</span>}</p>
                <p className="text-xs text-ink-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${u.status === 'active' ? 'text-success' : 'text-danger'}`}>{u.status}</span>
                <button onClick={() => toggleSuspend(u)} className="btn-ghost px-3 py-1 text-xs">
                  {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Projects' && (
        <div className="glass-card divide-y divide-white/[0.06]">
          {projects === null ? <div className="p-5"><div className="skeleton h-12 w-full" /></div> : projects.map((p) => (
            <div key={p._id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{p.name} <span className="badge ml-1 font-mono">{p.key}</span></p>
                <p className="text-xs text-ink-500">Owner: {p.owner?.name} · {p.members?.length} members</p>
              </div>
              <span className="badge">{p.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'Announcements' && (
        <div className="space-y-4">
          <form onSubmit={postAnnouncement} className="glass-card space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-warning" />
              <h3 className="font-display text-sm font-semibold">New announcement</h3>
            </div>
            <input required placeholder="Title" className="input-glass" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} />
            <textarea required placeholder="Message" rows={2} className="input-glass resize-none" value={annForm.message} onChange={(e) => setAnnForm({ ...annForm, message: e.target.value })} />
            <div className="flex items-center gap-3">
              <select className="input-glass w-40" value={annForm.severity} onChange={(e) => setAnnForm({ ...annForm, severity: e.target.value })}>
                {['info', 'warning', 'critical'].map((s) => <option key={s}>{s}</option>)}
              </select>
              <button type="submit" className="btn-primary text-sm"><Plus size={15} /> Post</button>
            </div>
          </form>

          <div className="space-y-2">
            {announcements?.map((a) => (
              <div key={a._id} className="glass-card flex items-start gap-3 p-4">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severity === 'critical' ? 'bg-danger' : a.severity === 'warning' ? 'bg-warning' : 'bg-cyan-glow'}`} />
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-sm text-ink-400">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="glass-card p-5">
      <Icon size={18} className="mb-3 text-primary-light" />
      <p className="font-display text-2xl font-bold">{value ?? <span className="skeleton inline-block h-7 w-10 align-middle" />}</p>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}
