import { Router } from 'express';
import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import { Announcement } from '../models/Misc.models.js';
import { protect, requireSystemAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect, requireSystemAdmin);

// ---- Users ----
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().sort('-createdAt');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/status', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/role', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { systemRole: req.body.systemRole }, { new: true });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// ---- Projects (platform-wide oversight) ----
router.get('/projects', async (req, res, next) => {
  try {
    const projects = await Project.find().populate('owner', 'name email').sort('-createdAt');
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

// ---- Platform analytics ----
router.get('/analytics/overview', async (req, res, next) => {
  try {
    const [totalUsers, totalProjects, activeUsers] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ]);
    res.json({ totalUsers, totalProjects, activeUsers });
  } catch (err) {
    next(err);
  }
});

// ---- Announcements ----
router.post('/announcements', async (req, res, next) => {
  try {
    const announcement = await Announcement.create({ ...req.body, postedBy: req.user._id });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
});

router.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await Announcement.find().sort('-createdAt');
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

router.put('/announcements/:id', async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
});

export default router;
