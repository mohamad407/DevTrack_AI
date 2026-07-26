import mongoose from 'mongoose';

// Added for Feature 1 / Feature 2 upgrade: backlog items now double as Kanban cards,
// so they need the same comment/attachment/activity trail Task cards had.
// Purely additive — existing Story documents just default to empty arrays.
const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileName: String,
    url: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const activitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const storySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    acceptanceCriteria: [{ type: String }],
    storyPoints: { type: Number, default: 0 },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    labels: [{ type: String }],
    status: {
      type: String,
      enum: ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'],
      default: 'Backlog',
    },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    aiGenerated: { type: Boolean, default: false },
    order: { type: Number, default: 0 }, // for backlog / column ordering
    dueDate: { type: Date },
    comments: { type: [commentSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true }
);

storySchema.index({ project: 1, status: 1 });
storySchema.index({ sprint: 1 });

export default mongoose.model('Story', storySchema);
