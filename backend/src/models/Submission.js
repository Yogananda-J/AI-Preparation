import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: false, index: true },
    challengeId: { type: String, required: true, index: true },
    language: { type: String, required: true },
    code: { type: String, required: true },
    verdict: { type: String, enum: ['AC', 'PA', 'WA', 'TLE', 'RE', 'CE', 'Accepted', 'Partially Accepted', 'Wrong Answer', 'Time Limit', 'Runtime Error'], required: true },
    status: { type: String, enum: ['QUEUED', 'PROCESSING', 'DONE', 'ERROR'], default: 'QUEUED', index: true },
    timeMs: { type: Number, default: 0 },
    memoryMB: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    caseResults: { type: Array, default: [] },
  },
  { timestamps: true }
);

SubmissionSchema.index({ userId: 1, challengeId: 1, createdAt: -1 });

export const Submission = mongoose.model('Submission', SubmissionSchema);
