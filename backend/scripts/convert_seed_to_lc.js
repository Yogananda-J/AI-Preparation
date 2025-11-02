import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toSlug = (s) => (s || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const defaultSnippets = (title) => ({
  python: {
    name: 'python',
    code: `# ${title}\nclass Solution:\n    def solve(self, *args):\n        pass\n`,
  },
  java: {
    name: 'java',
    code: `// ${title}\nclass Solution {\n    public void solve() {\n        // TODO\n    }\n}\n`,
  },
  javascript: {
    name: 'javascript',
    code: `// ${title}\nfunction solve(...args) {\n  // TODO\n}\n`,
  },
});

const legacyPath = path.resolve(__dirname, '../src/data/challenges.seed.json');
const outPath = path.resolve(__dirname, '../src/data/challenges.seed.lc.json');

const raw = readFileSync(legacyPath, 'utf-8');
const items = JSON.parse(raw);

const lcItems = items.map((it, idx) => {
  const numId = String(it.numId || it.id || it.frontend_id || idx + 1);
  const title = it.title || it.name || `Problem ${numId}`;
  const difficulty = it.difficulty || 'Easy';
  const category = it.category || (Array.isArray(it.topics) && it.topics[0]) || 'General';
  const slug = toSlug(it.problem_slug || it.slug || title);
  const examplesLegacy = Array.isArray(it.examples) ? it.examples : [];
  const examples = examplesLegacy.map((ex, i) => ({
    example_num: i + 1,
    input: ex.input ?? '',
    output: ex.output ?? '',
    explanation: ex.explanation ?? '',
  }));
  const constraints = Array.isArray(it.constraints) ? it.constraints : (it.constraints ? [it.constraints] : []);
  const topics = it.topics && it.topics.length ? it.topics : [category];
  const code_snippets = it.code_snippets || it.codeSnippets || defaultSnippets(title);
  const hints = it.hints || [
    'Start with a simple approach and improve it.',
    'Think about appropriate data structures.'
  ];

  return {
    title,
    problem_id: numId,
    frontend_id: numId,
    problem_slug: slug,
    difficulty,
    topics,
    description: it.description || '',
    examples,
    constraints,
    code_snippets,
    hints,
  };
});

writeFileSync(outPath, JSON.stringify(lcItems, null, 2));
console.log(`Wrote ${lcItems.length} problems to ${outPath}`);
