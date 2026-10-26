import mongoose from 'mongoose';

// A short-lived 6-digit email verification code. One active code per user.
// The code is stored only as a keyed hash, never in plain text.
const otpCodeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  // MongoDB deletes the document automatically once this time passes
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export default mongoose.model('OtpCode', otpCodeSchema);
