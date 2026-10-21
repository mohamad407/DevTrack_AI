import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Trash2, ShieldAlert, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const Section = ({ title, description, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card space-y-5 p-6"
  >
    <div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-400">{description}</p>
    </div>
    {children}
  </motion.section>
);

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me', {
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        avatarUrl: user?.avatarUrl || '',
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/users/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devtrack-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Your data export has downloaded');
    } catch {
      toast.error('Could not export your data');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/users/me', { data: { confirm: 'DELETE' } });
      toast.success('Your account has been deleted');
      await logout();
      navigate('/');
    } catch (err) {
      const projects = err.response?.data?.projects;
      const message = err.response?.data?.message || 'Could not delete your account';
      toast.error(projects?.length ? `${message}: ${projects.join(', ')}` : message, { duration: 6000 });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-400">Manage your profile, your data, and your account.</p>
      </div>

      <Section title="Profile" description="How your name and role appear to your team.">
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="settings-name" className="mb-2 block text-sm font-medium text-ink-300">Name</label>
            <input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="input-glass"
            />
          </div>
          <div>
            <label htmlFor="settings-job" className="mb-2 block text-sm font-medium text-ink-300">Job title</label>
            <input
              id="settings-job"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Scrum Master"
              className="input-glass"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink-300">Email</p>
            <p className="text-sm text-ink-500">{user?.email}</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save changes
            </button>
          </div>
        </form>
      </Section>

      <Section
        title="Download your data"
        description="Get a copy of your profile, projects, stories, tasks, reviews, and notifications as a JSON file."
      >
        <button type="button" onClick={exportData} disabled={exporting} className="btn-ghost text-sm disabled:opacity-60">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export my data
        </button>
      </Section>

      <Section
        title="Delete account"
        description="Permanently delete your account and personal data. This cannot be undone. If you own projects, transfer or archive them first."
      >
        <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-ink-300">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-danger" />
          <p>Your reviews and notifications will be removed, and you will be taken off every project you joined.</p>
        </div>
        <div>
          <label htmlFor="confirm-delete" className="mb-2 block text-sm font-medium text-ink-300">
            Type <span className="font-mono text-danger">DELETE</span> to confirm
          </label>
          <input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="input-glass"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={deleteAccount}
            disabled={confirmText !== 'DELETE' || deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete my account
          </button>
        </div>
      </Section>
    </div>
  );
}
