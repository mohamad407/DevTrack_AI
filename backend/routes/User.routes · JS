import { Router } from 'express';
import User from '../models/User.model.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.put('/me', async (req, res, next) => {
  try {
    const { name, jobTitle, avatarUrl } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name, jobTitle, avatarUrl } },
      { new: true, runValidators: true }
    );
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    const users = await User.find({
      $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }],
    }).limit(10).select('name email avatarUrl jobTitle');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

export default router;
