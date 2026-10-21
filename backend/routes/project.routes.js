import { Router } from 'express';
import Project from '../models/Project.model.js';
import User from '../models/User.model.js';
import Story from '../models/Story.model.js';
import { Notification } from '../models/Misc.models.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';
import { pick } from '../utility/security.js';

const ROLES = ['Admin', 'Scrum Master', 'Developer', 'Tester', 'Product Owner'];
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

// Starter setups for new projects. Statuses must be values the Story model allows.
const TEMPLATES = {
  scrum: {
    kanbanColumns: ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'],
    stories: [
      { title: 'Set up the repository and CI pipeline', status: 'To Do', priority: 'High', storyPoints: 3, labels: ['setup'], acceptanceCriteria: ['Repository is shared with the team', 'Pipeline runs on every push'] },
      { title: 'Design the first user flow', status: 'Backlog', priority: 'Medium', storyPoints: 5, labels: ['design'], acceptanceCriteria: ['Flow is reviewed by the Product Owner'] },
      { title: 'Agree on the Definition of Done', status: 'Backlog', priority: 'Medium', storyPoints: 1, labels: ['process'], acceptanceCriteria: ['Team agrees on the checklist'] },
    ],
  },
  kanban: {
    kanbanColumns: ['Backlog', 'To Do', 'In Progress', 'Testing', 'Done'],
    stories: [
      { title: 'Map the current workflow', status: 'To Do', priority: 'High', labels: ['process'] },
      { title: 'Set a work-in-progress limit per column', status: 'Backlog', priority: 'Medium', labels: ['process'] },
      { title: 'Review blocked items every morning', status: 'Backlog', priority: 'Low', labels: ['routine'] },
    ],
  },
  bug: {
    kanbanColumns: ['Backlog', 'To Do', 'In Progress', 'Testing', 'Done'],
    stories: [
      { title: 'Login fails after password reset', status: 'To Do', priority: 'Critical', labels: ['bug'], acceptanceCriteria: ['Steps to reproduce are recorded', 'Fix is verified on staging'] },
      { title: 'Dashboard loads slowly on mobile', status: 'Backlog', priority: 'High', labels: ['bug', 'performance'] },
      { title: 'Typo on the signup page', status: 'Backlog', priority: 'Low', labels: ['bug', 'ui'] },
    ],
  },
};

const router = Router();
router.use(protect);

// Create project (optionally from a template)
router.post('/', async (req, res, next) => {
  try {
    const { name, key, description } = req.body;
    const template = req.body.template || 'blank';
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'Project name is required' });
    if (template !== 'blank' && (typeof template !== 'string' || !TEMPLATES[template])) {
      return res.status(400).json({ message: 'Unknown project template' });
    }

    const starter = template === 'blank' ? null : TEMPLATES[template];
    const project = await Project.create({
      name,
      key: key || name.slice(0, 3).toUpperCase(),
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'Admin' }],
      ...(starter ? { kanbanColumns: starter.kanbanColumns } : {}),
    });

    if (starter) {
      await Story.insertMany(
        starter.stories.map((s, i) => ({
          ...s,
          project: project._id,
          reporter: req.user._id,
          order: i,
          storyPoints: s.storyPoints ?? 0,
          acceptanceCriteria: s.acceptanceCriteria ?? [],
          labels: s.labels ?? [],
        }))
      );
    }

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
    const patch = pick(req.body, ['name', 'description', 'githubRepo', 'status']); // only fields actually sent (old code wiped the rest to undefined)
    // githubRepo is interpolated into GitHub API URLs using the server token: must be strictly owner/repo
    if (patch.githubRepo !== undefined && patch.githubRepo !== '' && !REPO_RE.test(String(patch.githubRepo))) {
      return res.status(400).json({ message: 'Repository must look like owner/repo' });
    }
    Object.assign(req.project, patch);
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
    if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ message: 'email is required' });
    if (role && !ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    // A Scrum Master must not be able to mint new project Admins (privilege escalation)
    if (role === 'Admin' && req.projectRole !== 'Admin') return res.status(403).json({ message: 'Only a project Admin can grant the Admin role' });
    const invitedUser = await User.findOne({ email: email.toLowerCase().trim() });
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
    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
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
