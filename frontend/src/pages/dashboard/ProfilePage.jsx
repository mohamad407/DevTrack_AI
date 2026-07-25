import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', jobTitle: user?.jobTitle || '', avatarUrl: user?.avatarUrl || '' });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/me', form);
      toast.success('Profile updated');
    } catch {
      toast.error('Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-ink-400">Update how you appear across your projects.</p>
      </div>

      <div className="glass-panel p-6">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-aurora font-display text-xl font-semibold text-white">
            {user?.name?.[0]?.toUpperCase()}
          </span>
          <div>
            <p className="font-medium">{user?.email}</p>
            <p className="text-xs text-ink-500">Email cannot be changed here — managed via Firebase.</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Full name</label>
            <input className="input-glass" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Job title</label>
            <input className="input-glass" placeholder="e.g. Senior Frontend Engineer" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Avatar URL</label>
            <input className="input-glass" placeholder="https://…" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary py-2.5">{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  );
}
