import { Router } from 'express';
import Project from '../models/Project.model.js';
import User from '../models/User.model.js';
import { Notification } from '../models/Misc.models.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Create project
router.post('/', async (req, res, next) => {
  try {
    const { name, key, description } = req.body;
    const project = await Project.create({
      name,
      key: key || name.slice(0, 3).toUpperCase(),
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'Admin' }],
    });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

// List projects the user belongs to
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    }).populate('members.user', 'name email avatarUrl').sort('-createdAt');
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId', requireProjectRole([]), async (req, res) => {
  await req.project.populate('members.user', 'name email avatarUrl jobTitle');
  res.json({ project: req.project, role: req.projectRole });
});

router.put('/:projectId', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    const { name, description, githubRepo, status } = req.body;
    Object.assign(req.project, { name, description, githubRepo, status });
    await req.project.save();
    res.json({ project: req.project });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    await req.project.deleteOne();
    res.json({ message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
});

// Invite member by email
router.post('/:projectId/invite', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const invitedUser = await User.findOne({ email: email.toLowerCase() });
    if (!invitedUser) return res.status(404).json({ message: 'No user found with that email. They must sign up first.' });

    const alreadyMember = req.project.members.some((m) => m.user.toString() === invitedUser._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'User is already a member' });

    req.project.members.push({ user: invitedUser._id, role: role || 'Developer' });
    await req.project.save();

    await Notification.create({
      recipient: invitedUser._id,
      type: 'invite',
      message: `You were added to project "${req.project.name}" as ${role || 'Developer'}`,
      link: `/dashboard/projects/${req.project._id}`,
    });

    res.json({ project: req.project });
  } catch (err) {
    next(err);
  }
});

// Change a member's role
router.put('/:projectId/members/:userId/role', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    const { role } = req.body;
    const member = req.project.members.find((m) => m.user.toString() === req.params.userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    member.role = role;
    await req.project.save();
    res.json({ project: req.project });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId/members/:userId', requireProjectRole(['Admin']), async (req, res, next) => {
  try {
    req.project.members = req.project.members.filter((m) => m.user.toString() !== req.params.userId);
    await req.project.save();
    res.json({ project: req.project });
  } catch (err) {
    next(err);
  }
});

export default router;
