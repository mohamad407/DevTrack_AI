import { Router } from 'express';
import Story from '../models/Story.model.js';
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
    });
    res.status(201).json({ story });
  } catch (err) {
    next(err);
  }
});

// List backlog (project query param required, filters via query string)
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
      .sort('order -priority');
    res.json({ stories });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    const story = await Story.findOneAndUpdate(
      { _id: req.params.id, project: req.project._id },
      req.body,
      { new: true }
    );
    res.json({ story });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    await Story.deleteOne({ _id: req.params.id, project: req.project._id });
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

export default router;
