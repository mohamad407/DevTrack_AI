import { useState } from 'react';
import { Star } from 'lucide-react';

/** Display-only when `onChange` is omitted; interactive (1–5) otherwise. */
export default function StarRating({ value = 0, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  const shown = interactive ? hover || value : value;

  return (
    <div
      className="flex items-center gap-1"
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? 'Choose a rating' : `${value} out of 5 stars`}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(shown);
        const color = filled ? 'text-warning' : 'text-ink-700';
        if (!interactive) {
          return <Star key={n} size={size} className={color} fill={filled ? 'currentColor' : 'none'} />;
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
            className={`${color} transition-transform hover:scale-110`}
          >
            <Star size={size} fill={filled ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
}
