import { Router } from 'express';
import { Announcement } from '../models/Misc.models.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Any logged-in user: active announcements only, newest first
router.get('/', async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ active: true })
      .populate('postedBy', 'name')
      .sort('-createdAt')
      .limit(20);
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

export default router;
