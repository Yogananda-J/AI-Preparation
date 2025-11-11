import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Challenge } from '../src/models/Challenge.js';

// Script: resync_challenges.mjs
// Reads the same source file used by ensureSeeded() (merged_problems.json -> challenges.seed.lc.json -> challenges.seed.json)
// and upserts documents into the `challenges` collection, preserving dataset order and assigning stable numId/frontendId = index+1

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_prep';

const lcPath = path.resolve(__dirname, '../src/data/challenges.seed.lc.json');
const legacyPath = path.resolve(__dirname, '../src/data/challenges.seed.json');
const mergedPath = path.resolve(__dirname, '../src/data/merged_problems.json');

const chooseSource = () => {
  if (existsSync(mergedPath)) return mergedPath;
  if (existsSync(lcPath)) return lcPath;
  if (existsSync(legacyPath)) return legacyPath;
  throw new Error('No challenge source file found (merged_problems.json or challenges.seed.lc.json or challenges.seed.json)');
};

const toSlug = (s) => (s || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const loadItems = (srcPath) => {
  const raw = readFileSync(srcPath, 'utf8');
  const parsed = JSON.parse(raw);
  // If merged_problems.json has a questions array, normalize
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  if (Array.isArray(parsed)) return parsed;
  throw new Error('Unexpected source file format');
};

const normalize = (it, idx) => {
  const numId = String(it.frontend_id ?? it.problem_id ?? it.numId ?? it.id ?? (idx + 1));
  const title = it.title || it.name || '';
  const rawSnippets = it.code_snippets || it.codeSnippets || undefined;
  const codeSnippets = rawSnippets && typeof rawSnippets === 'object'
    ? Object.fromEntries(Object.entries(rawSnippets).map(([k, v]) => {
      if (v && typeof v === 'object' && typeof v.code === 'string') return [k, v];
      if (typeof v === 'string') return [k, { name: k, code: v }];
      return [k, { name: k, code: '' }];
    }))
    : undefined;

  return {
    numId,
    title,
    difficulty: it.difficulty || 'Easy',
    category: (Array.isArray(it.topics) && it.topics.length ? it.topics[0] : it.category) || 'General',
    description: it.description || '',
    examples: it.examples || [],
    privateTests: it.private_tests || it.privateTests || it.hidden_tests || it.hiddenTests || [],
    constraints: Array.isArray(it.constraints) ? it.constraints : (it.constraints ? [it.constraints] : []),
    frontendId: String(it.frontend_id || it.frontendId || numId),
    problemId: String(it.problem_id || it.problemId || numId),
    slug: it.problem_slug || it.slug || toSlug(title),
    topics: (it.topics && it.topics.length ? it.topics : [it.category]).filter(Boolean),
    codeSnippets: codeSnippets || {},
    hints: it.hints || [],
    acceptance: it.acceptance ?? 0,
    points: it.points ?? (it.difficulty === 'Easy' ? 100 : it.difficulty === 'Medium' ? 170 : 260),
  };
};

const main = async () => {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Mongo connected');

  const src = chooseSource();
  console.log('Using source file:', src);
  const rawItems = loadItems(src);
  console.log('Loaded items:', rawItems.length);

  const ops = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    const norm = normalize(it, i);
    // ensure numId reflects 1-based index if not explicit
    norm.numId = String(norm.numId || (i + 1));
    norm.frontendId = String(norm.frontendId || norm.numId);
    norm.problemId = String(norm.problemId || norm.numId);
    ops.push({
      updateOne: {
        filter: { slug: norm.slug },
        update: { $set: norm },
        upsert: true,
      }
    });
  }

  if (ops.length) {
    console.log('Writing', ops.length, 'upserts to challenges collection...');
    const res = await Challenge.bulkWrite(ops, { ordered: false });
    console.log('Bulk write result:', res.result || res);
  }

  console.log('Resync complete. You may want to restart the backend.');
  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => { console.error(err); process.exit(1); });
