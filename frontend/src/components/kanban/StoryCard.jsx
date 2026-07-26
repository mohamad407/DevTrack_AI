import { Draggable } from '@hello-pangea/dnd';
import { MessageSquare, Paperclip, Calendar } from 'lucide-react';

const priorityDot = { Low: 'bg-ink-500', Medium: 'bg-cyan-glow', High: 'bg-warning', Critical: 'bg-danger' };

/**
 * Replaces the old standalone TaskCard on the Kanban board. Backed by the Story model
 * (backlog items), so it can show Story Points and Labels alongside the fields the
 * original TaskCard already had (assignee, due date, comments, attachments).
 */
export default function StoryCard({ story, index, onClick }) {
  return (
    <Draggable draggableId={story._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`glass-card cursor-pointer space-y-2 p-3.5 transition-shadow ${
            snapshot.isDragging ? 'shadow-glow ring-1 ring-primary-light/50' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug">{story.title}</p>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${priorityDot[story.priority]}`} />
          </div>

          {story.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {story.labels.map((l) => (
                <span key={l} className="badge px-1.5 py-0 text-[10px] text-ink-400">{l}</span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-ink-500">
            <div className="flex items-center gap-3 text-xs">
              <span className="badge px-1.5 py-0 font-mono text-[10px]">{story.storyPoints ?? 0} pts</span>
              {story.comments?.length > 0 && (
                <span className="flex items-center gap-1"><MessageSquare size={12} /> {story.comments.length}</span>
              )}
              {story.attachments?.length > 0 && (
                <span className="flex items-center gap-1"><Paperclip size={12} /> {story.attachments.length}</span>
              )}
              {story.dueDate && (
                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(story.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              )}
            </div>
            {story.assignee && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aurora text-[10px] font-semibold text-white" title={story.assignee.name}>
                {story.assignee.name?.[0]}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
