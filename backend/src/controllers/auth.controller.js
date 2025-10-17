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
    return res.json(user.toPublicJSON());
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
