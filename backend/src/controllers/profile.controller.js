import { Activity } from '../models/Activity.js';
import { Submission } from '../models/Submission.js';
import { User } from '../models/User.js';

export const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const skip = (page - 1) * limit;
    const total = await Activity.countDocuments({ userId });
    const items = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const mapped = items.map((a) => ({
      id: a._id.toString(),
      date: a.createdAt,
      problem: a.challengeTitle || a.challengeId || 'Challenge',
      difficulty: a.difficulty || 'Easy',
      status: a.status || 'attempted',
      time: a.timeSpent ? Math.ceil(a.timeSpent / 60) + 'm' : '',
    }));

    return res.json({ activities: mapped, page, limit, total });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const recomputeUserStats = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const totalSubmissions = await Submission.countDocuments({ userId });
    const acceptedDistinct = await Submission.distinct('challengeId', { userId, verdict: 'Accepted' });
    const totalSolved = acceptedDistinct.length;

    user.stats.totalSubmissions = totalSubmissions;
    user.stats.totalSolved = totalSolved;
    await user.save();

    return res.json({ stats: user.stats });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getSubmissionActivity = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const skip = (page - 1) * limit;

    const total = await Submission.countDocuments({ userId });
    const items = await Submission.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const logs = items.map((s) => ({
      id: s._id.toString(),
      challengeId: s.challengeId,
      submissionTime: s.createdAt,
      status: s.verdict === 'Accepted' ? 'success' : 'failure',
      verdict: s.verdict,
      language: s.language,
      timeMs: s.timeMs,
      memoryMB: s.memoryMB,
      score: s.score,
    }));

    // Aggregate per challenge for quick stats
    const summaries = {};
    for (const s of items) {
      const key = s.challengeId;
      if (!summaries[key]) {
        summaries[key] = { challengeId: key, total: 0, success: 0, failure: 0, lastSubmissionAt: s.createdAt };
      }
      summaries[key].total += 1;
      if (s.verdict === 'Accepted') summaries[key].success += 1; else summaries[key].failure += 1;
      if (s.createdAt > summaries[key].lastSubmissionAt) summaries[key].lastSubmissionAt = s.createdAt;
    }

    return res.json({ logs, summaries: Object.values(summaries), page, limit, total });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
