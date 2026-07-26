import { useState } from 'react';
import { X, Send, Paperclip, Clock, CornerUpLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

/** Replaces TaskDetailModal for Kanban cards now that cards are backed by Story documents. */
export default function StoryDetailModal({ story, projectId, onClose, onUpdated, onUnassigned }) {
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [dueDate, setDueDate] = useState(story.dueDate ? story.dueDate.slice(0, 10) : '');

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/backlog/${story._id}/comments`, { project: projectId, text: comment });
      onUpdated(data.story);
      setComment('');
    } catch {
      toast.error('Could not post comment');
    } finally {
      setSending(false);
    }
  };

  const saveDueDate = async () => {
    try {
      const { data } = await api.put(`/backlog/${story._id}`, { project: projectId, dueDate });
      onUpdated(data.story);
      toast.success('Due date updated');
    } catch {
      toast.error('Could not update due date');
    }
  };

  const unassignFromSprint = async () => {
    if (!confirm('Move this item back to the Product Backlog?')) return;
    try {
      await api.put(`/backlog/${story._id}/unassign-sprint`, { project: projectId });
      toast.success('Returned to Product Backlog');
      onUnassigned(story._id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not unassign');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-panel flex max-h-[85vh] w-full max-w-lg flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{story.title}</h2>
            <p className="mt-1 text-xs text-ink-500">{story.storyPoints ?? 0} points · {story.priority}</p>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {story.description && <p className="mb-4 text-sm text-ink-300">{story.description}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ink-500"><Clock size={13} /> Due date</label>
          <input type="date" className="input-glass w-auto py-1.5 text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button onClick={saveDueDate} className="btn-ghost px-2.5 py-1 text-xs">Save</button>
          <button onClick={unassignFromSprint} className="btn-ghost ml-auto px-2.5 py-1 text-xs text-warning">
            <CornerUpLeft size={12} /> Back to backlog
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-600">Comments</p>
            <div className="space-y-2">
              {story.comments?.length ? story.comments.map((c) => (
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
            {story.attachments?.length ? story.attachments.map((a) => (
              <a key={a._id} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-primary-light hover:underline">{a.fileName}</a>
            )) : <p className="text-xs text-ink-500">No files attached.</p>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-600">Activity</p>
            <div className="space-y-1.5">
              {story.activity?.slice().reverse().map((a, i) => (
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
