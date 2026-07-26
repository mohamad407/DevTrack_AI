import { Router } from 'express';
import Story from '../models/Story.model.js';
import Sprint from '../models/Sprint.model.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Create story
router.post('/', requireProjectRole([]), async (req, res, next) => {
  try {
    const { title, description, acceptanceCriteria, storyPoints, priority, labels, aiGenerated } = req.body;
    const story = await Story.create({
      project: req.project._id,
      title,
      description,
      acceptanceCriteria,
      storyPoints,
      priority,
      labels,
      aiGenerated: !!aiGenerated,
      reporter: req.user._id,
      activity: [{ actor: req.user._id, action: 'created this story' }],
    });
    req.app.get('io').to(`project:${req.project._id}`).emit('story:created', story);
    res.status(201).json({ story });
  } catch (err) {
    next(err);
  }
});

// List backlog (project query param required, filters via query string).
// Pass sprint=none to get only unassigned Product Backlog items (used by BacklogPage),
// or sprint=<sprintId> to get the items inside a specific sprint (used by SprintsPage / KanbanPage).
router.get('/', requireProjectRole([]), async (req, res, next) => {
  try {
    const { sprint, status, priority, search } = req.query;
    const filter = { project: req.project._id };
    if (sprint) filter.sprint = sprint === 'none' ? null : sprint;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) filter.title = new RegExp(search, 'i');

    const stories = await Story.find(filter)
      .populate('assignee', 'name avatarUrl')
      .populate('sprint', 'name status')
      .sort('order -priority');
    res.json({ stories });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, project: req.project._id })
      .populate('assignee', 'name avatarUrl')
      .populate('sprint', 'name status')
      .populate('comments.author', 'name avatarUrl')
      .populate('activity.actor', 'name');
    if (!story) return res.status(404).json({ message: 'Story not found' });
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, project: req.project._id });
    if (!story) return res.status(404).json({ message: 'Story not found' });

    // Guard: block edits that move a story into (or keep it in) a Completed sprint.
    if (req.body.sprint) {
      const targetSprint = await Sprint.findById(req.body.sprint);
      if (targetSprint?.status === 'Completed') {
        return res.status(400).json({ message: 'Cannot add stories to a completed sprint' });
      }
    }

    const prevStatus = story.status;
    Object.assign(story, req.body);

    if (req.body.status && req.body.status !== prevStatus) {
      story.activity.push({ actor: req.user._id, action: `moved from ${prevStatus} to ${req.body.status}` });
    }
    if (req.body.assignee) {
      story.activity.push({ actor: req.user._id, action: 'assignee updated' });
    }
    await story.save();

    req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', story);
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    await Story.deleteOne({ _id: req.params.id, project: req.project._id });
    req.app.get('io').to(`project:${req.project._id}`).emit('story:deleted', { id: req.params.id });
    res.json({ message: 'Story deleted' });
  } catch (err) {
    next(err);
  }
});

// Reorder / prioritize backlog (drag reorder or AI prioritization result)
router.put('/reorder/bulk', requireProjectRole([]), async (req, res, next) => {
  try {
    const { orderedIds } = req.body; // array of story ids in new order
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { order: index } },
    }));
    await Story.bulkWrite(bulkOps);
    res.json({ message: 'Backlog reordered' });
  } catch (err) {
    next(err);
  }
});

// ---- Feature 1: Sprint assignment ----

// Assign a single backlog item to a sprint (drag-and-drop / single "Assign to Sprint" button).
// Setting the story's sprint automatically removes it from the unassigned Product Backlog view
// (which queries sprint=none) and makes it show up in that sprint / on the Kanban board once Active.
router.put('/:id/assign-sprint', requireProjectRole([]), async (req, res, next) => {
  try {
    const { sprintId } = req.body;
    const sprint = await Sprint.findOne({ _id: sprintId, project: req.project._id });
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
    if (sprint.status === 'Completed') {
      return res.status(400).json({ message: 'Cannot add stories to a completed sprint' });
    }

    const story = await Story.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      {
        sprint: sprintId,
        status: 'To Do',
        $push: { activity: { actor: req.user._id, action: `assigned to sprint "${sprint.name}"` } },
      },
      { new: true }
    );
    if (!story) return res.status(404).json({ message: 'Story not found' });

    req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', story);
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

// Bulk-assign multiple backlog items to a sprint at once (multi-select "Assign to Sprint").
router.put('/assign-sprint/bulk', requireProjectRole([]), async (req, res, next) => {
  try {
    const { storyIds, sprintId } = req.body;
    const sprint = await Sprint.findOne({ _id: sprintId, project: req.project._id });
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
    if (sprint.status === 'Completed') {
      return res.status(400).json({ message: 'Cannot add stories to a completed sprint' });
    }

    await Story.updateMany(
      { _id: { $in: storyIds }, project: req.project._id },
      {
        sprint: sprintId,
        status: 'To Do',
        $push: { activity: { actor: req.user._id, action: `assigned to sprint "${sprint.name}"` } },
      }
    );

    const stories = await Story.find({ _id: { $in: storyIds } }).populate('assignee', 'name avatarUrl');
    stories.forEach((s) => req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', s));
    res.json({ stories, message: `${storyIds.length} stories assigned to ${sprint.name}` });
  } catch (err) {
    next(err);
  }
});

// Unassign a story back to the Product Backlog (sprint = null, status reset to Backlog).
router.put('/:id/unassign-sprint', requireProjectRole([]), async (req, res, next) => {
  try {
    const story = await Story.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      {
        sprint: null,
        status: 'Backlog',
        $push: { activity: { actor: req.user._id, action: 'removed from sprint, returned to backlog' } },
      },
      { new: true }
    );
    if (!story) return res.status(404).json({ message: 'Story not found' });

    req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', story);
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

// ---- Comments / attachments (Kanban card detail — Feature 2) ----

router.post('/:id/comments', requireProjectRole([]), async (req, res, next) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, project: req.project._id });
    if (!story) return res.status(404).json({ message: 'Story not found' });

    story.comments.push({ author: req.user._id, text: req.body.text });
    story.activity.push({ actor: req.user._id, action: 'added a comment' });
    await story.save();
    await story.populate('comments.author', 'name avatarUrl');

    req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', story);
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/attachments', requireProjectRole([]), async (req, res, next) => {
  try {
    const { fileName, url } = req.body;
    const story = await Story.findOne({ _id: req.params.id, project: req.project._id });
    if (!story) return res.status(404).json({ message: 'Story not found' });

    story.attachments.push({ fileName, url, uploadedBy: req.user._id });
    story.activity.push({ actor: req.user._id, action: `attached ${fileName}` });
    await story.save();

    req.app.get('io').to(`project:${req.project._id}`).emit('story:updated', story);
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

export default router;
