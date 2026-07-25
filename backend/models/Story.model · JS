import mongoose from 'mongoose';

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
  },
  { timestamps: true }
);

storySchema.index({ project: 1, status: 1 });
storySchema.index({ sprint: 1 });

export default mongoose.model('Story', storySchema);
