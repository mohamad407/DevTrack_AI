import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import PipelineAnimation from './PipelineAnimation.jsx';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-40">
      {/* floating ambient glass shapes */}
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-10 top-56 h-72 w-72 rounded-full bg-cyan-glow/15 blur-[100px]" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-ink-300"
        >
          <Sparkles size={14} className="text-primary-light" />
          Gemini-powered sprint planning, built in
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
        >
          One pipeline for <span className="text-gradient">your sprints</span>
          <br /> and your ship dates.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-ink-300"
        >
          DevTrack AI plans your backlog, runs your Kanban board, and watches your CI/CD builds —
          in the same place, on the same timeline, with an AI teammate that drafts stories and
          summarizes standups for you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link to="/signup" className="btn-primary px-6 py-3 text-base">
            Start free <ArrowRight size={18} />
          </Link>
          <a href="#pipeline" className="btn-ghost px-6 py-3 text-base">
            <Play size={16} /> See how it flows
          </a>
        </motion.div>
      </div>

      <motion.div
        id="pipeline"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="glass-panel relative mx-auto mt-20 max-w-6xl px-4 py-10"
      >
        <p className="mb-2 text-center font-display text-sm uppercase tracking-[0.2em] text-ink-500">
          Every story, one continuous pipeline
        </p>
        <PipelineAnimation />
      </motion.div>
    </section>
  );
}
