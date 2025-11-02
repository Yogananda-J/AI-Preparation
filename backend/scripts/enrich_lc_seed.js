import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lcPath = path.resolve(__dirname, '../src/data/challenges.seed.lc.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const writeJson = (p, data) => writeFileSync(p, JSON.stringify(data, null, 2));

const ensureArray = (x) => Array.isArray(x) ? x : (x ? [x] : []);

const buildNotes = (item) => {
  const notes = [];
  // Basic notes similar to LeetCode styling
  notes.push('Read the constraints carefully and ensure your solution adheres to them.');
  notes.push('Only print/return exactly what is asked in the Output section.');
  if (item.topics && item.topics.length) {
    notes.push(`This problem typically involves: ${item.topics.join(', ')}.`);
  }
  if (item.difficulty) {
    notes.push(`Difficulty hint: ${item.difficulty}. Optimize accordingly.`);
  }
  return notes;
};

const enrichExplanation = (item, ex) => {
  // If explanation is present, keep it. Otherwise generate a brief helper text.
  if (ex.explanation && String(ex.explanation).trim().length) return ex.explanation;
  // Generate a short generic explanation based on description if available
  const desc = (item.description || '').split('\n')[0];
  if (desc) {
    return `Applies the problem requirement: ${desc.slice(0, 180)}...`;
  }
  return 'Follows the stated requirement to derive the expected output from the given input.';
};

const main = () => {
  const data = readJson(lcPath);
  const updated = data.map((item) => {
    const out = { ...item };

    // Ensure topics is array
    out.topics = ensureArray(out.topics);

    // Ensure examples have example_num and explanation
    out.examples = ensureArray(out.examples).map((ex, idx) => ({
      example_num: ex.example_num ?? (idx + 1),
      input: ex.input ?? '',
      output: ex.output ?? '',
      explanation: enrichExplanation(item, ex),
    }));

    // Ensure constraints is array of strings
    out.constraints = ensureArray(out.constraints).map((c) => String(c));

    // Add notes if missing
    if (!out.notes || !out.notes.length) {
      out.notes = buildNotes(out);
    }

    return out;
  });

  writeJson(lcPath, updated);
  console.log(`Enriched ${updated.length} problems with notes and example explanations at ${lcPath}`);
};

main();
