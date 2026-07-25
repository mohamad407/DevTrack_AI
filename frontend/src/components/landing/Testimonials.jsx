import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: 'Our sprint planning meetings went from an hour to fifteen minutes once the AI started drafting the first pass of stories.',
    name: 'Priya Nair',
    role: 'Scrum Master, Fintech startup',
  },
  {
    quote: 'Having the build status next to the Kanban board sounds small until you stop tab-switching thirty times a day.',
    name: 'Marcus Webb',
    role: 'Engineering Lead',
  },
  {
    quote: 'The burndown chart finally matches what the team actually feels mid-sprint. Retros got a lot more honest.',
    name: 'Sofia Alvarez',
    role: 'Product Owner',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto mb-14 max-w-xl text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Teams ship calmer with DevTrack</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="glass-card flex flex-col justify-between p-6"
          >
            <div className="mb-4 flex gap-1 text-warning">
              {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={14} fill="currentColor" />)}
            </div>
            <blockquote className="text-sm leading-relaxed text-ink-300">"{t.quote}"</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora font-display text-sm font-semibold text-white">
                {t.name.split(' ').map((n) => n[0]).join('')}
              </span>
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-ink-500">{t.role}</p>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
