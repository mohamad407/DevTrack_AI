import { Router } from 'express';
import User from '../models/User.model.js';
import { protect } from '../middleware/auth.middleware.js';
import { escapeRegex, str } from '../utility/security.js';

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
    const q = str(req.query.q);
    // Require 3+ chars so this can't be used to dump the whole user/email list
    if (!q || q.trim().length < 3) return res.json({ users: [] });
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    const users = await User.find({
      status: 'active',
      $or: [{ name: rx }, { email: rx }],
    }).limit(10).select('name email avatarUrl jobTitle');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

export default router;
