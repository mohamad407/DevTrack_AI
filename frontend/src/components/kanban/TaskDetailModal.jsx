import { useState } from 'react';
import { X, Send, Paperclip, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

export default function TaskDetailModal({ task, projectId, onClose, onUpdated }) {
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/tasks/${task._id}/comments`, { project: projectId, text: comment });
      onUpdated(data.task);
      setComment('');
    } catch {
      toast.error('Could not post comment');
    } finally {
      setSending(false);
    }
  };

  const saveDueDate = async () => {
    try {
      const { data } = await api.put(`/tasks/${task._id}`, { project: projectId, dueDate });
      onUpdated(data.task);
      toast.success('Due date updated');
    } catch {
      toast.error('Could not update due date');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-panel flex max-h-[85vh] w-full max-w-lg flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{task.title}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {task.description && <p className="mb-4 text-sm text-ink-300">{task.description}</p>}

        <div className="mb-4 flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ink-500"><Clock size={13} /> Due date</label>
          <input type="date" className="input-glass w-auto py-1.5 text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button onClick={saveDueDate} className="btn-ghost px-2.5 py-1 text-xs">Save</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-600">Comments</p>
            <div className="space-y-2">
              {task.comments?.length ? task.comments.map((c) => (
                <div key={c._id} className="glass rounded-lg p-2.5 text-sm">
                  <p className="text-ink-200">{c.text}</p>
                  <p className="mt-1 text-[11px] text-ink-500">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
              )) : <p className="text-xs text-ink-500">No comments yet.</p>}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-600">
              <Paperclip size={12} /> Attachments
            </p>
            {task.attachments?.length ? task.attachments.map((a) => (
              <a key={a._id} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-primary-light hover:underline">{a.fileName}</a>
            )) : <p className="text-xs text-ink-500">No files attached.</p>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-600">Activity</p>
            <div className="space-y-1.5">
              {task.activity?.slice().reverse().map((a, i) => (
                <p key={i} className="text-xs text-ink-500">• {a.action} — {new Date(a.createdAt).toLocaleString()}</p>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={submitComment} className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4">
          <input placeholder="Add a comment…" className="input-glass py-2 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button type="submit" disabled={sending} className="btn-primary px-3.5"><Send size={15} /></button>
        </form>
      </div>
    </div>
  );
}
