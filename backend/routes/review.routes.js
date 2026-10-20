import { Router } from 'express';
import Review from '../models/Review.model.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// Public: latest reviews plus overall average. Only the display name is exposed, never email or user id.
router.get('/', async (req, res, next) => {
  try {
    const [reviews, stats] = await Promise.all([
      Review.find().sort('-createdAt').limit(12).select('name rating comment createdAt').lean(),
      Review.aggregate([{ $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    ]);

    res.json({
      reviews,
      average: stats[0] ? Math.round(stats[0].average * 10) / 10 : 0,
      count: stats[0]?.count || 0,
    });
  } catch (err) {
    next(err);
  }
});

// Logged-in users: create or update their own review.
router.post('/', protect, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
    }

    const review = await Review.findOneAndUpdate(
      { user: req.user._id },
      { name: (req.user.name || 'DevTrack user').slice(0, 80), rating, comment },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
});

export default router;
