import { User } from '../models/User.js';

export const getStats = async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeCompetitors = await User.countDocuments({ 'stats.totalScore': { $gt: 0 } });
  const topUser = await User.findOne().sort({ 'stats.totalScore': -1 }).lean();
  const topScore = topUser?.stats?.totalScore || 0;
  return res.json({ totalUsers, activeCompetitors, topScore });
};

export const getGlobal = async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
  const skip = (page - 1) * limit;

  const total = await User.countDocuments();
  const users = await User.find({}, { username: 1, stats: 1 }).sort({ 'stats.totalScore': -1 }).skip(skip).limit(limit).lean();

  // Compute ranks based on page
  const startRank = skip + 1;
  const ranked = users.map((u, idx) => ({
    rank: startRank + idx,
    username: u.username,
    score: u.stats?.totalScore || 0,
    problemsSolved: u.stats?.totalSolved || 0,
    streak: u.stats?.currentStreak || 0,
    accuracy: u.stats?.accuracy || 0,
  }));

  return res.json({ total, users: ranked, page, limit });
};
