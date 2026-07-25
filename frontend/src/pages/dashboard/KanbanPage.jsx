import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { connectSocket, getSocket } from '../../services/socket.js';
import TaskCard from '../../components/kanban/TaskCard.jsx';
import TaskDetailModal from '../../components/kanban/TaskDetailModal.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const COLUMNS = ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'];

export default function KanbanPage() {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskColumn, setNewTaskColumn] = useState('Backlog');

  const load = useCallback(() => {
    api.get('/tasks', { params: { project: projectId } }).then(({ data }) => setTasks(data.tasks)).catch(() => setTasks([]));
  }, [projectId]);

  useEffect(() => {
    load();
    const socket = connectSocket();
    socket.emit('project:join', projectId);

    socket.on('task:created', (t) => setTasks((prev) => (prev ? [...prev, t] : prev)));
    socket.on('task:updated', (t) => setTasks((prev) => prev?.map((x) => (x._id === t._id ? t : x))));
    socket.on('task:deleted', ({ id }) => setTasks((prev) => prev?.filter((x) => x._id !== id)));

    return () => {
      socket.emit('project:leave', projectId);
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:deleted');
    };
  }, [projectId, load]);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;
    setTasks((prev) => prev.map((t) => (t._id === draggableId ? { ...t, status: newStatus } : t)));

    try {
      await api.put(`/tasks/${draggableId}`, { project: projectId, status: newStatus, order: destination.index });
    } catch {
      toast.error('Could not move task');
      load();
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', { project: projectId, title: newTaskTitle, status: newTaskColumn });
      setNewTaskTitle('');
    } catch {
      toast.error('Could not create task');
    }
  };

  if (tasks === null) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {COLUMNS.map((c) => <SkeletonCard key={c} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Kanban Board</h1>
          <p className="mt-1 text-ink-400">Drag tasks across the pipeline in real time.</p>
        </div>
        <form onSubmit={createTask} className="flex gap-2">
          <input
            placeholder="Quick add a task…"
            className="input-glass w-56 py-2 text-sm"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <select className="input-glass w-32 py-2 text-sm" value={newTaskColumn} onChange={(e) => setNewTaskColumn(e.target.value)}>
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
                    <span className="badge">{tasks.filter((t) => t.status === col).length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {tasks.filter((t) => t.status === col).map((t, i) => (
                      <TaskCard key={t._id} task={t} index={i} onClick={() => { setActiveTask(t); setModalOpen(true); }} />
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {modalOpen && activeTask && (
        <TaskDetailModal
          task={activeTask}
          projectId={projectId}
          onClose={() => setModalOpen(false)}
          onUpdated={(t) => { setActiveTask(t); setTasks((prev) => prev.map((x) => (x._id === t._id ? t : x))); }}
        />
      )}
    </div>
  );
}
