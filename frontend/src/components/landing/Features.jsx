import { motion } from 'framer-motion';
import {
  KanbanSquare, LineChart, Bot, GitPullRequest, Users, CalendarClock,
} from 'lucide-react';

const features = [
  {
    icon: KanbanSquare,
    title: 'Scrum Kanban board',
    desc: 'Drag stories from Backlog to Done across six columns, with live updates for the whole team.',
    color: 'text-primary-light',
  },
  {
    icon: Bot,
    title: 'AI product partner',
    desc: 'Generate user stories, prioritize the backlog, estimate points, and summarize standups on demand.',
    color: 'text-cyan-glow',
  },
  {
    icon: LineChart,
    title: 'Burndown & velocity',
    desc: 'Live sprint burndown and team velocity charts that update as tasks move to Done.',
    color: 'text-success',
  },
  {
    icon: GitPullRequest,
    title: 'CI/CD visibility',
    desc: 'Connect a GitHub repo and watch build status, deploy history, and environments in one view.',
    color: 'text-warning',
  },
  {
    icon: CalendarClock,
    title: 'Sprint planning',
    desc: 'Plan sprint goals, pull in backlog items, and run review and retrospective in the same workspace.',
    color: 'text-primary-light',
  },
  {
    icon: Users,
    title: 'Role-based teams',
    desc: 'Admins, Scrum Masters, Developers, Testers, and Product Owners — each with the right access.',
    color: 'text-cyan-glow',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-28">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Built for the whole sprint cycle</h2>
        <p className="mt-4 text-ink-300">
          From the first backlog item to the production deploy — DevTrack AI keeps Agile ceremonies
          and DevOps signals in one workspace.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            className="glass-card group p-6 transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-glow animate-float-slow"
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] ${f.color}`}>
              <f.icon size={22} />
            </div>
            <h3 className="font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
