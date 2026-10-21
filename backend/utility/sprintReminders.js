import Sprint from '../models/Sprint.model.js';
import Project from '../models/Project.model.js';
import { Notification } from '../models/Misc.models.js';

const HOUR = 60 * 60 * 1000;

/** Notify every member of a project when one of its active sprints ends within 24 hours. */
export const sendSprintDeadlineReminders = async () => {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * HOUR);
  const sprints = await Sprint.find({ status: 'Active', endDate: { $gte: now, $lte: soon } }).lean();

  for (const sprint of sprints) {
    const project = await Project.findById(sprint.project).select('name owner members.user').lean();
    if (!project) continue;

    const recipients = [...new Set([String(project.owner), ...project.members.map((m) => String(m.user))])];
    const message = `Sprint "${sprint.name}" in ${project.name} ends within 24 hours`;
    const link = `/dashboard/projects/${project._id}/sprints`;
    const since = new Date(now.getTime() - 48 * HOUR);

    for (const recipient of recipients) {
      // Don't send the same reminder twice within 48 hours
      const exists = await Notification.exists({ recipient, type: 'sprint', message, createdAt: { $gte: since } });
      if (!exists) {
        await Notification.create({ recipient, type: 'sprint', message, link });
      }
    }
  }
};

export const startSprintReminders = () => {
  sendSprintDeadlineReminders().catch(() => {});
  setInterval(() => sendSprintDeadlineReminders().catch(() => {}), 6 * HOUR);
};
