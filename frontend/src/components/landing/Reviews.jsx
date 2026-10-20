import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PenLine } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StarRating from '../common/StarRating.jsx';
import WriteReviewModal from './WriteReviewModal.jsx';

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';

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
    <section id="reviews" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mb-12 flex flex-col items-center gap-5 text-center">
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <motion.figure
              key={r._id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.06 }}
              className="glass-card flex flex-col justify-between gap-5 p-6"
            >
              <div className="space-y-4">
                <StarRating value={r.rating} size={15} />
                {r.comment && <blockquote className="text-sm leading-relaxed text-ink-300">“{r.comment}”</blockquote>}
              </div>
              <figcaption className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora font-display text-sm font-semibold text-white">
                  {initials(r.name)}
                </span>
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-ink-500">{format(new Date(r.createdAt), 'MMM d, yyyy')}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      )}

      <WriteReviewModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </section>
  );
}
