import { Router } from 'express';
import Sprint from '../models/Sprint.model.js';
import Story from '../models/Story.model.js';
import Task from '../models/Task.model.js';
import { Deployment } from '../models/Misc.models.js';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Sprint velocity: completed points per sprint
router.get('/:projectId/velocity', requireProjectRole([]), async (req, res, next) => {
  try {
    const sprints = await Sprint.find({ project: req.project._id, status: 'Completed' }).sort('startDate');
    const velocity = await Promise.all(
      sprints.map(async (sprint) => {
        const stories = await Story.find({ sprint: sprint._id });
        const committed = stories.reduce((s, x) => s + (x.storyPoints || 0), 0);
        const completed = stories.filter((x) => x.status === 'Done').reduce((s, x) => s + (x.storyPoints || 0), 0);
        return { sprint: sprint.name, committed, completed };
      })
    );
    res.json({ velocity });
  } catch (err) {
    next(err);
  }
});

// Burndown for a specific sprint
router.get('/:projectId/burndown/:sprintId', requireProjectRole([]), async (req, res, next) => {
  try {
    const sprint = await Sprint.findById(req.params.sprintId);
    res.json({
      ideal: computeIdealBurndown(sprint),
      actual: sprint.burndownSnapshots.map((s) => ({ date: s.date, remainingPoints: s.remainingPoints })),
    });
  } catch (err) {
    next(err);
  }
});

function computeIdealBurndown(sprint) {
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const totalPoints = sprint.burndownSnapshots[0]?.remainingPoints || 0;
  return Array.from({ length: days + 1 }, (_, i) => ({
    date: new Date(start.getTime() + i * 86400000),
    remainingPoints: Math.round(totalPoints - (totalPoints / days) * i),
  }));
}

// Team productivity: tasks completed per member (last 30 days)
router.get('/:projectId/productivity', requireProjectRole([]), async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000);
    const tasks = await Task.find({ project: req.project._id, status: 'Done', updatedAt: { $gte: since } })
      .populate('assignee', 'name avatarUrl');

    const byMember = {};
    tasks.forEach((t) => {
      const key = t.assignee?.name || 'Unassigned';
      byMember[key] = (byMember[key] || 0) + 1;
    });
    res.json({ productivity: Object.entries(byMember).map(([member, tasksCompleted]) => ({ member, tasksCompleted })) });
  } catch (err) {
    next(err);
  }
});

// Build success rate + deployment frequency
router.get('/:projectId/devops-metrics', requireProjectRole([]), async (req, res, next) => {
  try {
    const deployments = await Deployment.find({ project: req.project._id });
    const total = deployments.length || 1;
    const successful = deployments.filter((d) => d.status === 'success').length;

    const byDay = {};
    deployments.forEach((d) => {
      const day = d.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });

    res.json({
      buildSuccessRate: Math.round((successful / total) * 100),
      totalDeployments: deployments.length,
      deploymentFrequency: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    });
  } catch (err) {
    next(err);
  }
});

// Task completion rate (overall)
router.get('/:projectId/task-completion', requireProjectRole([]), async (req, res, next) => {
  try {
    const tasks = await Task.find({ project: req.project._id });
    const total = tasks.length || 1;
    const done = tasks.filter((t) => t.status === 'Done').length;
    res.json({ total: tasks.length, done, completionRate: Math.round((done / total) * 100) });
  } catch (err) {
    next(err);
  }
});

export default router;
