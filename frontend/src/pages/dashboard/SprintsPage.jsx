import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, X, Target, MessageSquare, ChevronDown, ChevronUp, CornerUpLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const statusColor = { Planned: 'text-ink-400', Active: 'text-success', Completed: 'text-primary-light' };

export default function SprintsPage() {
  const { projectId } = useParams();
  const [sprints, setSprints] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [retroSprint, setRetroSprint] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [sprintStories, setSprintStories] = useState(null);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [retroForm, setRetroForm] = useState({ wentWell: '', toImprove: '', actionItems: '' });
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/sprints', { params: { project: projectId } }).then(({ data }) => setSprints(data.sprints)).catch(() => setSprints([]));

  useEffect(() => { load(); }, [projectId]);

  // Sprint Details: shows exactly which backlog items are assigned to this sprint.
  const toggleDetails = async (sprintId) => {
    if (expandedId === sprintId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sprintId);
    setSprintStories(null);
    try {
      const { data } = await api.get('/backlog', { params: { project: projectId, sprint: sprintId } });
      setSprintStories(data.stories);
    } catch {
      setSprintStories([]);
    }
  };

  const unassignStory = async (storyId) => {
    try {
      await api.put(`/backlog/${storyId}/unassign-sprint`, { project: projectId });
      toast.success('Moved back to Product Backlog');
      setSprintStories((prev) => prev.filter((s) => s._id !== storyId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not unassign');
    }
  };

  const createSprint = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/sprints', { project: projectId, ...form });
      toast.success('Sprint created');
      setModalOpen(false);
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create sprint');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/sprints/${id}`, { project: projectId, status });
      toast.success(`Sprint marked ${status}`);
      load();
    } catch (err) {
      toast.error('Could not update sprint');
    }
  };

  const saveRetro = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/sprints/${retroSprint._id}/retrospective`, {
        project: projectId,
        wentWell: retroForm.wentWell.split('\n').filter(Boolean),
        toImprove: retroForm.toImprove.split('\n').filter(Boolean),
        actionItems: retroForm.actionItems.split('\n').filter(Boolean),
      });
      toast.success('Retrospective saved');
      setRetroSprint(null);
      load();
    } catch {
      toast.error('Could not save retrospective');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Sprints</h1>
          <p className="mt-1 text-ink-400">Plan, run, and reflect on each sprint cycle.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">
          <Plus size={16} /> New sprint
        </button>
      </div>

      {sprints === null ? (
        <div className="space-y-3">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
      ) : sprints.length === 0 ? (
        <div className="glass-panel py-16 text-center text-ink-300">No sprints yet. Create your first one.</div>
      ) : (
        <div className="space-y-4">
          {sprints.map((s) => (
            <div key={s._id} className="glass-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{s.name}</h3>
                  <span className={`badge ${statusColor[s.status]}`}>{s.status}</span>
                </div>
                <div className="flex gap-2 text-xs text-ink-500">
                  {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}
                </div>
              </div>
              {s.goal && (
                <p className="mt-2 flex items-center gap-2 text-sm text-ink-300">
                  <Target size={14} className="text-primary-light" /> {s.goal}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {s.status === 'Planned' && (
                  <button onClick={() => setStatus(s._id, 'Active')} className="btn-ghost px-3 py-1.5 text-xs">Start sprint</button>
                )}
                {s.status === 'Active' && (
                  <button onClick={() => setStatus(s._id, 'Completed')} className="btn-ghost px-3 py-1.5 text-xs">Complete sprint</button>
                )}
                <button
                  onClick={() => { setRetroSprint(s); setRetroForm({ wentWell: '', toImprove: '', actionItems: '' }); }}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  <MessageSquare size={13} /> Retrospective
                </button>
                <button onClick={() => toggleDetails(s._id)} className="btn-ghost ml-auto px-3 py-1.5 text-xs">
                  {expandedId === s._id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Sprint details
                </button>
              </div>

              {expandedId === s._id && (
                <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                  {s.status === 'Completed' && (
                    <p className="mb-2 text-xs text-ink-500">This sprint is completed — no new items can be added.</p>
                  )}
                  {sprintStories === null ? (
                    <div className="skeleton h-16 w-full" />
                  ) : sprintStories.length === 0 ? (
                    <p className="py-4 text-center text-xs text-ink-500">No backlog items assigned to this sprint yet.</p>
                  ) : (
                    sprintStories.map((story) => (
                      <div key={story._id} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3 text-sm">
                        <div>
                          <p className="font-medium">{story.title}</p>
                          <p className="text-xs text-ink-500">{story.storyPoints} pts · {story.priority} · {story.status}</p>
                        </div>
                        {s.status !== 'Completed' && (
                          <button onClick={() => unassignStory(story._id)} className="btn-ghost px-2.5 py-1 text-xs text-warning">
                            <CornerUpLeft size={12} /> Unassign
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="New sprint" onClose={() => setModalOpen(false)}>
          <form onSubmit={createSprint} className="space-y-4">
            <input required placeholder="Sprint name (e.g. Sprint 4)" className="input-glass" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <textarea placeholder="Sprint goal" rows={2} className="input-glass resize-none" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input required type="date" className="input-glass" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <input required type="date" className="input-glass" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">{saving ? 'Creating…' : 'Create sprint'}</button>
          </form>
        </Modal>
      )}

      {retroSprint && (
        <Modal title={`Retrospective — ${retroSprint.name}`} onClose={() => setRetroSprint(null)}>
          <form onSubmit={saveRetro} className="space-y-3">
            <textarea placeholder="What went well? (one per line)" rows={3} className="input-glass resize-none" value={retroForm.wentWell} onChange={(e) => setRetroForm({ ...retroForm, wentWell: e.target.value })} />
            <textarea placeholder="What could improve? (one per line)" rows={3} className="input-glass resize-none" value={retroForm.toImprove} onChange={(e) => setRetroForm({ ...retroForm, toImprove: e.target.value })} />
            <textarea placeholder="Action items (one per line)" rows={3} className="input-glass resize-none" value={retroForm.actionItems} onChange={(e) => setRetroForm({ ...retroForm, actionItems: e.target.value })} />
            <button type="submit" className="btn-primary w-full py-2.5">Save retrospective</button>
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
