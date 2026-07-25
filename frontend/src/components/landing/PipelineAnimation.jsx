import { motion } from 'framer-motion';

const stages = [
  { label: 'Backlog', x: 40 },
  { label: 'To Do', x: 220 },
  { label: 'In Progress', x: 400 },
  { label: 'Code Review', x: 580 },
  { label: 'Testing', x: 760 },
  { label: 'Done', x: 940 },
];

const TRACK_Y = 90;

/**
 * Signature visual: a single continuous "sprint pipeline" track running the full width
 * of the hero — the fusion of an Agile Kanban flow and a CI/CD pipeline in one line.
 * Glowing cards travel node to node; a build pulse trails behind them, echoing pipeline runs.
 */
export default function PipelineAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-x-auto">
      <svg viewBox="0 0 1000 180" className="min-w-[720px] w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="trackGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#7C5CFC" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base track */}
        <line x1="40" y1={TRACK_Y} x2="940" y2={TRACK_Y} stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        {/* animated flowing dashes */}
        <line
          x1="40" y1={TRACK_Y} x2="940" y2={TRACK_Y}
          stroke="url(#trackGrad)" strokeWidth="2" strokeDasharray="10 10"
          className="animate-pipeline-flow"
        />

        {stages.map((s, i) => (
          <g key={s.label}>
            <circle cx={s.x} cy={TRACK_Y} r="7" fill="#0D1220" stroke="url(#trackGrad)" strokeWidth="2" filter="url(#nodeGlow)" />
            <text x={s.x} y={TRACK_Y + 34} textAnchor="middle" fontSize="13" fontFamily="Inter, sans-serif" fill="#94A3B8">
              {s.label}
            </text>
          </g>
        ))}

        {/* traveling glowing card tokens */}
        {[0, 1, 2].map((i) => (
          <motion.g
            key={i}
            initial={{ x: 40 }}
            animate={{ x: stages.map((s) => s.x) }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 2.3,
              times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            }}
          >
            <rect x="-16" y={TRACK_Y - 34} width="32" height="20" rx="6" fill={i === 0 ? '#7C5CFC' : i === 1 ? '#22D3EE' : '#34D399'} filter="url(#nodeGlow)" opacity="0.9" />
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
