import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StarRating from '../common/StarRating.jsx';
import WriteReviewModal from './WriteReviewModal.jsx';

const MIN_CARDS_PER_ROW = 6;

const MARQUEE_CSS = `
@keyframes dt-scroll-left {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@keyframes dt-scroll-right {
  from { transform: translateX(-50%); }
  to { transform: translateX(0); }
}
.dt-marquee:hover { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .dt-marquee { animation: none !important; }
}
`;

const MASK = 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)';

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';

function ReviewCard({ review }) {
  return (
    <figure className="glass-card mr-6 flex w-[300px] shrink-0 flex-col gap-4 p-5">
      <StarRating value={review.rating} size={15} />
      {review.comment && (
        <blockquote className="line-clamp-3 text-sm leading-relaxed text-ink-300">“{review.comment}”</blockquote>
      )}
      <figcaption className="mt-auto flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aurora font-display text-sm font-semibold text-white">
          {initials(review.name)}
        </span>
        <div>
          <p className="text-sm font-medium">{review.name}</p>
          <p className="text-xs text-ink-500">{format(new Date(review.createdAt), 'MMM d, yyyy')}</p>
        </div>
      </figcaption>
    </figure>
  );
}

function ReviewRow({ reviews, reverse = false }) {
  // Repeat the reviews until the row is wide enough to fill the screen.
  const repeats = Math.max(1, Math.ceil(MIN_CARDS_PER_ROW / reviews.length));
  const base = Array.from({ length: repeats }).flatMap(() => reviews);
  // Seconds per loop: longer lists take longer, so the speed stays similar.
  const duration = base.length * 4;

  return (
    <div className="overflow-hidden" style={{ maskImage: MASK, WebkitMaskImage: MASK }}>
      <div
        className="dt-marquee flex w-max py-2"
        style={{
          animation: `${reverse ? 'dt-scroll-right' : 'dt-scroll-left'} ${duration}s linear infinite`,
        }}
      >
        {/* Two identical halves: moving -50% loops seamlessly */}
        {[0, 1].map((copy) =>
          base.map((r, i) => <ReviewCard key={`${copy}-${r._id}-${i}`} review={r} />)
        )}
      </div>
    </div>
  );
}

export default function Reviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    api
      .get('/reviews')
      .then(({ data }) => setData(data))
      .catch(() => setData({ reviews: [], average: 0, count: 0 }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleWrite = () => (user ? setModalOpen(true) : navigate('/login'));
  const reviews = data?.reviews || [];

  return (
    <section id="reviews" className="relative py-24">
      <style>{MARQUEE_CSS}</style>

      <div className="mx-auto mb-12 flex max-w-7xl flex-col items-center gap-5 px-6 text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">What teams say about DevTrack</h2>

        {data?.count > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold text-gradient">{data.average.toFixed(1)}</span>
              <span className="text-ink-500">/ 5</span>
            </div>
            <StarRating value={data.average} size={18} />
            <p className="text-sm text-ink-500">
              Based on {data.count} review{data.count === 1 ? '' : 's'}
            </p>
          </div>
        ) : (
          data && <p className="max-w-md text-ink-400">No reviews yet. Be the first to share your experience.</p>
        )}

        <button type="button" onClick={handleWrite} className="btn-ghost">
          <PenLine size={16} /> Write a review
        </button>
      </div>

      {reviews.length > 0 && (
        <div className="space-y-6">
          <ReviewRow reviews={reviews} />
          <ReviewRow reviews={[...reviews].reverse()} reverse />
        </div>
      )}

      <WriteReviewModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </section>
  );
}
