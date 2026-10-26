import { useRef, useState } from 'react';

/** Six digit boxes that move forward automatically, accept pasted codes, and call onComplete when full. */
export default function OtpBoxes({ length = 6, onComplete, disabled = false }) {
  const [digits, setDigits] = useState(Array(length).fill(''));
  const inputs = useRef([]);

  const update = (next) => {
    setDigits(next);
    if (next.every(Boolean)) onComplete(next.join(''));
  };

  const handleChange = (index, raw) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      update(digits.map((x, i) => (i === index ? '' : x)));
      return;
    }
    if (clean.length > 1) {
      const next = Array(length).fill('').map((_, i) => clean[i] || '');
      update(next);
      inputs.current[Math.min(clean.length, length) - 1]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    update(next);
    if (index < length - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          className="h-14 w-12 rounded-xl border border-white/10 bg-white/[0.04] text-center font-mono text-xl font-semibold text-ink-100 outline-none transition-all duration-200 focus:border-primary-light focus:bg-primary/10 focus:ring-2 focus:ring-primary/30 disabled:opacity-60 sm:h-16 sm:w-14"
        />
      ))}
    </div>
  );
}
