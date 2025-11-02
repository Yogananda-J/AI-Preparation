import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true }, // e.g., 'challenge_submit', 'challenge_run'
    challengeId: { type: String },
    challengeTitle: { type: String },
    difficulty: { type: String },
    status: { type: String }, // e.g., 'solved', 'attempted'
    timeSpent: { type: Number, default: 0 }, // seconds
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

ActivitySchema.index({ userId: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', ActivitySchema);
