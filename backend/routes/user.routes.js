import { Router } from 'express';
import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import Review from '../models/Review.model.js';
import Story from '../models/Story.model.js';
import Task from '../models/Task.model.js';
import { Notification, Announcement, Deployment } from '../models/Misc.models.js';
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

/** Data access: download everything DevTrack holds about the signed-in user as JSON. */
router.get('/me/export', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [projects, stories, tasks, reviews, notifications] = await Promise.all([
      Project.find({ $or: [{ owner: userId }, { 'members.user': userId }] }).lean(),
      Story.find({ $or: [{ author: userId }, { reporter: userId }, { assignee: userId }] }).lean(),
      Task.find({ $or: [{ author: userId }, { assignee: userId }] }).lean(),
      Review.find({ user: userId }).lean(),
      Notification.find({ recipient: userId }).lean(),
    ]);

    res.setHeader('Content-Disposition', 'attachment; filename="devtrack-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile: {
        name: req.user.name,
        email: req.user.email,
        jobTitle: req.user.jobTitle,
        avatarUrl: req.user.avatarUrl,
        systemRole: req.user.systemRole,
        createdAt: req.user.createdAt,
        lastLoginAt: req.user.lastLoginAt,
      },
      projects,
      stories,
      tasks,
      reviews,
      notifications,
    });
  } catch (err) {
    next(err);
  }
});

/** Right to erasure: permanently delete the signed-in user's account and personal data. */
router.delete('/me', async (req, res, next) => {
  try {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ message: 'Type DELETE to confirm account deletion' });
    }

    const userId = req.user._id;

    // Block deletion while the user still owns projects, so team data isn't lost by accident.
    const owned = await Project.find({ owner: userId }).select('name').lean();
    if (owned.length) {
      return res.status(409).json({
        message: 'Transfer ownership or archive your projects before deleting your account',
        projects: owned.map((p) => p.name),
      });
    }

    await Promise.all([
      Project.updateMany({ 'members.user': userId }, { $pull: { members: { user: userId } } }),
      Story.updateMany({ assignee: userId }, { $set: { assignee: null } }),
      Task.updateMany({ assignee: userId }, { $set: { assignee: null } }),
      Review.deleteOne({ user: userId }),
      Notification.deleteMany({ recipient: userId }),
      Announcement.deleteMany({ postedBy: userId }),
      Deployment.updateMany({ triggeredBy: userId }, { $unset: { triggeredBy: 1 } }),
      User.deleteOne({ _id: userId }),
    ]);

    res.json({ message: 'Your account has been deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
