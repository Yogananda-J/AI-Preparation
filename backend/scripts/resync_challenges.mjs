import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Challenge } from '../src/models/Challenge.js';

// Script: resync_challenges.mjs
// Reads the same source file used by ensureSeeded() (merged_problems.json -> challenges.seed.lc.json -> challenges.seed.json)
// and upserts documents into the `challenges` collection, preserving dataset order and assigning stable numId/frontendId = index+1

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/aicodeskill';


const subsetPath = path.resolve(__dirname, '../src/data/merged_subset.json');

const chooseSource = () => {
  if (existsSync(subsetPath)) return subsetPath;
  throw new Error('No challenge source file found: expected merged_subset.json');
};

const toSlug = (s) => (s || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

// Helpers to normalize examples similar to controller
const parseExampleText = (txt) => {
  if (!txt || typeof txt !== 'string') return { input: '', output: '', explanation: '' };
  const inputMatch = txt.match(/Input\s*:\s*([\s\S]*?)(?:\n|$)/i);
  const outputMatch = txt.match(/Output\s*:\s*([\s\S]*?)(?:\n|$)/i);
  const explanationMatch = txt.match(/Explanation\s*:\s*([\s\S]*)/i);
  const input = inputMatch ? inputMatch[1].trim() : '';
  const output = outputMatch ? outputMatch[1].trim() : '';
  const explanation = explanationMatch ? explanationMatch[1].trim() : '';
  if (!input && !output && !explanation) return { input: '', output: '', explanation: txt.trim() };
  return { input, output, explanation };
};

const isJudgeSnippet = (txt) => {
  if (!txt || typeof txt !== 'string') return false;
  const t = txt.trim();
  if (/assert\s*\(/i.test(t)) return true;
  if (/for\s*\(.*;.*;.*\)/i.test(t)) return true;
  if (/(int|var|let|const)\s+\w+\s*=/.test(t)) return true;
  if (/[;{}]\s*$/.test(t) || /;\s*\n/.test(t)) return true;
  if (/remove(Element|Duplicates)|expectedNums|sort\s*\(|print\s*\(/i.test(t)) return true;
  return false;
};

const loadItems = (srcPath) => {
  const raw = readFileSync(srcPath, 'utf8');
  const parsed = JSON.parse(raw);
  // Handle various shapes
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  if (parsed && Array.isArray(parsed.problems)) return parsed.problems;
  if (Array.isArray(parsed)) return parsed;
  throw new Error('Unexpected source file format for ' + path.basename(srcPath));
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

  // Examples normalization: parse example_text and filter blanks
  const examples = Array.isArray(it.examples)
    ? it.examples
        .map((ex) => {
          if (ex && typeof ex === 'object' && typeof ex.example_text === 'string') {
            if (isJudgeSnippet(ex.example_text)) return null;
            const parsed = parseExampleText(ex.example_text);
            return { input: parsed.input, output: parsed.output, explanation: parsed.explanation, images: ex.images || [] };
          }
          if (ex && typeof ex === 'object') {
            return {
              input: (ex.input ?? '').toString(),
              output: (ex.output ?? '').toString(),
              explanation: (ex.explanation ?? '').toString(),
              images: ex.images || [],
            };
          }
          return null;
        })
        .filter(Boolean)
        .filter((e) => (e.input || '').trim() !== '' || (e.output || '').trim() !== '')
    : [];

  return {
    numId,
    title,
    difficulty: it.difficulty || 'Easy',
    category: (Array.isArray(it.topics) && it.topics.length ? it.topics[0] : it.category) || 'General',
    description: it.description || '',
    examples,
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

  // Normalize first to collect the exact target set
  const norms = [];
  for (let i = 0; i < rawItems.length; i++) {
    const norm = normalize(rawItems[i], i);
    norm.numId = String(norm.numId || (i + 1));
    norm.frontendId = String(norm.frontendId || norm.numId);
    norm.problemId = String(norm.problemId || norm.numId);
    norms.push(norm);
  }

  // Upsert all target docs
  const ops = norms.map((norm) => ({
    updateOne: {
      filter: { slug: norm.slug },
      update: { $set: norm },
      upsert: true,
    }
  }));

  if (ops.length) {
    console.log('Writing', ops.length, 'upserts to challenges collection...');
    const res = await Challenge.bulkWrite(ops, { ordered: false });
    console.log('Bulk write result:', res.result || res);
  }

  // Prune anything not in the target set (ensure exactly N challenges)
  const keepSlugs = norms.map(n => n.slug);
  const delRes = await Challenge.deleteMany({ slug: { $nin: keepSlugs } });
  if (delRes && typeof delRes.deletedCount === 'number') {
    console.log('Pruned extra challenges:', delRes.deletedCount);
  }

  // Overwrite dataset file with cleaned data
  try {
    writeFileSync(subsetPath, JSON.stringify(norms, null, 2), 'utf8');
    console.log('Wrote cleaned dataset back to', subsetPath);
  } catch (e) {
    console.warn('Could not write cleaned dataset:', e && e.message ? e.message : e);
  }

  console.log('Resync complete. You may want to restart the backend.');
  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => { console.error(err); process.exit(1); });
