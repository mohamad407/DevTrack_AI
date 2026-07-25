import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['Admin', 'Scrum Master', 'Developer', 'Tester', 'Product Owner'],
      default: 'Developer',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true }, // e.g. "DTA" for ticket ids
    description: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    kanbanColumns: {
      type: [String],
      default: ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'],
    },
    githubRepo: { type: String, default: '' }, // "owner/repo"
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

projectSchema.index({ owner: 1 });
projectSchema.index({ 'members.user': 1 });

export default mongoose.model('Project', projectSchema);
