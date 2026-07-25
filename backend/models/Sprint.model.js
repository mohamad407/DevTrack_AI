import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true, trim: true },
    goal: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['Planned', 'Active', 'Completed'], default: 'Planned' },
    review: { type: String, default: '' }, // Sprint Review notes
    retrospective: {
      wentWell: [{ type: String }],
      toImprove: [{ type: String }],
      actionItems: [{ type: String }],
    },
    // Daily snapshot of remaining story points, used to render the burndown chart
    burndownSnapshots: [
      {
        date: { type: Date, required: true },
        remainingPoints: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

sprintSchema.index({ project: 1, status: 1 });

export default mongoose.model('Sprint', sprintSchema);
