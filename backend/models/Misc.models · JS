import mongoose from 'mongoose';

// ---- DevOps: Deployment / Build history ----
const deploymentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    environment: { type: String, enum: ['Development', 'Testing', 'Production'], required: true },
    status: { type: String, enum: ['queued', 'running', 'success', 'failed'], default: 'queued' },
    commitSha: { type: String, default: '' },
    branch: { type: String, default: 'main' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    logs: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0 },
    dockerImage: { type: String, default: '' },
  },
  { timestamps: true }
);

// ---- Announcements (Admin panel) ----
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ---- Notifications ----
const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['mention', 'assignment', 'sprint', 'deployment', 'system', 'invite'],
      default: 'system',
    },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Deployment = mongoose.model('Deployment', deploymentSchema);
export const Announcement = mongoose.model('Announcement', announcementSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
