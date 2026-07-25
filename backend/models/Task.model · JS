import mongoose from 'mongoose';

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
    action: { type: String, required: true }, // e.g. "moved to In Progress", "assigned to Jane"
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', default: null },
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'],
      default: 'To Do',
    },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date },
    order: { type: Number, default: 0 },
    comments: [commentSchema],
    attachments: [attachmentSchema],
    activity: [activitySchema],
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1, order: 1 });

export default mongoose.model('Task', taskSchema);
