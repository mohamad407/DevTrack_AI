import { motion, useReducedMotion } from 'framer-motion';

const stages = [
  { label: 'Backlog', x: 40 },
  { label: 'To Do', x: 220 },
  { label: 'In Progress', x: 400 },
  { label: 'Code Review', x: 580 },
  { label: 'Testing', x: 760 },
  { label: 'Done', x: 940 },
];

const TRACK_Y = 90;
const CYCLE = 12; // seconds for one story to travel the whole track
const REST = 0.45; // share of each leg spent resting at a stage before moving on

const TOKENS = [
  { id: 'DTA-12', owner: 'AS', color: '#7C5CFC' },
  { id: 'DTA-19', owner: 'MK', color: '#22D3EE' },
  { id: 'DTA-27', owner: 'RJ', color: '#34D399' },
];

const xs = stages.map((s) => s.x);
const legs = xs.length - 1;

// One loop of movement: rest at each stage, then glide to the next. Returned as keyframes for framer-motion.
const buildPath = () => {
  const legTime = 1 / legs;
  const frames = [{ t: 0, x: xs[0] }];
  for (let i = 0; i < legs; i++) {
    frames.push({ t: i * legTime + legTime * REST, x: xs[i] }); // rest at stage i
    frames.push({ t: (i + 1) * legTime, x: xs[i + 1] }); // glide to stage i+1
  }
  return {
    times: frames.map((f) => f.t),
    x: frames.map((f) => f.x),
    // Holds use linear easing (no movement); glides use a soft ease in and out
    ease: frames.slice(1).map((f, k) => (frames[k].x === f.x ? 'linear' : 'easeInOut')),
  };
};

const PATH = buildPath();

function StoryCard({ token, index, reduce }) {
  // Launch the cards one after another so they don't travel as a clump
  const delay = (index * CYCLE) / TOKENS.length;
  return (
    <motion.g
      initial={{ x: xs[0] }}
      animate={reduce ? { x: xs[index] } : { x: PATH.x }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: CYCLE, repeat: Infinity, times: PATH.times, ease: PATH.ease, delay }
      }
    >
      {/* connector from the card down to the track */}
      <line x1="0" y1={TRACK_Y - 18} x2="0" y2={TRACK_Y - 8} stroke={token.color} strokeWidth="1.5" opacity="0.7" />
      {/* the story card */}
      <rect x="-50" y={TRACK_Y - 50} width="100" height="32" rx="8" fill={token.color} opacity="0.92" filter="url(#nodeGlow)" />
      <rect x="-50" y={TRACK_Y - 50} width="5" height="32" rx="2.5" fill="#FFFFFF" opacity="0.55" />
      <text x="-38" y={TRACK_Y - 30} fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif" fill="#0D1220">
        {token.id}
      </text>
      <text x="-38" y={TRACK_Y - 19} fontSize="9" fontFamily="Inter, sans-serif" fill="#0D1220" opacity="0.75">
        Story
      </text>
      {/* owner badge */}
      <circle cx="36" cy={TRACK_Y - 34} r="10" fill="#0D1220" stroke="#FFFFFF" strokeOpacity="0.35" />
      <text x="36" y={TRACK_Y - 30} textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="Inter, sans-serif" fill="#E2E8F0">
        {token.owner}
      </text>
    </motion.g>
  );
}

/**
 * Signature visual: one continuous sprint pipeline. Story cards rest at each column, then glide on.
 * A light ring travels through each stage as cards arrive, so the stages look alive.
 */
export default function PipelineAnimation() {
  const reduce = useReducedMotion();

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
        {/* flowing dashes along the track */}
        <line
          x1="40" y1={TRACK_Y} x2="940" y2={TRACK_Y}
          stroke="url(#trackGrad)" strokeWidth="2" strokeDasharray="10 10"
          className="animate-pipeline-flow"
        />

        {/* a ring pulses at each stage in turn, timed with the cards' arrival */}
        {!reduce &&
          stages.map((s, i) => (
            <motion.circle
              key={`halo-${s.label}`}
              cx={s.x}
              cy={TRACK_Y}
              r="7"
              fill="none"
              stroke="#22D3EE"
              strokeWidth="1.5"
              animate={{ r: [7, 22, 22], opacity: [0.8, 0, 0] }}
              transition={{
                duration: CYCLE,
                repeat: Infinity,
                times: [0, 0.12, 1],
                ease: 'easeOut',
                delay: (i * CYCLE) / legs,
              }}
            />
          ))}

        {/* stations */}
        {stages.map((s) => (
          <g key={s.label}>
            <circle cx={s.x} cy={TRACK_Y} r="7" fill="#0D1220" stroke="url(#trackGrad)" strokeWidth="2" filter="url(#nodeGlow)" />
            <text x={s.x} y={TRACK_Y + 34} textAnchor="middle" fontSize="13" fontFamily="Inter, sans-serif" fill="#94A3B8">
              {s.label}
            </text>
          </g>
        ))}

        {/* story cards */}
        {TOKENS.map((token, i) => (
          <StoryCard key={token.id} token={token} index={i} reduce={reduce} />
        ))}
      </svg>
    </div>
  );
}
