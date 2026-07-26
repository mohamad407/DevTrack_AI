import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Sparkles, X, Loader2, CalendarRange, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { connectSocket } from '../../services/socket.js';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const priorityColor = { Low: 'text-ink-400', Medium: 'text-cyan-glow', High: 'text-warning', Critical: 'text-danger' };

export default function BacklogPage() {
  const { projectId } = useParams();
  const [stories, setStories] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selected, setSelected] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', storyPoints: 3, priority: 'Medium', labels: '' });
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Product Backlog = only stories with no sprint (sprint=none). Once a story is assigned
  // to a sprint it's expected to disappear from this list — this is what makes that happen.
  const loadBacklog = () =>
    api.get('/backlog', { params: { project: projectId, sprint: 'none' } })
      .then(({ data }) => setStories(data.stories))
      .catch(() => setStories([]));

  const loadSprints = () =>
    api.get('/sprints', { params: { project: projectId } })
      .then(({ data }) => setSprints(data.sprints.filter((s) => s.status !== 'Completed')))
      .catch(() => setSprints([]));

  useEffect(() => {
    loadBacklog();
    loadSprints();

    // Realtime: if another user assigns/removes a story to/from a sprint elsewhere,
    // keep this list in sync without a manual refresh.
    const socket = connectSocket();
    socket.emit('project:join', projectId);
    socket.on('story:updated', (s) => {
      const sprintId = s.sprint?._id || s.sprint;
      setStories((prev) => {
        if (!prev) return prev;
        if (sprintId) return prev.filter((x) => x._id !== s._id); // now assigned -> drop from backlog view
        const exists = prev.some((x) => x._id === s._id);
        return exists ? prev.map((x) => (x._id === s._id ? s : x)) : [s, ...prev]; // unassigned -> (re)add
      });
    });
    socket.on('story:created', (s) => setStories((prev) => (prev && !s.sprint ? [s, ...prev] : prev)));
    socket.on('story:deleted', ({ id }) => setStories((prev) => prev?.filter((x) => x._id !== id)));
    return () => {
      socket.emit('project:leave', projectId);
      socket.off('story:updated');
      socket.off('story:created');
      socket.off('story:deleted');
    };
  }, [projectId]);

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
      loadBacklog();
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
        data.stories.map((s) => api.post('/backlog', { project: projectId, ...s, aiGenerated: true }))
      );
      toast.success(`Added ${data.stories.length} AI-generated stories`);
      setAiOpen(false);
      setAiPrompt('');
      loadBacklog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed — check your Gemini API key');
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const assignSelectedToSprint = async (sprintId) => {
    if (selected.length === 0) return;
    setAssigning(true);
    try {
      const { data } = await api.put('/backlog/assign-sprint/bulk', {
        project: projectId,
        storyIds: selected,
        sprintId,
      });
      toast.success(data.message);
      setSelected([]);
      setAssignOpen(false);
      loadBacklog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not assign to sprint');
    } finally {
      setAssigning(false);
    }
  };

  // Drag a single backlog item directly onto a sprint drop-zone in the right-hand rail.
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination || destination.droppableId === 'backlog-list') return;
    const sprintId = destination.droppableId.replace('sprint-', '');
    try {
      await api.put(`/backlog/${draggableId}/assign-sprint`, { project: projectId, sprintId });
      toast.success('Assigned to sprint');
      setStories((prev) => prev.filter((s) => s._id !== draggableId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not assign to sprint');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Product Backlog</h1>
          <p className="mt-1 text-ink-400">Prioritize, estimate, and refine before sprint planning. Drag an item onto a sprint to assign it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.length > 0 && (
            <button onClick={() => setAssignOpen(true)} className="btn-primary text-sm">
              <CalendarRange size={16} /> Assign {selected.length} to sprint
            </button>
          )}
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
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
            <Droppable droppableId="backlog-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                  {stories.length === 0 ? (
                    <div className="glass-panel py-16 text-center text-ink-300">
                      Backlog is empty — every story is assigned to a sprint, or you haven't added any yet.
                    </div>
                  ) : (
                    stories.map((s, i) => (
                      <Draggable draggableId={s._id} index={i} key={s._id}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={`glass-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                              dragSnapshot.isDragging ? 'shadow-glow ring-1 ring-primary-light/50' : ''
                            }`}
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <button onClick={() => toggleSelect(s._id)} className="mt-0.5 shrink-0 text-ink-500 hover:text-primary-light">
                                {selected.includes(s._id) ? <CheckSquare size={17} className="text-primary-light" /> : <Square size={17} />}
                              </button>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">{s.title}</p>
                                  {s.aiGenerated && <span className="badge text-primary-light"><Sparkles size={11} /> AI</span>}
                                </div>
                                {s.description && <p className="mt-1 line-clamp-1 text-sm text-ink-400">{s.description}</p>}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {s.labels?.map((l) => <span key={l} className="badge text-ink-400">{l}</span>)}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-4 text-sm">
                              <span className={`font-medium ${priorityColor[s.priority]}`}>{s.priority}</span>
                              <span className="badge font-mono">{s.storyPoints} pts</span>
                              <button
                                onClick={() => { setSelected([s._id]); setAssignOpen(true); }}
                                className="btn-ghost px-2.5 py-1 text-xs"
                              >
                                Assign to sprint
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            <div className="space-y-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-600">Drop onto a sprint</p>
              {sprints.length === 0 ? (
                <div className="glass-card p-4 text-center text-xs text-ink-500">No open sprints yet.</div>
              ) : (
                sprints.map((sp) => (
                  <Droppable droppableId={`sprint-${sp._id}`} key={sp._id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`glass-card flex min-h-[70px] flex-col justify-center p-4 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-primary/[0.08] ring-1 ring-primary-light/40' : ''
                        }`}
                      >
                        <p className="text-sm font-medium">{sp.name}</p>
                        <span className={`badge mt-1 w-fit ${sp.status === 'Active' ? 'text-success' : 'text-ink-400'}`}>{sp.status}</span>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))
              )}
            </div>
          </div>
        </DragDropContext>
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

      {assignOpen && (
        <Modal onClose={() => setAssignOpen(false)} title={`Assign ${selected.length} item${selected.length > 1 ? 's' : ''} to sprint`}>
          {sprints.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No open sprints. Create one on the Sprints page first.</p>
          ) : (
            <div className="space-y-2">
              {sprints.map((sp) => (
                <button
                  key={sp._id}
                  disabled={assigning}
                  onClick={() => assignSelectedToSprint(sp._id)}
                  className="glass-card flex w-full items-center justify-between p-3.5 text-left text-sm transition-colors hover:bg-white/[0.06]"
                >
                  <span className="font-medium">{sp.name}</span>
                  <span className={`badge ${sp.status === 'Active' ? 'text-success' : 'text-ink-400'}`}>{sp.status}</span>
                </button>
              ))}
            </div>
          )}
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
