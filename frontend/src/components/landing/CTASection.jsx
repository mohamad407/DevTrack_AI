import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function CTASection() {
  return (
    <section className="relative mx-auto max-w-5xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass-panel relative overflow-hidden px-8 py-16 text-center sm:px-16"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/25 blur-[110px]" />
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Your next sprint starts <span className="text-gradient">on one screen</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-300">
          Free for small teams. No credit card. Set up your first project and let the AI draft
          your backlog in minutes.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/signup" className="btn-primary px-6 py-3 text-base">
            Create your workspace <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="btn-ghost px-6 py-3 text-base">
            I already have an account
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
