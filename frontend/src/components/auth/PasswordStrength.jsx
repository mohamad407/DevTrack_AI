import { CheckCircle2, Circle } from 'lucide-react';

export const passwordChecks = (pw) => [
  { label: 'At least 8 characters', ok: pw.length >= 8 },
  { label: 'Contains a number', ok: /\d/.test(pw) },
  { label: 'Upper and lower case', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
];

const LEVELS = [
  { label: 'Too weak', bar: 'bg-danger', text: 'text-danger' },
  { label: 'Weak', bar: 'bg-warning', text: 'text-warning' },
  { label: 'Good', bar: 'bg-cyan-glow', text: 'text-cyan-glow' },
  { label: 'Strong', bar: 'bg-success', text: 'text-success' },
];

export default function PasswordStrength({ password }) {
  if (!password) return null;

  const checks = passwordChecks(password);
  const score = checks.filter((c) => c.ok).length;
  const level = LEVELS[score];
  const segments = 3;
  const filled = Math.max(1, Math.min(segments, score));

  return (
    <div className="space-y-2.5 pt-1" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: segments }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < filled ? level.bar : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${level.text}`}>{level.label}</span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-3">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 text-xs transition-colors ${c.ok ? 'text-success' : 'text-ink-500'}`}
          >
            {c.ok ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
