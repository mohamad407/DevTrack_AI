import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import StarRating from '../common/StarRating.jsx';

const LABELS = ['Tap a star to rate', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function WriteReviewModal({ open, onClose, onSaved }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Please choose a star rating');
      return;
    }
    setSaving(true);
    try {
      await api.post('/reviews', { rating, comment });
      toast.success('Thanks for your review!');
      setRating(0);
      setComment('');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-panel w-full max-w-md space-y-5 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="review-title" className="font-display text-lg font-semibold">Rate DevTrack AI</h3>
                <p className="mt-1 text-sm text-ink-400">Your review appears on the home page. You can update it anytime.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-white/[0.06] hover:text-ink-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-5">
              <StarRating value={rating} onChange={setRating} size={32} />
              <p className="text-sm text-ink-400">{LABELS[rating]}</p>
            </div>

            <div>
              <label htmlFor="review-comment" className="mb-2 block text-sm font-medium text-ink-300">
                Comment <span className="text-ink-500">(optional)</span>
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="What do you like most about DevTrack AI?"
                className="input-glass resize-none"
              />
              <p className="mt-1 text-right text-xs text-ink-500">{comment.length}/500</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm disabled:opacity-60">
                {saving && <Loader2 size={16} className="animate-spin" />}
                Submit review
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
