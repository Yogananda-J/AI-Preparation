import mongoose from 'mongoose';

const ChallengeSchema = new mongoose.Schema(
  {
    numId: { type: String, index: true, unique: true }, // e.g., '1', '2'
    title: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    category: { type: String, required: true },
    acceptance: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    description: { type: String, default: '' },
    examples: [
      {
        input: String,
        output: String,
        explanation: String,
        images: [String],
      },
    ],
    // Hidden test cases used for final submission judging
    privateTests: [
      {
        input: String,
        output: String,
      },
    ],
    constraints: [String],
    // Optional richer fields (LeetCode-style)
    problemId: { type: String }, // internal id
    frontendId: { type: String }, // public number/id
    slug: { type: String },
    topics: [String],
    codeSnippets: { type: mongoose.Schema.Types.Mixed },
    hints: [String],
    notes: [String],
    followUps: [String],
  },
  { timestamps: true }
);

export const Challenge = mongoose.model('Challenge', ChallengeSchema);
