import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Sparkles, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const priorityColor = { Low: 'text-ink-400', Medium: 'text-cyan-glow', High: 'text-warning', Critical: 'text-danger' };

export default function BacklogPage() {
  const { projectId } = useParams();
  const [stories, setStories] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', storyPoints: 3, priority: 'Medium', labels: '' });
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/backlog', { params: { project: projectId } }).then(({ data }) => setStories(data.stories)).catch(() => setStories([]));

  useEffect(() => { load(); }, [projectId]);

  const createStory = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/backlog', {
        project: projectId,
        ...form,
        labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
      });
      toast.success('Story added to backlog');
      setModalOpen(false);
      setForm({ title: '', description: '', storyPoints: 3, priority: 'Medium', labels: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create story');
    } finally {
      setSaving(false);
    }
  };

  const generateWithAI = async (e) => {
    e.preventDefault();
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai/generate-stories', {
        project: projectId,
        featureDescription: aiPrompt,
        count: 3,
      });
      await Promise.all(
        data.stories.map((s) =>
          api.post('/backlog', { project: projectId, ...s, aiGenerated: true })
        )
      );
      toast.success(`Added ${data.stories.length} AI-generated stories`);
      setAiOpen(false);
      setAiPrompt('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed — check your Gemini API key');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Product Backlog</h1>
          <p className="mt-1 text-ink-400">Prioritize, estimate, and refine before sprint planning.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAiOpen(true)} className="btn-ghost text-sm">
            <Sparkles size={16} className="text-primary-light" /> Generate with AI
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">
            <Plus size={16} /> Add story
          </button>
        </div>
      </div>

      {stories === null ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : stories.length === 0 ? (
        <div className="glass-panel py-16 text-center text-ink-300">Backlog is empty. Add a story to get started.</div>
      ) : (
        <div className="space-y-3">
          {stories.map((s) => (
            <div key={s._id} className="glass-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{s.title}</p>
                  {s.aiGenerated && <span className="badge text-primary-light"><Sparkles size={11} /> AI</span>}
                </div>
                {s.description && <p className="mt-1 line-clamp-1 text-sm text-ink-400">{s.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.labels?.map((l) => <span key={l} className="badge text-ink-400">{l}</span>)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <span className={`font-medium ${priorityColor[s.priority]}`}>{s.priority}</span>
                <span className="badge font-mono">{s.storyPoints} pts</span>
                <span className="badge">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title="Add user story">
          <form onSubmit={createStory} className="space-y-4">
            <input required placeholder="As a … I want … so that …" className="input-glass" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea placeholder="Description" rows={3} className="input-glass resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input-glass" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
              </select>
              <select className="input-glass" value={form.storyPoints} onChange={(e) => setForm({ ...form, storyPoints: Number(e.target.value) })}>
                {[1, 2, 3, 5, 8, 13].map((p) => <option key={p} value={p}>{p} pts</option>)}
              </select>
            </div>
            <input placeholder="Labels (comma separated)" className="input-glass" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} />
            <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">{saving ? 'Saving…' : 'Add to backlog'}</button>
          </form>
        </Modal>
      )}

      {aiOpen && (
        <Modal onClose={() => setAiOpen(false)} title="Generate stories with AI">
          <form onSubmit={generateWithAI} className="space-y-4">
            <textarea
              required
              rows={4}
              placeholder="Describe the feature, e.g. 'Users should be able to export their sprint report as a PDF'"
              className="input-glass resize-none"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <button type="submit" disabled={aiLoading} className="btn-primary w-full py-2.5">
              {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <><Sparkles size={16} /> Generate 3 stories</>}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
