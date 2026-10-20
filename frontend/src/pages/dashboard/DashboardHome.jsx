import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban, Plus, ArrowUpRight, Megaphone, Info, AlertTriangle, Siren, X,
  Bot, Users, Bell, KanbanSquare, GitBranch, LineChart, User, Activity, CheckCircle2,
} from 'lucide-react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { connectSocket } from '../../services/socket.js';
import InstallAppButton from '../../components/common/InstallAppButton.jsx';
import usePWAInstall from '../../hooks/usePWAInstall.js';

const SEVERITY = {
  info: { icon: Info, dot: 'bg-cyan-glow', text: 'text-cyan-glow', ring: 'border-cyan-glow/30' },
  warning: { icon: AlertTriangle, dot: 'bg-warning', text: 'text-warning', ring: 'border-warning/30' },
  critical: { icon: Siren, dot: 'bg-danger', text: 'text-danger', ring: 'border-danger/30' },
};

const timeAgo = (d) => {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

const idOf = (x) => (x && typeof x === 'object' ? x._id : x);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Announcements: ticker strip + animated cards (live via socket). */
function AnnouncementFeed() {
  const [items, setItems] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('devtrack_dismissed_ann') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    api.get('/announcements').then(({ data }) => setItems(data.announcements)).catch(() => setItems([]));

    const socket = connectSocket();
    const onNew = (a) => setItems((prev) => [a, ...(prev || []).filter((x) => x._id !== a._id)]);
    const onUpdated = (a) =>
      setItems((prev) =>
        (prev || []).flatMap((x) => (x._id === a._id ? (a.active ? [{ ...x, ...a }] : []) : [x]))
      );
    const onDeleted = ({ id }) => setItems((prev) => (prev || []).filter((x) => x._id !== id));
    socket.on('announcement:new', onNew);
    socket.on('announcement:updated', onUpdated);
    socket.on('announcement:deleted', onDeleted);
    return () => {
      socket.off('announcement:new', onNew);
      socket.off('announcement:updated', onUpdated);
      socket.off('announcement:deleted', onDeleted);
    };
  }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem('devtrack_dismissed_ann', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const visible = (items || []).filter((a) => !dismissed.includes(a._id));
  if (!visible.length) return null;
  const loop = [...visible, ...visible];

  return (
    <section className="space-y-3">
      <div className="glass-card relative flex items-center overflow-hidden py-2.5">
        <div className="z-10 flex shrink-0 items-center gap-2 border-r border-white/10 bg-void-700/80 px-4">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-light opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-light" />
          </span>
          <Megaphone size={15} className="text-primary-light" />
          <span className="text-xs font-semibold uppercase tracking-wider">Live</span>
        </div>
        <div className="marquee-mask flex-1 overflow-hidden">
          <div className="marquee-track flex w-max items-center gap-10 pl-6">
            {loop.map((a, i) => {
              const s = SEVERITY[a.severity] || SEVERITY.info;
              return (
                <span key={`${a._id}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-sm">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <span className={`font-medium ${s.text}`}>{a.title}</span>
                  <span className="text-ink-500">— {a.message}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <AnimatePresence initial={false}>
          {visible.slice(0, 4).map((a) => {
            const s = SEVERITY[a.severity] || SEVERITY.info;
            const Icon = s.icon;
            return (
              <motion.div
                key={a._id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className={`glass-card relative flex gap-3 border p-4 ${s.ring}`}
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${s.text}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 text-sm text-ink-400">{a.message}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    {a.postedBy?.name ? `${a.postedBy.name} · ` : ''}{timeAgo(a.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(a._id)}
                  aria-label="Dismiss"
                  className="h-6 w-6 shrink-0 rounded-md text-ink-500 hover:bg-white/[0.06] hover:text-ink-100"
                >
                  <X size={14} className="mx-auto" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value, glow }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card relative overflow-hidden p-5"
    >
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${glow}`} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
        <Icon size={18} className="text-ink-500" />
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
    </motion.div>
  );
}

const severityIcon = (n) => (n.read ? CheckCircle2 : Bell);

export default function DashboardHome() {
  const { user } = useAuth();
  const { installed } = usePWAInstall();
  const [projects, setProjects] = useState(null);
  const [notes, setNotes] = useState(null);

  useEffect(() => {
    api.get('/projects').then(({ data }) => setProjects(data.projects)).catch(() => setProjects([]));
    api.get('/notifications').then(({ data }) => setNotes(data.notifications)).catch(() => setNotes([]));
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const loaded = projects !== null;
  const teamSize = loaded
    ? new Set(
        projects.flatMap((p) => [idOf(p.owner), ...(p.members || []).map((m) => idOf(m.user))]).filter(Boolean)
      ).size
    : 0;
  const unread = (notes || []).filter((n) => !n.read).length;

  const first = projects?.[0];
  const projectPath = (tail) => (first ? `/dashboard/projects/${first._id}/${tail}` : '/dashboard/projects');

  const quickActions = [
    { label: 'New project', to: '/dashboard/projects', icon: Plus },
    { label: 'AI Assistant', to: '/dashboard/ai-assistant', icon: Bot },
    { label: 'Kanban board', to: projectPath('board'), icon: KanbanSquare },
    { label: 'Analytics', to: projectPath('analytics'), icon: LineChart },
    { label: 'DevOps', to: projectPath('devops'), icon: GitBranch },
    { label: 'Profile', to: '/dashboard/profile', icon: User },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel relative overflow-hidden p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary/30 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-cyan-glow/20 blur-[90px]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-ink-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
              {greeting()}, <span className="text-gradient">{firstName}</span> 👋
            </h1>
            <p className="mt-2 max-w-md text-ink-400">
              {loaded && projects.length
                ? `You're part of ${projects.length} project${projects.length === 1 ? '' : 's'} with ${teamSize} teammate${teamSize === 1 ? '' : 's'}.`
                : "Create a project to start planning your first sprint."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {installed && (
              <span className="badge border-success/30 text-success">
                <CheckCircle2 size={12} /> App installed
              </span>
            )}
            <InstallAppButton compact />
            <Link to="/dashboard/projects" className="btn-primary text-sm">
              <Plus size={16} /> New project
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={loaded ? projects.length : '—'} glow="bg-primary/40" />
        <StatCard icon={Users} label="Team members" value={loaded ? teamSize : '—'} glow="bg-cyan-glow/30" />
        <StatCard icon={Bell} label="Unread alerts" value={notes ? unread : '—'} glow="bg-danger/30" />
        <StatCard icon={Activity} label="Recent activity" value={notes ? notes.length : '—'} glow="bg-success/30" />
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                to={a.to}
                className="glass-card group flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-glow"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-primary-light transition-colors group-hover:bg-aurora group-hover:text-white">
                  <Icon size={17} />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <AnnouncementFeed />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects */}
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Your projects</h2>
            <Link to="/dashboard/projects" className="text-sm text-primary-light hover:underline">View all</Link>
          </div>

          {!loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-panel flex flex-col items-center gap-3 py-16 text-center">
              <FolderKanban size={32} className="text-ink-600" />
              <p className="text-ink-300">No projects yet. Create one to start your first sprint.</p>
              <Link to="/dashboard/projects" className="btn-primary mt-2 text-sm">
                <Plus size={16} /> Create your first project
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p._id}
                  to={`/dashboard/projects/${p._id}/board`}
                  className="glass-card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-1 hover:shadow-glow"
                >
                  <div className="flex items-center justify-between">
                    <span className="badge font-mono text-primary-light">{p.key}</span>
                    <ArrowUpRight size={16} className="text-ink-600 transition-colors group-hover:text-primary-light" />
                  </div>
                  <h3 className="font-display text-base font-semibold">{p.name}</h3>
                  <p className="line-clamp-2 text-sm text-ink-400">{p.description || 'No description yet.'}</p>
                  <div className="mt-2 flex -space-x-2">
                    {p.members?.slice(0, 4).map((m) => (
                      <span
                        key={m.user?._id}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-void-700 bg-aurora text-[11px] font-semibold text-white"
                        title={m.user?.name}
                      >
                        {m.user?.name?.[0]}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Activity */}
        <aside className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Activity</h2>
            {unread > 0 && <span className="badge text-danger">{unread} new</span>}
          </div>

          {notes === null ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : notes.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-500">You're all caught up.</p>
          ) : (
            <ul className="space-y-1">
              {notes.slice(0, 6).map((n) => {
                const Icon = severityIcon(n);
                return (
                  <li key={n._id} className={`flex gap-3 rounded-xl p-3 ${!n.read ? 'bg-white/[0.04]' : ''}`}>
                    <Icon size={15} className={`mt-0.5 shrink-0 ${n.read ? 'text-ink-600' : 'text-primary-light'}`} />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm text-ink-200">{n.message}</p>
                      <p className="mt-1 text-xs text-ink-500">{timeAgo(n.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
