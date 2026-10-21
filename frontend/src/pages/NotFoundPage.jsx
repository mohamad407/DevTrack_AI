import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Home, LayoutDashboard } from 'lucide-react';

export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-6">
      {/* ambient glow, matching the landing page */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary/25 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-cyan-glow/20 blur-[110px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel relative w-full max-w-lg p-10 text-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-aurora shadow-glow"
        >
          <Compass size={30} className="text-white" />
        </motion.div>

        <p className="font-display text-7xl font-bold text-gradient">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">This page went off track</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-400">
          We couldn't find the page you were looking for. It may have been moved, renamed, or never existed.
        </p>

        {pathname && (
          <p className="mt-4 break-all rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-xs text-ink-500">
            {pathname}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/" className="btn-ghost text-sm">
            <Home size={16} /> Go to home
          </Link>
          <Link to="/dashboard" className="btn-primary text-sm">
            <LayoutDashboard size={16} /> Open dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
