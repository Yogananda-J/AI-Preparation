import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Challenge } from '../src/models/Challenge.js';
import { Submission } from '../src/models/Submission.js';
import { Activity } from '../src/models/Activity.js';

const users = [
  { username: 'Alice', email: 'alice@example.com', password: 'alice123' },
  { username: 'Bob', email: 'bob@example.com', password: 'bob123' },
  { username: 'Charlie', email: 'charlie@example.com', password: 'charlie123' },
  { username: 'Diana', email: 'diana@example.com', password: 'diana123' },
  { username: 'Ethan', email: 'ethan@example.com', password: 'ethan123' },
];

const challenges = [
  { numId: '1', title: 'Two Sum', difficulty: 'Easy', category: 'Array', points: 100 },
  { numId: '2', title: 'Reverse Linked List', difficulty: 'Easy', category: 'Linked List', points: 120 },
  { numId: '3', title: 'Group Anagrams', difficulty: 'Medium', category: 'String', points: 170 },
  { numId: '4', title: '3Sum', difficulty: 'Medium', category: 'Array', points: 180 },
  { numId: '5', title: 'Word Break', difficulty: 'Medium', category: 'DP', points: 200 },
];

const langs = ['javascript', 'python', 'java', 'cpp'];

async function upsertChallenges() {
  for (const c of challenges) {
    await Challenge.updateOne(
      { numId: c.numId },
      { $setOnInsert: { ...c, acceptance: 0, description: '' } },
      { upsert: true }
    );
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function seed() {
  await connectDB();

  await upsertChallenges();
  const challengeDocs = await Challenge.find({ numId: { $in: challenges.map(c => c.numId) } }, { _id: 1, numId: 1, title: 1, difficulty: 1 });
  const chByNum = Object.fromEntries(challengeDocs.map(d => [String(d.numId), d]));

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    // upsert user
    let userDoc = await User.findOne({ email: u.email });
    if (!userDoc) {
      userDoc = await User.create({ username: u.username, email: u.email, passwordHash: hash, joinedAt: new Date(Date.now() - 1000*60*60*24*30) });
    } else {
      userDoc.username = u.username;
      userDoc.passwordHash = hash;
      await userDoc.save();
    }

    // create some submissions and activities
    const toCreate = [
      { numId: '1', verdict: 'Accepted', timeMs: 12_000, score: 100, language: pick(langs) },
      { numId: '2', verdict: 'Accepted', timeMs: 10_000, score: 120, language: pick(langs) },
      { numId: '3', verdict: 'Accepted', timeMs: 32_000, score: 170, language: pick(langs) },
      { numId: '4', verdict: 'Accepted', timeMs: 39_000, score: 180, language: pick(langs) },
      { numId: '5', verdict: 'Accepted', timeMs: 41_000, score: 200, language: pick(langs) },
    ];

    let totalSolved = 0; let totalScore = 0; let currentStreak = 0; let maxStreak = 0;
    const today = new Date();
    let streakCounter = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const entry = toCreate[i];
      const ch = chByNum[entry.numId];
      if (!ch) continue;
      const createdAt = new Date(today.getTime() - (toCreate.length - i) * 24*60*60*1000);

      await Submission.create({
        userId: userDoc._id.toString(),
        challengeId: ch._id.toString(),
        language: entry.language,
        code: `// solution for ${ch.title}`,
        verdict: 'Accepted',
        status: 'DONE',
        timeMs: entry.timeMs,
        memoryMB: 64,
        score: entry.score,
        caseResults: [],
        createdAt,
        updatedAt: createdAt,
      });

      await Activity.create({
        userId: userDoc._id.toString(),
        type: 'challenge_submit',
        challengeId: ch._id.toString(),
        challengeTitle: ch.title,
        difficulty: ch.difficulty,
        status: 'solved',
        timeSpent: Math.floor(entry.timeMs/1000),
        createdAt,
        updatedAt: createdAt,
      });

      totalSolved += 1; totalScore += entry.score;
      streakCounter += 1; currentStreak = streakCounter; if (currentStreak > maxStreak) maxStreak = currentStreak;
    }

    userDoc.stats.totalSolved = totalSolved;
    userDoc.stats.totalSubmissions = toCreate.length;
    userDoc.stats.currentStreak = currentStreak;
    userDoc.stats.maxStreak = maxStreak;
    userDoc.stats.totalScore = totalScore;
    userDoc.stats.rank = Math.max(1, 100 - totalScore % 100);
    userDoc.stats.accuracy = 100;
    userDoc.lastSolvedAt = new Date();
    await userDoc.save();
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

seed().catch(async (e) => {
  console.error('Seed failed:', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
