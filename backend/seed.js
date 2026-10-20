/**
 * Seeds a demo admin user, project, sprint, and a few stories/tasks.
 * Run with: npm run seed  (after setting MONGO_URI in .env)
 */
import 'dotenv/config';
import connectDB from '../config/db.js';
import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import Sprint from '../models/Sprint.model.js';
import Story from '../models/Story.model.js';
import Task from '../models/Task.model.js';

const run = async () => {
  await connectDB();

  const admin = await User.findOneAndUpdate(
    { email: 'admin@devtrack.ai' },
    { name: 'Ava Admin', email: 'admin@devtrack.ai', isEmailVerified: true, systemRole: 'admin' },
    { upsert: true, new: true }
  );

  const project = await Project.findOneAndUpdate(
    { key: 'DTA' },
    {
      name: 'DevTrack AI Platform',
      key: 'DTA',
      description: 'The DevTrack AI product itself, dogfooded.',
      owner: admin._id,
      members: [{ user: admin._id, role: 'Admin' }],
    },
    { upsert: true, new: true }
  );

  const sprint = await Sprint.findOneAndUpdate(
    { project: project._id, name: 'Sprint 1' },
    {
      project: project._id,
      name: 'Sprint 1',
      goal: 'Ship the Kanban board and burndown chart',
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 86400000),
      status: 'Active',
      burndownSnapshots: [{ date: new Date(), remainingPoints: 34 }],
    },
    { upsert: true, new: true }
  );

  const stories = [
    { title: 'As a PO, I want AI-generated user stories', storyPoints: 5, priority: 'High', status: 'In Progress' },
    { title: 'As a dev, I want a drag-and-drop Kanban board', storyPoints: 8, priority: 'Critical', status: 'To Do' },
    { title: 'As a scrum master, I want a live burndown chart', storyPoints: 5, priority: 'Medium', status: 'Backlog' },
  ];

  for (const s of stories) {
    await Story.findOneAndUpdate(
      { project: project._id, title: s.title },
      { ...s, project: project._id, sprint: sprint._id, reporter: admin._id },
      { upsert: true }
    );
  }

  await Task.findOneAndUpdate(
    { project: project._id, title: 'Wire Socket.io to Kanban board' },
    {
      project: project._id,
      sprint: sprint._id,
      title: 'Wire Socket.io to Kanban board',
      status: 'In Progress',
      priority: 'High',
      activity: [{ actor: admin._id, action: 'created this task' }],
    },
    { upsert: true }
  );

  console.log('✅ Seed complete. Admin user: admin@devtrack.ai');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
