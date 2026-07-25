import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ListTodo, KanbanSquare, CalendarRange,
  LineChart, GitBranch, Users, Bot, ShieldCheck, GitBranchPlus,
} from 'lucide-react';

const baseLinks = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/projects', label: 'Projects', icon: FolderKanban, end: true },
  { to: '/dashboard/ai-assistant', label: 'AI Assistant', icon: Bot, end: true },
];

const projectLinks = (id) => [
  { to: `/dashboard/projects/${id}/backlog`, label: 'Backlog', icon: ListTodo },
  { to: `/dashboard/projects/${id}/sprints`, label: 'Sprints', icon: CalendarRange },
  { to: `/dashboard/projects/${id}/board`, label: 'Kanban Board', icon: KanbanSquare },
  { to: `/dashboard/projects/${id}/analytics`, label: 'Analytics', icon: LineChart },
  { to: `/dashboard/projects/${id}/devops`, label: 'DevOps', icon: GitBranch },
  { to: `/dashboard/projects/${id}/team`, label: 'Team', icon: Users },
];

export default function Sidebar({ open, onClose }) {
  const { projectId } = useParams();

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/[0.08] text-white shadow-inner' : 'text-ink-400 hover:bg-white/[0.04] hover:text-ink-100'
    }`;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 -translate-x-full border-r border-white/[0.06] bg-void-700/80 p-4 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : ''
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2 pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aurora shadow-glow">
            <GitBranchPlus size={16} className="text-white" />
          </span>
          <span className="font-display text-base font-semibold">DevTrack AI</span>
        </div>

        <nav className="space-y-1">
          {baseLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClasses} onClick={onClose}>
              <l.icon size={17} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        {projectId && (
          <>
            <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-ink-700">
              Current project
            </p>
            <nav className="space-y-1">
              {projectLinks(projectId).map((l) => (
                <NavLink key={l.to} to={l.to} className={linkClasses} onClick={onClose}>
                  <l.icon size={17} />
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        <div className="absolute bottom-4 left-4 right-4">
          <NavLink to="/dashboard/admin" className={linkClasses}>
            <ShieldCheck size={17} />
            Admin panel
          </NavLink>
        </div>
      </aside>
    </>
  );
}
