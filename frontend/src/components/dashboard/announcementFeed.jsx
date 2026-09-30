import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Megaphone, Info, AlertTriangle, Siren, X } from 'lucide-react';
import api from '../../services/api.js';
import { connectSocket } from '../../services/socket.js';

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

/**
 * Premium-style announcement flow for the user Overview:
 *  1) a continuously flowing ticker strip (pauses on hover)
 *  2) animated cards below, newest slides in live via socket
 */
export default function AnnouncementFeed() {
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

  // duplicate the list so the marquee loops seamlessly
  const loop = [...visible, ...visible];

  return (
    <section className="space-y-3">
      {/* Flowing ticker */}
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

      {/* Animated cards */}
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
