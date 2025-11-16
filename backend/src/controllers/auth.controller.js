import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../utils/jwt.js';

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });

    const token = signToken({ sub: user._id.toString(), email: user.email });
    return res.status(201).json({ token, user: user.toPublicJSON() });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Daily login streak update
    user.stats = user.stats || {};
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(now);
    const lastLogin = user.lastLoginAt ? startOfDay(new Date(user.lastLoginAt)) : null;
    if (!lastLogin) {
      user.stats.currentStreak = Number(user.stats.currentStreak || 0) + 1;
    } else {
      const diffDays = Math.round((today - lastLogin) / (24*60*60*1000));
      if (diffDays === 1) {
        user.stats.currentStreak = Number(user.stats.currentStreak || 0) + 1;
      } else if (diffDays > 1) {
        user.stats.currentStreak = 1;
      }
    }
    user.stats.maxStreak = Math.max(Number(user.stats.maxStreak || 0), Number(user.stats.currentStreak || 0));
    user.lastLoginAt = now;
    await user.save();

    const token = signToken({ sub: user._id.toString(), email: user.email });
    return res.json({ token, user: user.toPublicJSON() });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'Not found' });
    // Optional: keep streak consistent on profile fetch if a new day passed without login endpoint
    try {
      user.stats = user.stats || {};
      const now = new Date();
      const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const today = startOfDay(now);
      const lastLogin = user.lastLoginAt ? startOfDay(new Date(user.lastLoginAt)) : null;
      if (!lastLogin || Math.round((today - lastLogin) / (24*60*60*1000)) >= 1) {
        // Do not automatically bump here, only update lastLoginAt to today to avoid double counting via /login
        user.lastLoginAt = now;
        await user.save();
      }
    } catch (_) {}
    return res.json(user.toPublicJSON());
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
