import { Router } from 'express';
import Sprint from '../models/Sprint.model.js';
import Story from '../models/Story.model.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

router.post('/', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const { name, goal, startDate, endDate } = req.body;
    const sprint = await Sprint.create({ project: req.project._id, name, goal, startDate, endDate });
    res.status(201).json({ sprint });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireProjectRole([]), async (req, res, next) => {
  try {
    const sprints = await Sprint.find({ project: req.project._id }).sort('-startDate');
    res.json({ sprints });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    const sprint = await Sprint.findOne({ _id: req.params.id, project: req.project._id });
    const stories = await Story.find({ sprint: sprint._id }).populate('assignee', 'name avatarUrl');
    res.json({ sprint, stories });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const sprint = await Sprint.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      req.body,
      { new: true }
    );
    // Notify connected clients (e.g. Kanban board) that this sprint's status changed —
    // most importantly Planned -> Active, which is when its stories should appear on the board.
    req.app.get('io').to(`project:${req.project._id}`).emit('sprint:updated', sprint);
    res.json({ sprint });
  } catch (err) {
    next(err);
  }
});

// Add backlog items to a sprint.
// Guard: a Completed sprint is closed for new work — block silently-wrong assignments here too,
// on top of the equivalent guards in backlog.routes.js, since this endpoint is a second entry point
// into the same operation (Sprint Details "add from backlog" UI).
router.post('/:id/items', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const sprint = await Sprint.findOne({ _id: req.params.id, project: req.project._id });
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
    if (sprint.status === 'Completed') {
      return res.status(400).json({ message: 'Cannot add stories to a completed sprint' });
    }

    const { storyIds } = req.body;
    await Story.updateMany(
      { _id: { $in: storyIds }, project: req.project._id },
      { $set: { sprint: req.params.id, status: 'To Do' } }
    );

    const stories = await Story.find({ _id: { $in: storyIds } }).populate('assignee', 'name avatarUrl');
    stories.forEach((s) => req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', s));

    res.json({ message: 'Stories added to sprint', stories });
  } catch (err) {
    next(err);
  }
});

// Sprint review notes
router.put('/:id/review', requireProjectRole(['Admin', 'Scrum Master']), async (req, res, next) => {
  try {
    const sprint = await Sprint.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      { review: req.body.review },
      { new: true }
    );
    res.json({ sprint });
  } catch (err) {
    next(err);
  }
});

// Sprint retrospective
router.put('/:id/retrospective', requireProjectRole([]), async (req, res, next) => {
  try {
    const { wentWell, toImprove, actionItems } = req.body;
    const sprint = await Sprint.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      { retrospective: { wentWell, toImprove, actionItems } },
      { new: true }
    );
    res.json({ sprint });
  } catch (err) {
    next(err);
  }
});

// Record today's burndown snapshot (sum of remaining story points not yet Done)
router.post('/:id/burndown/snapshot', requireProjectRole([]), async (req, res, next) => {
  try {
    const stories = await Story.find({ sprint: req.params.id, status: { $ne: 'Done' } });
    const remainingPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);

    const sprint = await Sprint.findById(req.params.id);
    sprint.burndownSnapshots.push({ date: new Date(), remainingPoints });
    await sprint.save();

    res.json({ sprint });
  } catch (err) {
    next(err);
  }
});

export default router;
