import { motion } from 'framer-motion';
import { GitCommit, Hammer, FlaskConical, Rocket, CheckCircle2 } from 'lucide-react';

const steps = [
  { icon: GitCommit, label: 'Commit', sub: 'main @ 7f3a9c1' },
  { icon: Hammer, label: 'Build', sub: 'Docker image' },
  { icon: FlaskConical, label: 'Test', sub: '128 passing' },
  { icon: Rocket, label: 'Deploy', sub: 'Render · Prod' },
  { icon: CheckCircle2, label: 'Live', sub: '99.98% uptime' },
];

export default function DevOpsIllustration() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="glass-panel overflow-hidden p-8 sm:p-12">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Your pipeline, always visible</h2>
            <p className="mt-2 max-w-md text-ink-300">
              Every commit flows through the same stages your team already ships with.
            </p>
          </div>
          <span className="badge text-success">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-success" /> All systems operational
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card relative flex flex-col items-center gap-2 p-5 text-center"
            >
              {i < steps.length - 1 && (
                <span className="absolute right-[-14px] top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-primary-light/60 to-transparent sm:block" />
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aurora/20 text-primary-light">
                <s.icon size={20} />
              </div>
              <p className="font-display text-sm font-semibold">{s.label}</p>
              <p className="font-mono text-xs text-ink-500">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
