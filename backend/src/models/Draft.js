import mongoose from 'mongoose';

const DraftSchema = new mongoose.Schema(
  {
    challengeId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    code: { type: String, required: true },
    language: { type: String, required: true },
  },
  { timestamps: true }
);

DraftSchema.index({ challengeId: 1, userId: 1 }, { unique: true, sparse: true });

export const Draft = mongoose.model('Draft', DraftSchema);
