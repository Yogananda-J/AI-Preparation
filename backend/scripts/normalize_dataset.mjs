import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, '../src/data/merged_subset.json');

const toSlug = (s) => (s || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const parseExampleText = (txt) => {
  if (!txt || typeof txt !== 'string') return { input: '', output: '', explanation: '' };
  const inputMatch = txt.match(/Input\s*:\s*([\s\S]*?)(?:\n|$)/i);
  const outputMatch = txt.match(/Output\s*:\s*([\s\S]*?)(?:\n|$)/i);
  const explanationMatch = txt.match(/Explanation\s*:\s*([\s\S]*)/i);
  const input = inputMatch ? inputMatch[1].trim() : '';
  const output = outputMatch ? outputMatch[1].trim() : '';
  const explanation = explanationMatch ? explanationMatch[1].trim() : '';
  if (!input && !output && !explanation) {
    return { input: '', output: '', explanation: txt.trim() };
  }
  return { input, output, explanation };
};

const normalizeSnippets = (raw) => {
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => {
      if (v && typeof v === 'object' && typeof v.code === 'string') return [k, v];
      if (typeof v === 'string') return [k, { name: k, code: v }];
      return [k, { name: k, code: '' }];
    }));
  }
  return {};
};

const loadItems = (p) => {
  const raw = readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  if (parsed && Array.isArray(parsed.problems)) return parsed.problems;
  if (Array.isArray(parsed)) return parsed;
  throw new Error('Unsupported dataset shape');
};

const clean = (arr) => arr.map((it, idx) => {
  const title = it.title || it.name || '';
  const slug = it.problem_slug || it.slug || toSlug(title);
  const difficulty = it.difficulty || 'Easy';
  const category = (Array.isArray(it.topics) && it.topics.length ? it.topics[0] : it.category) || 'General';

  // Examples
  const examples = Array.isArray(it.examples)
    ? it.examples.map((ex) => {
        if (ex && typeof ex === 'object' && typeof ex.example_text === 'string') {
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
        return { input: '', output: '', explanation: '' };
      }).filter(Boolean)
    : [];

  const constraints = Array.isArray(it.constraints) ? it.constraints : (it.constraints ? [it.constraints] : []);
  const topics = (it.topics && it.topics.length ? it.topics : [category]).filter(Boolean);

  const acceptance = typeof it.acceptance === 'number' ? it.acceptance : 0;
  const points = it.points ?? (difficulty === 'Easy' ? 100 : difficulty === 'Medium' ? 170 : 260);

  const codeSnippets = normalizeSnippets(it.code_snippets || it.codeSnippets || {});

  return {
    numId: String(it.frontend_id ?? it.problem_id ?? it.numId ?? it.id ?? (idx + 1)),
    title,
    slug,
    difficulty,
    category,
    description: it.description || '',
    examples,
    constraints,
    topics,
    acceptance,
    points,
    codeSnippets,
    hints: it.hints || [],
    follow_ups: it.follow_ups || it.followUps || [],
    frontend_id: it.frontend_id ?? it.frontendId ?? undefined,
    problem_id: it.problem_id ?? it.problemId ?? undefined,
  };
});

const main = () => {
  if (!existsSync(srcPath)) {
    console.error('Dataset not found at', srcPath);
    process.exit(1);
  }
  const items = loadItems(srcPath);
  const cleaned = clean(items);
  writeFileSync(srcPath, JSON.stringify(cleaned, null, 2), 'utf8');
  console.log('Normalized and overwrote dataset:', srcPath);
  console.log('Items:', cleaned.length);
};

main();
