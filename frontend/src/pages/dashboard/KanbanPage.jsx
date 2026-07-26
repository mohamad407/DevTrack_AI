import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Plus, CalendarRange } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { connectSocket } from '../../services/socket.js';
import StoryCard from '../../components/kanban/StoryCard.jsx';
import StoryDetailModal from '../../components/kanban/StoryDetailModal.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const COLUMNS = ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'];

/**
 * Feature 1/2 upgrade: the Kanban board now shows the stories belonging to whichever
 * sprint is currently Active, instead of an unrelated Task collection. This is what makes
 * "assign to sprint -> auto-appears on Kanban board once sprint is Active" actually work.
 */
export default function KanbanPage() {
  const { projectId } = useParams();
  const [activeSprint, setActiveSprint] = useState(undefined); // undefined = loading, null = none active
  const [stories, setStories] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColumn, setNewColumn] = useState('To Do');

  const loadActiveSprintAndStories = useCallback(async () => {
    try {
      const { data } = await api.get('/sprints', { params: { project: projectId } });
      const active = data.sprints.find((s) => s.status === 'Active') || null;
      setActiveSprint(active);
      if (active) {
        const res = await api.get('/backlog', { params: { project: projectId, sprint: active._id } });
        setStories(res.data.stories);
      } else {
        setStories([]);
      }
    } catch {
      setActiveSprint(null);
      setStories([]);
    }
  }, [projectId]);

  useEffect(() => {
    loadActiveSprintAndStories();
    const socket = connectSocket();
    socket.emit('project:join', projectId);

    socket.on('story:created', (s) => {
      setStories((prev) => (prev && activeSprint && s.sprint === activeSprint._id ? [...prev, s] : prev));
    });
    socket.on('story:updated', (s) => {
      setStories((prev) => {
        if (!prev) return prev;
        const sprintId = s.sprint?._id || s.sprint;
        // If it moved out of the active sprint (or has no sprint), drop it from the board.
        if (!activeSprint || sprintId !== activeSprint._id) return prev.filter((x) => x._id !== s._id);
        const exists = prev.some((x) => x._id === s._id);
        return exists ? prev.map((x) => (x._id === s._id ? s : x)) : [...prev, s];
      });
    });
    socket.on('story:deleted', ({ id }) => setStories((prev) => prev?.filter((x) => x._id !== id)));
    // A sprint transitioning to/from Active changes which stories belong on the board — reload.
    socket.on('sprint:updated', () => loadActiveSprintAndStories());

    return () => {
      socket.emit('project:leave', projectId);
      socket.off('story:created');
      socket.off('story:updated');
      socket.off('story:deleted');
      socket.off('sprint:updated');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loadActiveSprintAndStories]);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;
    setStories((prev) => prev.map((s) => (s._id === draggableId ? { ...s, status: newStatus } : s)));

    try {
      await api.put(`/backlog/${draggableId}`, { project: projectId, status: newStatus, order: destination.index });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not move item');
      loadActiveSprintAndStories();
    }
  };

  const createStory = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !activeSprint) return;
    try {
      const { data } = await api.post('/backlog', { project: projectId, title: newTitle });
      await api.put(`/backlog/${data.story._id}/assign-sprint`, { project: projectId, sprintId: activeSprint._id });
      await api.put(`/backlog/${data.story._id}`, { project: projectId, status: newColumn });
      setNewTitle('');
      loadActiveSprintAndStories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create item');
    }
  };

  if (activeSprint === undefined || stories === null) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {COLUMNS.map((c) => <SkeletonCard key={c} />)}
      </div>
    );
  }

  if (!activeSprint) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 py-20 text-center">
        <CalendarRange size={32} className="text-ink-600" />
        <p className="text-ink-300">No active sprint right now.</p>
        <p className="max-w-sm text-sm text-ink-500">
          Start a sprint from the Sprints page — its assigned backlog items will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Kanban Board</h1>
          <p className="mt-1 text-ink-400">
            <span className="badge mr-2 text-success">Active: {activeSprint.name}</span>
            Drag cards across the pipeline in real time.
          </p>
        </div>
        <form onSubmit={createStory} className="flex gap-2">
          <input
            placeholder="Quick add to this sprint…"
            className="input-glass w-56 py-2 text-sm"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <select className="input-glass w-32 py-2 text-sm" value={newColumn} onChange={(e) => setNewColumn(e.target.value)}>
            {COLUMNS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button type="submit" className="btn-primary px-3.5"><Plus size={16} /></button>
        </form>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <Droppable droppableId={col} key={col}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`glass w-72 shrink-0 rounded-2xl p-3 transition-colors ${
                    snapshot.isDraggingOver ? 'bg-primary/[0.06] ring-1 ring-primary-light/30' : ''
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="font-display text-sm font-semibold text-ink-200">{col}</h3>
                    <span className="badge">{stories.filter((s) => s.status === col).length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {stories.filter((s) => s.status === col).map((s, i) => (
                      <StoryCard key={s._id} story={s} index={i} onClick={() => { setActiveStory(s); setModalOpen(true); }} />
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {modalOpen && activeStory && (
        <StoryDetailModal
          story={activeStory}
          projectId={projectId}
          onClose={() => setModalOpen(false)}
          onUpdated={(s) => { setActiveStory(s); setStories((prev) => prev.map((x) => (x._id === s._id ? s : x))); }}
          onUnassigned={(id) => setStories((prev) => prev.filter((x) => x._id !== id))}
        />
      )}
    </div>
  );
}
