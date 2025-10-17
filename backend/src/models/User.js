import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    stats: {
      totalSolved: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
      maxStreak: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      rank: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

UserSchema.methods.toPublicJSON = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    joinedAt: this.joinedAt,
    stats: this.stats,
  };
};

export const User = mongoose.model('User', UserSchema);
