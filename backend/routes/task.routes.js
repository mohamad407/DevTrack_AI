import { Router } from 'express';
import Task from '../models/Task.model.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

router.post('/', requireProjectRole([]), async (req, res, next) => {
  try {
    const task = await Task.create({
      ...req.body,
      project: req.project._id,
      activity: [{ actor: req.user._id, action: 'created this task' }],
    });
    req.app.get('io').to(`project:${req.project._id}`).emit('task:created', task);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireProjectRole([]), async (req, res, next) => {
  try {
    const { sprint } = req.query;
    const filter = { project: req.project._id };
    if (sprint) filter.sprint = sprint;
    const tasks = await Task.find(filter).populate('assignee', 'name avatarUrl').sort('status order');
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// Move / update a task (drag-and-drop column change, reordering, edits)
router.put('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, project: req.project._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const prevStatus = task.status;
    Object.assign(task, req.body);

    if (req.body.status && req.body.status !== prevStatus) {
      task.activity.push({ actor: req.user._id, action: `moved from ${prevStatus} to ${req.body.status}` });
    }
    await task.save();

    req.app.get('io').to(`project:${req.project._id}`).emit('task:updated', task);
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireProjectRole([]), async (req, res, next) => {
  try {
    await Task.deleteOne({ _id: req.params.id, project: req.project._id });
    req.app.get('io').to(`project:${req.project._id}`).emit('task:deleted', { id: req.params.id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// Comments
router.post('/:id/comments', requireProjectRole([]), async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, project: req.project._id });
    task.comments.push({ author: req.user._id, text: req.body.text });
    task.activity.push({ actor: req.user._id, action: 'added a comment' });
    await task.save();
    req.app.get('io').to(`project:${req.project._id}`).emit('task:updated', task);
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// Attachments (expects file already uploaded to storage; this stores metadata)
router.post('/:id/attachments', requireProjectRole([]), async (req, res, next) => {
  try {
    const { fileName, url } = req.body;
    const task = await Task.findOne({ _id: req.params.id, project: req.project._id });
    task.attachments.push({ fileName, url, uploadedBy: req.user._id });
    task.activity.push({ actor: req.user._id, action: `attached ${fileName}` });
    await task.save();
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

export default router;
