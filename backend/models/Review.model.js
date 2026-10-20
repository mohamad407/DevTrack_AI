import mongoose from 'mongoose';

// One review per user (upserted on re-submit). Shown publicly on the landing page.
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

reviewSchema.index({ createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
