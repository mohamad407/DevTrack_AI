import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/20 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-glow/15 blur-[110px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel relative w-full max-w-md p-8"
      >
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-aurora shadow-glow">
            <GitBranch size={18} className="text-white" />
          </span>
          <span className="font-display text-lg font-semibold">DevTrack AI</span>
        </Link>

        <h1 className="text-center font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-ink-400">{subtitle}</p>}

        <div className="mt-8">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-ink-400">{footer}</div>}
      </motion.div>
    </div>
  );
}
