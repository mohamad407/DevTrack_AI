import { Draggable } from '@hello-pangea/dnd';
import { MessageSquare, Paperclip, Calendar } from 'lucide-react';

const priorityDot = { Low: 'bg-ink-500', Medium: 'bg-cyan-glow', High: 'bg-warning', Critical: 'bg-danger' };

export default function TaskCard({ task, index, onClick }) {
  return (
    <Draggable draggableId={task._id} index={index}>
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
            <p className="text-sm font-medium leading-snug">{task.title}</p>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${priorityDot[task.priority]}`} />
          </div>

          <div className="flex items-center justify-between text-ink-500">
            <div className="flex items-center gap-3 text-xs">
              {task.comments?.length > 0 && (
                <span className="flex items-center gap-1"><MessageSquare size={12} /> {task.comments.length}</span>
              )}
              {task.attachments?.length > 0 && (
                <span className="flex items-center gap-1"><Paperclip size={12} /> {task.attachments.length}</span>
              )}
              {task.dueDate && (
                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              )}
            </div>
            {task.assignee && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aurora text-[10px] font-semibold text-white" title={task.assignee.name}>
                {task.assignee.name?.[0]}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
