import { Challenge } from '../models/Challenge.js';
import { Draft } from '../models/Draft.js';
import { Submission } from '../models/Submission.js';
import { User } from '../models/User.js';
import { Activity } from '../models/Activity.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared helper: parse key=value style inputs from example text
const parseFieldsFromInput = (inputStr) => {
  if (!inputStr || typeof inputStr !== 'string') return [];
  const raw = inputStr.replace(/^\s*Input\s*:\s*/gim, '').trim();
  const parts = [];
  let buf = '';
  let depth = 0;
  let inStr = false;
  let strCh = '';
  const push = () => { const s = buf.trim(); if (s) parts.push(s); buf = ''; };
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      buf += ch;
      if (ch === strCh && raw[i - 1] !== '\\') { inStr = false; strCh = ''; }
      continue;
    }
    if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; buf += ch; continue; }
    if (ch === '[' || ch === '{' || ch === '(') { depth++; buf += ch; continue; }
    if (ch === ']' || ch === '}' || ch === ')') { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if (ch === ',' && depth === 0) { push(); continue; }
    buf += ch;
  }
  push();
  const fields = [];
  for (const p of parts) {
    const m = p.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (m) {
      fields.push({ name: m[1], value: m[2].trim() });
    }
  }
  if (fields.length === 0 && raw) {
    return [{ name: 'input', value: raw }];
  }
  return fields;
};

// Seed or reconcile challenges from seed file. Safe to call repeatedly.
const ensureSeeded = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const lcPath = path.resolve(__dirname, '../data/challenges.seed.lc.json');
  const legacyPath = path.resolve(__dirname, '../data/challenges.seed.json');
  const mergedPath = path.resolve(__dirname, '../data/merged_problems.json');
  const chosenPath = existsSync(lcPath) ? lcPath : legacyPath;
  let rawItems = [];
  try {
    // Prefer merged dataset first as the primary source
    if (existsSync(mergedPath)) {
      const rawMerged = readFileSync(mergedPath, 'utf-8');
      const merged = JSON.parse(rawMerged);
      if (merged && Array.isArray(merged.questions)) rawItems = merged.questions;
    }
    // If still empty, try LC dataset
    if ((!rawItems || !rawItems.length) && existsSync(lcPath)) {
      const rawLc = readFileSync(lcPath, 'utf-8');
      if (rawLc && rawLc.trim().startsWith('[')) rawItems = JSON.parse(rawLc);
    }
    // If still empty, use legacy
    if (!rawItems || !rawItems.length) {
      const legacyRaw = readFileSync(legacyPath, 'utf-8');
      rawItems = JSON.parse(legacyRaw);
    }
  } catch (e) {
    // Fallback to legacy on parse/read error
    const legacyRaw = readFileSync(legacyPath, 'utf-8');
    rawItems = JSON.parse(legacyRaw);
  }

  // Normalize to our DB schema supporting both legacy and new LC-style JSON
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
      code: `# ${title}\n# Reads newline-separated key=value pairs from stdin\nimport sys\nraw = sys.stdin.read().strip().splitlines()\ninputs = {}\nfor line in raw:\n    if '=' in line:\n        k,v = line.split('=',1)\n        inputs[k.strip()] = v.strip()\n\n# TODO: parse inputs and print output\nprint("")\n`,
    },
    java: {
      name: 'java',
      code: `// ${title}\nimport java.io.*;\nimport java.util.*;\nclass Solution {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        String s; Map<String,String> inputs = new HashMap<>();\n        while ((s = br.readLine()) != null) {\n            int idx = s.indexOf('=');\n            if (idx > 0) { inputs.put(s.substring(0,idx).trim(), s.substring(idx+1).trim()); }\n        }\n        // TODO: parse inputs and print output\n        System.out.print("");\n    }\n}\n`,
    },
    javascript: {
      name: 'javascript',
      code: `// ${title}\n// Reads newline-separated key=value pairs from stdin\nconst fs = require('fs');\nconst raw = fs.readFileSync(0,'utf8').trim().split(/\n+/).filter(Boolean);\nconst inputs = {};\nfor (const line of raw) { const i = line.indexOf('='); if (i>0) inputs[line.slice(0,i).trim()] = line.slice(i+1).trim(); }\n\n// TODO: parse inputs and print output\nprocess.stdout.write('');\n`,
    },
    cpp: {
      name: 'cpp',
      code: `// ${title}\n#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    ios::sync_with_stdio(false); cin.tie(nullptr);\n    string line; unordered_map<string,string> inputs;\n    while (getline(cin, line)) { auto pos = line.find('='); if (pos!=string::npos) inputs[line.substr(0,pos)] = line.substr(pos+1); }\n    // TODO: parse inputs and print output\n    cout << "";\n    return 0;\n}\n`,
    },
  });

  const parseExampleText = (txt) => {
    if (!txt || typeof txt !== 'string') return { input: '', output: '', explanation: '' };
    // Expect lines like: "Input: ...\nOutput: ...\nExplanation: ..."
    const inputMatch = txt.match(/Input\s*:\s*([\s\S]*?)(?:\n|$)/i);
    const outputMatch = txt.match(/Output\s*:\s*([\s\S]*?)(?:\n|$)/i);
    const explanationMatch = txt.match(/Explanation\s*:\s*([\s\S]*)/i);
    const input = inputMatch ? inputMatch[1].trim() : '';
    const output = outputMatch ? outputMatch[1].trim() : '';
    const explanation = explanationMatch ? explanationMatch[1].trim() : '';
    // Fallback: if none of the expected labels are present, treat entire block as explanation
    if (!input && !output && !explanation) {
      return { input: '', output: '', explanation: txt.trim() };
    }
    return { input, output, explanation };
  };

  const isJudgeSnippet = (txt) => {
    if (!txt || typeof txt !== 'string') return false;
    const t = txt.trim();
    // Heuristics: presence of assert, for(...), variable declarations, semicolons with braces, or function calls to the problem name.
    if (/assert\s*\(/i.test(t)) return true;
    if (/for\s*\(.*;.*;.*\)/i.test(t)) return true;
    if (/(int|var|let|const)\s+\w+\s*=/.test(t)) return true;
    if (/[;{}]\s*$/.test(t) || /;\s*\n/.test(t)) return true;
    if (/remove(Element|Duplicates)|expectedNums|sort\s*\(|print\s*\(/i.test(t)) return true;
    return false;
  };

  const items = rawItems.map((it) => {
    // If new LC-style keys are present, translate to our schema
    if (it.problem_id || it.frontend_id || it.problem_slug || it.topics || it.code_snippets || it.hints) {
      const numId = String(it.frontend_id || it.problem_id || it.numId || it.id || '');
      const title = it.title || it.name || '';
      const difficulty = it.difficulty || 'Easy';
      const category = (Array.isArray(it.topics) && it.topics.length ? it.topics[0] : it.category) || 'General';
      const description = it.description || '';
      const examples = Array.isArray(it.examples)
        ? it.examples
            .map((ex) => {
              if (ex.example_text) {
                if (isJudgeSnippet(ex.example_text)) {
                  return null; // drop judge-only snippet from examples
                }
                const parsed = parseExampleText(ex.example_text);
                return { ...parsed, images: ex.images || [] };
              }
              return {
                input: ex.input ?? '',
                output: ex.output ?? '',
                explanation: ex.explanation ?? '',
                images: ex.images || [],
              };
            })
            .filter(Boolean)
        : it.examples || [];
      const constraints = Array.isArray(it.constraints) ? it.constraints : (it.constraints ? [it.constraints] : []);

      // Hidden tests: support multiple possible dataset keys
      const rawPrivate = it.private_tests || it.privateTests || it.hidden_tests || it.hiddenTests || [];
      const privateTests = Array.isArray(rawPrivate)
        ? rawPrivate.map((t) => ({ input: (t.input ?? t.in ?? '').toString(), output: (t.output ?? t.out ?? '').toString() }))
        : [];

      // Normalize code snippets to consistent shape { lang: { name, code } }
      let rawSnippets = it.code_snippets || it.codeSnippets || defaultSnippets(title);
      if (rawSnippets && typeof rawSnippets === 'object') {
        rawSnippets = Object.fromEntries(Object.entries(rawSnippets).map(([k, v]) => {
          if (v && typeof v === 'object' && typeof v.code === 'string') return [k, v];
          if (typeof v === 'string') return [k, { name: k, code: v }];
          return [k, { name: k, code: '' }];
        }));
      }

      // Special-case: enforce non-functional stubs for Add Two Numbers to prevent trivial AC
      if (/\badd\s+two\s+numbers\b/i.test(title)) {
        rawSnippets = {
          ...rawSnippets,
          cpp: { name: 'cpp', code: `// Add Two Numbers (non-functional stub)\nstruct ListNode { int val; ListNode *next; ListNode(): val(0), next(nullptr) {} ListNode(int x): val(x), next(nullptr) {} ListNode(int x, ListNode *n): val(x), next(n) {} };\nListNode* addTwoNumbers(ListNode* l1, ListNode* l2) { return nullptr; }\n` },
          java: { name: 'java', code: `// Add Two Numbers (non-functional stub)\nclass ListNode { int val; ListNode next; ListNode() { this(0); } ListNode(int x) { val = x; } ListNode(int x, ListNode n) { val = x; next = n; } }\nclass Solution {\n    public ListNode addTwoNumbers(ListNode l1, ListNode l2) { return new ListNode(0); }\n}\n` },
          python: { name: 'python', code: `# Add Two Numbers (non-functional stub)\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\nclass Solution:\n    def addTwoNumbers(self, l1, l2):\n        return None\n` },
          javascript: { name: 'javascript', code: `// Add Two Numbers (non-functional stub)\nfunction ListNode(val, next) { this.val = (val===undefined?0:val); this.next = (next===undefined?null:next); }\nvar addTwoNumbers = function(l1, l2) { return new ListNode(0); };\n` },
        };
      }

      // Special-case: enforce non-functional stubs for Two Sum (must compile, but wrong)
      if (/\btwo\s+sum\b/i.test(title)) {
        rawSnippets = {
          ...rawSnippets,
          java: { name: 'java', code: `// Two Sum (non-functional stub)\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{-1, -1};\n    }\n}\n` },
          javascript: { name: 'javascript', code: `// Two Sum (non-functional stub)\nvar twoSum = function(nums, target) { return [-1, -1]; };\n` },
          cpp: { name: 'cpp', code: `// Two Sum (non-functional stub)\n#include <bits/stdc++.h>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target){ return {-1, -1}; }\n` },
          python: { name: 'python', code: `# Two Sum (non-functional stub)\ndef twoSum(nums, target):\n    return [-1, -1]\n` },
        };
      }

      return {
        numId,
        title,
        difficulty,
        category,
        acceptance: it.acceptance ?? 0,
        points: it.points ?? (difficulty === 'Easy' ? 100 : difficulty === 'Medium' ? 170 : 260),
        description,
        examples,
        privateTests,
        constraints,
        problemId: it.problem_id || it.problemId || undefined,
        frontendId: it.frontend_id || it.frontendId || numId,
        slug: it.problem_slug || it.slug || toSlug(title),
        topics: (it.topics && it.topics.length ? it.topics : [category]).filter(Boolean),
        codeSnippets: rawSnippets,
        hints: it.hints || [],
        notes: it.notes || [],
        followUps: it.follow_ups || it.followUps || [],
      };
    }

    // Legacy format passthrough with minimal defaults
    const title = it.title || '';
    const category = it.category || 'General';
    return {
      numId: String(it.numId || it.id || ''),
      title,
      difficulty: it.difficulty || 'Easy',
      category,
      acceptance: it.acceptance ?? 0,
      points: it.points ?? 0,
      description: it.description || '',
      examples: it.examples || [],
      privateTests: it.privateTests || [],
      constraints: it.constraints || [],
      frontendId: String(it.numId || it.id || ''),
      problemId: String(it.numId || it.id || ''),
      slug: toSlug(title),
      topics: [category].filter(Boolean),
      codeSnippets: defaultSnippets(title),
      hints: [],
      notes: it.notes || [],
      followUps: it.follow_ups || it.followUps || [],
    };
  });

  const count = await Challenge.countDocuments();
  if (count === 0) {
    await Challenge.insertMany(items);
    return;
  }

  // Upsert missing or updated items by numId without touching existing extra docs
  const ops = items.map((it) => ({
    updateOne: {
      filter: { numId: it.numId },
      update: { $set: it },
      upsert: true,
    },
  }));
  if (ops.length) await Challenge.bulkWrite(ops, { ordered: false });
};

export const listChallenges = async (req, res) => {
  await ensureSeeded();
  const items = await Challenge.find({}, {
    _id: 0,
    id: '$numId',
    numId: 1,
    title: 1,
    difficulty: 1,
    category: 1,
    acceptance: 1,
    points: 1,
  }).sort({ numId: 1 }).lean();
  const normalized = items.map((c) => ({
    id: c.numId,
    title: c.title,
    difficulty: c.difficulty,
    category: c.category,
    acceptance: c.acceptance,
    points: c.points,
    slug: c.slug,
  }));
  return res.json({ challenges: normalized });
};

export const getDailyChallenges = async (req, res) => {
  await ensureSeeded();
  const today = new Date().toISOString().slice(0, 10);
  const challenges = await Challenge.find({}, {
    _id: 0,
    id: '$numId',
    numId: 1,
    title: 1,
    difficulty: 1,
    category: 1,
    acceptance: 1,
    points: 1,
  })
    .limit(3)
    .lean();

  // Map id to numId for compatibility
  const normalized = challenges.map((c) => ({
    id: c.numId,
    title: c.title,
    difficulty: c.difficulty,
    category: c.category,
    acceptance: c.acceptance,
    points: c.points,
  }));

  return res.json({ date: today, challenges: normalized });
};

export const getChallengeById = async (req, res) => {
  await ensureSeeded();
  const { id } = req.params;
  const doc = await Challenge.findOne({ $or: [{ numId: id }, { slug: id }] }).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const buildDefaultTestCases = () => {
    const ex = Array.isArray(doc.examples) ? doc.examples : [];
    const cases = [];
    for (let i = 0; i < ex.length; i++) {
      const e = ex[i] || {};
      const fields = parseFieldsFromInput(e.input || '');
      cases.push({ id: `case${i + 1}`, fields });
    }
    return cases;
  };

  return res.json({
    id: doc.numId,
    title: doc.title,
    difficulty: doc.difficulty,
    category: doc.category,
    description: doc.description,
    examples: doc.examples || [],
    constraints: doc.constraints || [],
    topics: doc.topics || [],
    hints: doc.hints || [],
    codeSnippets: doc.codeSnippets || {},
    // Convenience alias for frontend prompt: starterCode { lang: code }
    starterCode: Object.fromEntries(
      Object.entries(doc.codeSnippets || {}).map(([k, v]) => [k, (v && v.code) || ''])
    ),
    notes: doc.notes || [],
    followUps: doc.followUps || [],
    acceptance: doc.acceptance,
    points: doc.points,
    defaultTestCases: buildDefaultTestCases(),
  });
};

export const runCode = async (req, res) => {
  const { challengeId, code, language, inputs } = req.body || {};
  if (!challengeId || !code || !language) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const chal = await Challenge.findOne({ $or: [{ numId: challengeId }, { slug: challengeId }] }).lean();
  if (!chal) return res.status(404).json({ error: 'Challenge not found' });
  const examples = Array.isArray(chal.examples) ? chal.examples : [];
  if (!examples.length) return res.status(400).json({ error: 'No test cases for this challenge' });
  // Optional Judge0 integration
  const ACE_URL = (process.env.ACE_URL || '').trim();
  const JUDGE0_URL = process.env.JUDGE0_URL; // e.g., https://judge0-ce.p.rapidapi.com or self-hosted base URL
  const RAPID_KEY = process.env.JUDGE0_RAPIDAPI_KEY;
  const headers = { 'Content-Type': 'application/json' };
  if (RAPID_KEY) {
    headers['X-RapidAPI-Key'] = RAPID_KEY;
    headers['X-RapidAPI-Host'] = (new URL(JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com')).host;
  }

  const langMap = {
    javascript: 63, js: 63, node: 63,
    python: 71, python3: 71, py: 71,
    java: 62,
    cpp: 54, 'c++': 54, 'cpp17': 54,
  };

  const toId = (lang) => langMap[(lang || '').toLowerCase()] || null;

  const serializeFieldsToStdin = (arr) => {
    if (!Array.isArray(arr) || !arr.length) return '';
    return arr.map((f) => `${f.name}=${f.value}`).join('\n');
  };
  const providedStdin = serializeFieldsToStdin(inputs);
  // Helper: parse UI-provided stdin (name=value per line) back into fields for harness use
  const parseStdinToFields = (s) => {
    if (!s || typeof s !== 'string') return [];
    return s
      .split(/\n+/)
      .map((line) => {
        const i = line.indexOf('=');
        if (i > 0) return { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
        return null;
      })
      .filter(Boolean);
  };

  try {
    // Preferred path: local ACE runner
    if (ACE_URL && toId(language)) {
      const base = ACE_URL.replace(/\/$/, '');
      let passed = 0;
      // Execute ALL examples to mirror LeetCode behavior
      const order = examples.map((_, i) => i);
      const total = order.length;
      const caseLines = [];
      const caseResults = [];
      let aggTime = 0;
      let finalVerdict = 'AC';
      const severity = (v) => ({ CE:4, RE:3, TLE:2, WA:1, AC:0 }[v] ?? 0);

      for (let k = 0; k < total; k++) {
        const i = order[k];
        const expected = (examples[i]?.output || '').toString().trim();
        // Prefer UI-provided stdin fields when present; else parse from example text
        const fields = providedStdin ? parseStdinToFields(providedStdin) : parseFieldsFromInput(examples[i]?.input || '');

        let source_code = code;
        let stdin = providedStdin;
        // Harness injection (reuse existing rules)
        if ((language || '').toLowerCase() === 'java' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          let numsVal = '[]'; let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          const javaArrayLiteral = `new int[]{${(numsVal || '').replace(/^\s*\[|\]\s*$/g, '')}}`;
          const javaTargetLiteral = `${targetVal}`;
          source_code = `${code}\nclass TestRunner {\n  public static void main(String[] args) {\n    int[] nums = ${javaArrayLiteral};\n    int target = ${javaTargetLiteral};\n    int[] result = new Solution().twoSum(nums, target);\n    System.out.print(java.util.Arrays.toString(result).replace(" ", ""));\n  }\n}\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'cpp' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          let numsVal = '[]'; let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          const vecInit = (numsVal || '').replace(/^\s*\[|\]\s*$/g, '');
          source_code = `#include <bits/stdc++.h>\nusing namespace std;\n${code}\nint main(){ vector<int> nums={${vecInit}}; int target=${targetVal}; vector<int> res=twoSum(nums,target); cout<<"["; for(size_t i=0;i<res.size();++i){ if(i) cout<<","; cout<<res[i]; } cout<<"]"; return 0; }\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'javascript' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          let numsVal = '[]'; let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          source_code = `${code}\nconst nums=${numsVal}; const target=${targetVal}; const res = typeof twoSum==='function'? twoSum(nums, target) : []; const out = '[' + (Array.isArray(res)? res.join(','): '') + ']'; process.stdout.write(out);\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'python' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          let numsVal = '[]'; let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          source_code = `${code}\nnums = ${numsVal}\ntarget = ${targetVal}\ntry:\n    res = twoSum(nums, target)\nexcept Exception:\n    res = []\nprint('[' + ','.join(str(x) for x in (res if isinstance(res, list) else [])) + ']')\n`;
          stdin = '';
        }

        // Submit to ACE per case and poll
        const langId = toId(language);
        const createResp = await fetch(`${base}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language_id: langId, source_code, test_cases: [{ input: stdin, expected_output: expected }] })
        });
        const created = await createResp.json();
        const token = created?.token;
        let fin = null; const started = Date.now();
        for (let tries = 0; tries < 60; tries++) {
          await new Promise(r => setTimeout(r, 250));
          const stat = await fetch(`${base}/submissions/${token}`);
          const data = await stat.json();
          if (data && typeof data.status_id === 'number' && data.status_id !== 1 && data.status_id !== 2) { fin = data; break; }
        }
        const tc = fin?.test_cases?.[0] || {};
        const statusId = fin?.status_id ?? 13;
        const stdout = (tc.actual_output || tc.stdout || '').toString();
        const stderr = tc.stderr || '';
        const t = Math.max(0, (Date.now() - started));
        aggTime += t;

        let v = 'AC';
        if (statusId === 8) v = 'CE';
        else if (statusId === 5) v = 'TLE';
        else if (statusId === 7) v = 'RE';
        else if (statusId === 4) v = 'WA';
        else {
          const actual = stdout.trim();
          v = actual && expected && actual === expected ? 'AC' : 'WA';
        }
        if (v === 'AC') passed += 1; else if (severity(v) > severity(finalVerdict)) finalVerdict = v;
        const inputText = examples[i]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
        caseLines.push(`Test Case ${i + 1}: ${v === 'AC' ? '✅ Passed' : `❌ ${v}`}\ninput: ${inputText}\nexpected: ${expected || '(empty)'}\nactual: ${stdout.trim() || '(empty)'}${stderr ? `\nstderr: ${stderr}` : ''}`);
        caseResults.push({ index: i + 1, verdict: v, input: inputText, expected, actual: stdout.trim(), timeMs: t, memoryMB: 0, stderr });
      }

      const detailsText = caseLines.join('\n');
      return res.json({ success: true, data: { verdict: finalVerdict, passed, total: order.length, time: aggTime, memory: 0, caseResults, details: caseResults, rawDetails: detailsText } });
    }

    if (JUDGE0_URL && toId(language)) {
      const baseUrl = `${JUDGE0_URL.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`;
      let passed = 0;
      // Prefer up to 3 non-trivial examples first (expected not empty/zero)
      const isTrivial = (s) => {
        const t = (s || '').toString().trim();
        return t === '' || t === '[]' || t === '[0,0]' || t === '0' || t === 'null';
      };
      const order = examples
        .map((ex, i) => ({ i, trivial: isTrivial(ex?.output) }))
        .sort((a, b) => Number(a.trivial) - Number(b.trivial))
        .slice(0, Math.min(3, examples.length))
        .map((x) => x.i);
      const total = order.length;
      const caseLines = [];
      const caseResults = [];
      let aggTime = 0;
      let aggMem = 0;
      let finalVerdict = 'AC';
      const severity = (v) => ({ CE:4, RE:3, TLE:2, WA:1, AC:0 }[v] ?? 0);

      for (let k = 0; k < total; k++) {
        const i = order[k];
        const expected = (examples[i]?.output || '').toString().trim();
        // If UI provided inputs, use them; else derive from example input
        const fields = providedStdin ? parseStdinToFields(providedStdin) : parseFieldsFromInput(examples[i]?.input || '');

        let source_code = code;
        let stdin = providedStdin;
        // Java harness for Two Sum: compose full program that calls Solution.twoSum and prints canonical without spaces
        if ((language || '').toLowerCase() === 'java' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          // Extract nums and target from fields or fallback to parsing example input text
          let numsVal = '[]';
          let targetVal = '0';
          for (const f of fields) {
            if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString();
            if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString();
          }
          // Convert [2,7,11,15] -> new int[]{2,7,11,15}
          const javaArrayLiteral = `new int[]{${(numsVal || '').replace(/^\s*\[|\]\s*$/g, '')}}`;
          const javaTargetLiteral = `${targetVal}`;
          const userClass = code;
          source_code = `${userClass}\nclass TestRunner {\n  public static void main(String[] args) {\n    int[] nums = ${javaArrayLiteral};\n    int target = ${javaTargetLiteral};\n    int[] result = new Solution().twoSum(nums, target);\n    System.out.print(java.util.Arrays.toString(result).replace(" ", ""));\n  }\n}\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'cpp' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          // C++ harness: expects user to provide twoSum(vector<int>&, int)
          let numsVal = '[]';
          let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          const vecInit = (numsVal || '').replace(/^\s*\[|\]\s*$/g, '');
          source_code = `#include <bits/stdc++.h>\nusing namespace std;\n${code}\nint main(){ vector<int> nums={${vecInit}}; int target=${targetVal}; vector<int> res=twoSum(nums,target); cout<<"["; for(size_t i=0;i<res.size();++i){ if(i) cout<<","; cout<<res[i]; } cout<<"]"; return 0; }\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'javascript' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          // JavaScript harness: expects global function twoSum(nums, target)
          let numsVal = '[]';
          let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          source_code = `${code}\nconst nums=${numsVal}; const target=${targetVal}; const res = typeof twoSum==='function'? twoSum(nums, target) : []; const out = '[' + (Array.isArray(res)? res.join(','): '') + ']'; process.stdout.write(out);\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'python' && /\btwo\s+sum\b/i.test(chal.title || '')) {
          // Python harness: ensure no-space array output
          let numsVal = '[]';
          let targetVal = '0';
          for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
          source_code = `${code}\nnums = ${numsVal}\ntarget = ${targetVal}\ntry:\n    res = twoSum(nums, target)\nexcept Exception:\n    res = []\nprint('[' + ','.join(str(x) for x in (res if isinstance(res, list) else [])) + ']')\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'cpp' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
          // C++ harness for Add Two Numbers (Linked List)
          let l1 = '[]'; let l2 = '[]';
          for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
          const arr1 = (l1 || '').replace(/^\s*\[|\]\s*$/g, '');
          const arr2 = (l2 || '').replace(/^\s*\[|\]\s*$/g, '');
          const listUtils = `#include <bits/stdc++.h>\nusing namespace std;\nstruct ListNode{ int val; ListNode* next; ListNode(int x): val(x), next(nullptr) {} };\nListNode* build(const vector<int>& v){ ListNode dummy(0); ListNode* cur=&dummy; for(int x: v){ cur->next=new ListNode(x); cur=cur->next; } return dummy.next; }\nstring serialize(ListNode* h){ string s="["; bool first=true; while(h){ if(!first) s+=","; first=false; s+=to_string(h->val); h=h->next; } s+="]"; return s; }\n`;
          source_code = `${listUtils}\n${code}\nint main(){ vector<int> a={${arr1}}; vector<int> b={${arr2}}; ListNode* l1=build(a); ListNode* l2=build(b); ListNode* r=addTwoNumbers(l1,l2); cout<<serialize(r); return 0; }\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'javascript' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
          // JavaScript harness for Add Two Numbers
          let l1 = '[]'; let l2 = '[]';
          for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
          const utils = `function ListNode(val, next){ this.val=val??0; this.next=next??null; }\nfunction build(arr){ let d=new ListNode(0), c=d; for(const x of arr){ c.next=new ListNode(Number(x)); c=c.next; } return d.next; }\nfunction serialize(h){ const out=[]; while(h){ out.push(h.val); h=h.next; } return '['+out.join(',')+']'; }\n`;
          source_code = `${utils}${code}\nconst l1=${l1}; const l2=${l2}; const r = typeof addTwoNumbers==='function' ? addTwoNumbers(build(l1), build(l2)) : null; process.stdout.write(serialize(r));\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'java' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
          // Java linked-list harness: no-space array
          let l1 = '[]'; let l2 = '[]';
          for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
          const toArr = (s) => (s || '').replace(/^\s*\[|\]\s*$/g, '');
          const listUtils = `class ListNode{ int val; ListNode next; ListNode(){} ListNode(int v){ val=v; } ListNode(int v, ListNode n){ val=v; next=n; } }\nclass LL { static ListNode build(int[] a){ ListNode d=new ListNode(0), c=d; for(int x: a){ c.next=new ListNode(x); c=c.next; } return d.next; } static String ser(ListNode h){ StringBuilder sb=new StringBuilder("["); boolean first=true; while(h!=null){ if(!first) sb.append(','); first=false; sb.append(h.val); h=h.next; } sb.append(']'); return sb.toString(); } }\n`;
          source_code = `${userClass}\n${listUtils}class TestRunner{ public static void main(String[] args){ int[] a=new int[]{${toArr(l1)}}; int[] b=new int[]{${toArr(l2)}}; ListNode r=new Solution().addTwoNumbers(LL.build(a), LL.build(b)); System.out.print(LL.ser(r)); } }\n`;
          stdin = '';
        } else if ((language || '').toLowerCase() === 'python' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
          // Python linked-list harness: no-space array
          let l1 = '[]'; let l2 = '[]';
          for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
          source_code = `${code}\nclass ListNode:\n    def __init__(self, val=0, next=None):\n        self.val=val; self.next=next\ndef build(a):\n    d=ListNode(0); c=d\n    for x in a: c.next=ListNode(int(x)); c=c.next\n    return d.next\ndef ser(h):\n    out=[]\n    while h: out.append(h.val); h=h.next\n    return '['+','.join(str(x) for x in out)+']'\ntry:\n    r = Solution().addTwoNumbers(build(${l1}), build(${l2}))\nexcept Exception:\n    try:\n        r = addTwoNumbers(build(${l1}), build(${l2}))\n    except Exception:\n        r = None\nprint(ser(r))\n`;
          stdin = '';
        }

        const createResp = await fetch(baseUrl, {
          method: 'POST', headers, body: JSON.stringify({ language_id: toId(language), source_code, stdin })
        });
        const result = await createResp.json();
        const statusDesc = result?.status?.description || '';
        const compileErr = result?.compile_output;
        const stderr = result?.stderr;
        const stdout = (result?.stdout || '').toString();
        if (process.env.JUDGE_LOG === '1') {
          console.log('[RUN] case', i + 1, { expected, stdout: stdout.trim(), stderr, compileErr, statusDesc });
        }
        const t = result?.time ? Math.round(parseFloat(result.time) * 1000) : 0;
        const m = result?.memory ? Math.round(result.memory / 1024) : 0;
        aggTime += t; aggMem += m;

        let v = 'AC';
        if (compileErr) v = 'CE';
        else if (statusDesc.toLowerCase().includes('time limit')) v = 'TLE';
        else if (stderr) v = 'RE';
        else {
          const actual = stdout.trim();
          // Strict debug logging to reveal invisible mismatches
          try {
            console.log(`[WA DEBUG][run][case ${i + 1}] Expected: |${expected}|`);
            console.log(`[WA DEBUG][run][case ${i + 1}] Actual:   |${actual}|`);
          } catch (_) {}
          if (expected && actual === '') v = 'WA';
          else v = actual && expected && actual === expected ? 'AC' : 'WA';
          if (v === 'AC' && (chal?.title || '').match(/two\s+sum/i)) {
            try { console.error('[CRITICAL][run] WA check matched for Two Sum; verify harness and expected formatting'); } catch (_) {}
          }
        }

        if (v === 'AC') passed += 1; else if (severity(v) > severity(finalVerdict)) finalVerdict = v;
        const info = [];
        if (compileErr) info.push('compile_output present');
        if (stderr) info.push('stderr present');
        const inputText = examples[i]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
        caseLines.push(`Test Case ${i + 1}: ${v === 'AC' ? '✅ Passed' : `❌ ${v}`}\ninput: ${inputText}\nexpected: ${expected || '(empty)'}\nactual: ${stdout.trim() || '(empty)'}${stderr ? `\nstderr: ${stderr}` : ''}${compileErr ? `\ncompile: ${compileErr}` : ''}`);
        caseResults.push({ index: i + 1, verdict: v, input: inputText, expected, actual: stdout.trim(), timeMs: t, memoryMB: m, stderr: stderr || '', compile: compileErr || '' });
      }

      const detailsText = caseLines.join('\n');
      return res.json({ success: true, data: { verdict: finalVerdict, passed, total, time: aggTime, memory: aggMem, caseResults, details: caseResults, rawDetails: detailsText } });
    }
  } catch (e) {
    // fall through to simulated output on API failure
  }

  // Fallback simulated execution: populate details from existing challenge examples so UI can show Input/Expected/Output
  try {
    const examples = Array.isArray(chal?.examples) ? chal.examples : [];
    const pick = examples.slice(0, Math.min(3, examples.length));
    const details = pick.map((ex, idx) => ({
      index: idx + 1,
      verdict: 'WA',
      input: ex?.input || '',
      expected: (ex?.output || '').toString().trim(),
      actual: '',
      timeMs: 0,
      memoryMB: 0,
    }));
    return res.json({ success: true, data: { verdict: 'WA', passed: 0, total: pick.length, time: 0, memory: 0, caseResults: details, details, rawDetails: '' } });
  } catch (_) {
    return res.json({ success: true, data: { verdict: 'WA', passed: 0, total: 0, time: 0, memory: 0, details: [], rawDetails: '' } });
  }
};

export const submitSolution = async (req, res) => {
  try {
    const userId = req.user?.sub || null;
    const { challengeId, code, language } = req.body || {};
    if (!challengeId || !code || !language) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const chal = await Challenge.findOne({ $or: [{ numId: challengeId }, { slug: challengeId }] });
    if (!chal) return res.status(404).json({ error: 'Challenge not found' });
    const priv = Array.isArray(chal.privateTests) ? chal.privateTests : [];
    const examples = priv.length ? priv : (Array.isArray(chal.examples) ? chal.examples : []);
    if (!examples.length) return res.status(400).json({ error: 'No test cases for this challenge' });

    // Create queued submission and return id immediately
    const queued = await Submission.create({
      userId: userId || undefined,
      challengeId,
      language,
      code,
      verdict: 'WA',
      status: 'QUEUED',
      timeMs: 0,
      memoryMB: 0,
      score: chal.points || 100,
      caseResults: [],
    });
    res.status(202).json({ submissionId: queued._id.toString(), status: 'QUEUED' });

    // Background processing (fire-and-forget)
    (async () => {
      const ACE_URL = (process.env.ACE_URL || '').trim();
      const JUDGE0_URL = process.env.JUDGE0_URL;
      const RAPID_KEY = process.env.JUDGE0_RAPIDAPI_KEY;
      const headers = { 'Content-Type': 'application/json' };
      if (RAPID_KEY) { headers['X-RapidAPI-Key'] = RAPID_KEY; headers['X-RapidAPI-Host'] = (new URL(JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com')).host; }
      const langMap = { javascript: 63, js: 63, node: 63, python: 71, python3: 71, py: 71, java: 62, cpp: 54, 'c++': 54, cpp17: 54 };
      const toId = (lang) => langMap[(lang || '').toLowerCase()] || null;

      await Submission.updateOne({ _id: queued._id }, { $set: { status: 'PROCESSING' } });

      let verdict = 'AC';
      let passed = 0; const total = examples.length;
      let timeMs = 0; let memoryMB = 0;
      const caseResults = [];
      const detailsArr = [];
      const severity = (v) => ({ CE:4, RE:3, TLE:2, WA:1, AC:0 }[v] ?? 0);

      if (ACE_URL && toId(language)) {
        const base = ACE_URL.replace(/\/$/, '');
        for (let i = 0; i < examples.length; i++) {
          const expected = (examples[i]?.output || '').toString().trim();
          // Build inputs (reuse parser from runCode behavior)
          const fields = (() => {
            const inputStr = examples[i].input || '';
            const raw = inputStr.replace(/^\s*Input\s*:\s*/gim, '').trim();
            const parts = []; let buf=''; let depth=0; let inStr=false; let strCh='';
            const push=()=>{const s=buf.trim(); if(s) parts.push(s); buf='';};
            for (let k=0;k<raw.length;k++){const ch=raw[k]; if(inStr){buf+=ch; if(ch===strCh && raw[k-1] !=='\\'){inStr=false; strCh='';} continue;} if(ch==='"'||ch==='\''){inStr=true; strCh=ch; buf+=ch; continue;} if(ch==='['||ch==='{'||ch==='('){depth++; buf+=ch; continue;} if(ch===']'||ch==='}'||ch===')'){depth=Math.max(0,depth-1); buf+=ch; continue;} if(ch===','&&depth===0){push(); continue;} buf+=ch;}
            push();
            const arr=[]; for (const p of parts){const m=p.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/); if(m){arr.push({name:m[1], value:m[2].trim()});}}
            return arr;
          })();

          let source_code = code;
          let stdin = fields.length ? fields.map(f=>`${f.name}=${f.value}`).join('\n') : '';
          // Harness injections (same as runCode)
          if ((language || '').toLowerCase() === 'java' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]'; let targetVal = '0';
            for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
            const javaArrayLiteral = `new int[]{${(numsVal || '').replace(/^\s*\[|\]\s*$/g, '')}}`;
            const javaTargetLiteral = `${targetVal}`;
            source_code = `${code}\nclass TestRunner {\n  public static void main(String[] args) {\n    int[] nums = ${javaArrayLiteral};\n    int target = ${javaTargetLiteral};\n    int[] result = new Solution().twoSum(nums, target);\n    System.out.print(java.util.Arrays.toString(result).replace(" ", ""));\n  }\n}\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'cpp' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]'; let targetVal = '0';
            for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
            const vecInit = (numsVal || '').replace(/^\s*\[|\]\s*$/g, '');
            source_code = `#include <bits/stdc++.h>\nusing namespace std;\n${code}\nint main(){ vector<int> nums={${vecInit}}; int target=${targetVal}; vector<int> res=twoSum(nums,target); cout<<"["; for(size_t i=0;i<res.size();++i){ if(i) cout<<","; cout<<res[i]; } cout<<"]"; return 0; }\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'javascript' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]'; let targetVal = '0';
            for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
            source_code = `${code}\nconst nums=${numsVal}; const target=${targetVal}; const res = typeof twoSum==='function'? twoSum(nums, target) : []; const out = '[' + (Array.isArray(res)? res.join(','): '') + ']'; process.stdout.write(out);\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'python' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]'; let targetVal = '0';
            for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
            source_code = `${code}\nnums = ${numsVal}\ntarget = ${targetVal}\ntry:\n    res = twoSum(nums, target)\nexcept Exception:\n    res = []\nprint('[' + ','.join(str(x) for x in (res if isinstance(res, list) else [])) + ']')\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'java' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
            let l1 = '[]'; let l2 = '[]';
            for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
            const toArr = (s) => (s || '').replace(/^\s*\[|\]\s*$/g, '');
            const listUtils = `class ListNode{ int val; ListNode next; ListNode(){} ListNode(int v){ val=v; } ListNode(int v, ListNode n){ val=v; next=n; } }\nclass LL { static ListNode build(int[] a){ ListNode d=new ListNode(0), c=d; for(int x: a){ c.next=new ListNode(x); c=c.next; } return d.next; } static String ser(ListNode h){ StringBuilder sb=new StringBuilder("["); boolean first=true; while(h!=null){ if(!first) sb.append(','); first=false; sb.append(h.val); h=h.next; } sb.append(']'); return sb.toString(); } }\n`;
            source_code = `${code}\n${listUtils}class TestRunner{ public static void main(String[] args){ int[] a=new int[]{${toArr(l1)}}; int[] b=new int[]{${toArr(l2)}}; ListNode r=new Solution().addTwoNumbers(LL.build(a), LL.build(b)); System.out.print(LL.ser(r)); } }\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'python' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
            let l1 = '[]'; let l2 = '[]';
            for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
            source_code = `${code}\nclass ListNode:\n    def __init__(self, val=0, next=None):\n        self.val=val; self.next=next\ndef build(a):\n    d=ListNode(0); c=d\n    for x in a: c.next=ListNode(int(x)); c=c.next\n    return d.next\ndef ser(h):\n    out=[]\n    while h: out.append(h.val); h=h.next\n    return '['+','.join(str(x) for x in out)+']'\ntry:\n    r = Solution().addTwoNumbers(build(${l1}), build(${l2}))\nexcept Exception:\n    try:\n        r = addTwoNumbers(build(${l1}), build(${l2}))\n    except Exception:\n        r = None\nprint(ser(r))\n`;
            stdin = '';
          }

          const langId = toId(language);
          const createResp = await fetch(`${base}/submissions`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ language_id: langId, source_code, test_cases: [{ input: stdin, expected_output: expected }] }) });
          const created = await createResp.json();
          const token = created?.token;
          let fin = null; const start = Date.now();
          for (let tries=0; tries<120; tries++) { await new Promise(r=>setTimeout(r,250)); const st = await fetch(`${base}/submissions/${token}`); const d = await st.json(); if (d && typeof d.status_id === 'number' && d.status_id !== 1 && d.status_id !== 2) { fin = d; break; } }
          const tc = fin?.test_cases?.[0] || {}; const statusId = fin?.status_id ?? 13; const stdout = (tc.actual_output || '').toString(); const stderr = tc.stderr || '';
          const t = Math.max(0, Date.now()-start); timeMs += t;
          let v='AC'; if (statusId===8) v='CE'; else if (statusId===5) v='TLE'; else if (statusId===7) v='RE'; else if (statusId===4) v='WA'; else { v = stdout.trim() === expected ? 'AC' : 'WA'; }
          if (v==='AC') passed++; else if (severity(v) > severity(verdict)) verdict = v;
          const inputText = examples[i]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
          const entry = { index: i+1, verdict: v, input: inputText, timeMs: t, memoryMB: 0, expected, actual: stdout.trim(), stderr };
          caseResults.push(entry); detailsArr.push(entry);
        }
      } else if (JUDGE0_URL && toId(language)) {
        for (let i = 0; i < examples.length; i++) {
          const expected = (examples[i]?.output || '').toString().trim();
          // Build inputs
          const fields = (() => {
            const inputStr = examples[i].input || '';
            const raw = inputStr.replace(/^\s*Input\s*:\s*/gim, '').trim();
            const parts = []; let buf=''; let depth=0; let inStr=false; let strCh='';
            const push=()=>{const s=buf.trim(); if(s) parts.push(s); buf='';};
            for (let k=0;k<raw.length;k++){const ch=raw[k]; if(inStr){buf+=ch; if(ch===strCh && raw[k-1] !=='\\'){inStr=false; strCh='';} continue;} if(ch==="\""||ch==='\''){inStr=true; strCh=ch; buf+=ch; continue;} if(ch==='['||ch==='{'||ch==='('){depth++; buf+=ch; continue;} if(ch===']'||ch==='}'||ch===')'){depth=Math.max(0,depth-1); buf+=ch; continue;} if(ch===','&&depth===0){push(); continue;} buf+=ch;}
            push();
            const arr=[]; for (const p of parts){const m=p.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/); if(m){arr.push({name:m[1], value:m[2].trim()});}}
            return arr;
          })();

          // Java harness for Two Sum
          let source_code = code;
          let stdin = fields.length ? fields.map(f=>`${f.name}=${f.value}`).join('\n') : '';
          if ((language || '').toLowerCase() === 'java' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]';
            let targetVal = '0';
            for (const f of fields) {
              if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString();
              if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString();
            }
            const javaArrayLiteral = `new int[]{${(numsVal || '').replace(/^\s*\[|\]\s*$/g, '')}}`;
            const javaTargetLiteral = `${targetVal}`;
            source_code = `${code}\nclass TestRunner {\n  public static void main(String[] args) {\n    int[] nums = ${javaArrayLiteral};\n    int target = ${javaTargetLiteral};\n    int[] result = new Solution().twoSum(nums, target);\n    System.out.print(java.util.Arrays.toString(result));\n  }\n}\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'cpp' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]'; let targetVal = '0';
            for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
            const vecInit = (numsVal || '').replace(/^\s*\[|\]\s*$/g, '');
            source_code = `#include <bits/stdc++.h>\nusing namespace std;\n${code}\nint main(){ vector<int> nums={${vecInit}}; int target=${targetVal}; vector<int> res=twoSum(nums,target); cout<<"["; for(size_t i=0;i<res.size();++i){ if(i) cout<<", "; cout<<res[i]; } cout<<"]"; return 0; }\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'javascript' && /\btwo\s+sum\b/i.test(chal.title || '')) {
            let numsVal = '[]'; let targetVal = '0';
            for (const f of fields) { if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString(); if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString(); }
            source_code = `${code}\nconst nums=${numsVal}; const target=${targetVal}; const res = typeof twoSum==='function'? twoSum(nums, target) : []; const out = '[' + (Array.isArray(res)? res.join(', '): '') + ']'; process.stdout.write(out);\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'cpp' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
            let l1 = '[]'; let l2 = '[]';
            for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
            const arr1 = (l1 || '').replace(/^\s*\[|\]\s*$/g, '');
            const arr2 = (l2 || '').replace(/^\s*\[|\]\s*$/g, '');
            const listUtils = `#include <bits/stdc++.h>\nusing namespace std;\nstruct ListNode{ int val; ListNode* next; ListNode(int x): val(x), next(nullptr) {} };\nListNode* build(const vector<int>& v){ ListNode dummy(0); ListNode* cur=&dummy; for(int x: v){ cur->next=new ListNode(x); cur=cur->next; } return dummy.next; }\nstring serialize(ListNode* h){ string s="["; bool first=true; while(h){ if(!first) s+=", "; first=false; s+=to_string(h->val); h=h->next; } s+="]"; return s; }\n`;
            source_code = `${listUtils}\n${code}\nint main(){ vector<int> a={${arr1}}; vector<int> b={${arr2}}; ListNode* l1=build(a); ListNode* l2=build(b); ListNode* r=addTwoNumbers(l1,l2); cout<<serialize(r); return 0; }\n`;
            stdin = '';
          } else if ((language || '').toLowerCase() === 'javascript' && /\badd\s+two\s+numbers\b/i.test(chal.title || '')) {
            let l1 = '[]'; let l2 = '[]';
            for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
            const utils = `function ListNode(val, next){ this.val=val??0; this.next=next??null; }\nfunction build(arr){ let d=new ListNode(0), c=d; for(const x of arr){ c.next=new ListNode(Number(x)); c=c.next; } return d.next; }\nfunction serialize(h){ const out=[]; while(h){ out.push(h.val); h=h.next; } return '['+out.join(', ')+']'; }\n`;
            source_code = `${utils}${code}\nconst l1=${l1}; const l2=${l2}; const r = typeof addTwoNumbers==='function' ? addTwoNumbers(build(l1), build(l2)) : null; process.stdout.write(serialize(r));\n`;
            stdin = '';
          }

          const resp = await fetch(`${JUDGE0_URL.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`, { method:'POST', headers, body: JSON.stringify({ language_id: toId(language), source_code, stdin }) });
          const r = await resp.json();
          const statusDesc = r?.status?.description || '';
          const compileErr = r?.compile_output;
          const stderr = r?.stderr;
          const stdout = (r?.stdout || '').toString();
          const t = r?.time ? Math.round(parseFloat(r.time) * 1000) : 0; timeMs += t;
          const m = r?.memory ? Math.round(r.memory / 1024) : 0; memoryMB += m;
          let v='AC';
          if (compileErr) v='CE';
          else if (statusDesc.toLowerCase().includes('time limit')) v='TLE';
          else if (stderr) v='RE';
          else {
            const actual = stdout.trim();
            try {
              console.log(`[WA DEBUG][submit][case ${i + 1}] Expected: |${expected}|`);
              console.log(`[WA DEBUG][submit][case ${i + 1}] Actual:   |${actual}|`);
            } catch (_) {}
            v = actual === expected ? 'AC' : 'WA';
            if (v === 'AC' && (chal?.title || '').match(/two\s+sum/i)) {
              try { console.error('[CRITICAL][submit] WA check matched for Two Sum; verify harness and expected formatting'); } catch (_) {}
            }
          }
          if (v==='AC') passed++; else if (severity(v) > severity(verdict)) verdict = v;
          const inputText = examples[i]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
          const entry = { index: i+1, verdict: v, input: inputText, timeMs: t, memoryMB: m, expected, actual: stdout.trim() };
          caseResults.push(entry);
          detailsArr.push(entry);
        }
      } else {
        // If Judge0 is not configured or fails, assume WA to avoid trivial ACs
        verdict = 'WA'; passed = 0; timeMs = 0; memoryMB = 0;
        for(let i=0;i<total;i++){ caseResults.push({ index: i+1, verdict: 'WA', timeMs: 0, memoryMB: 0 }); detailsArr.push({ index: i+1, verdict: 'WA', input: '', expected: '', actual: '' }); }
      }

      // Update submission with final results
      await Submission.updateOne({ _id: queued._id }, { $set: { verdict, timeMs, memoryMB, status: 'DONE', caseResults, details: detailsArr } });

      // Update user stats and activity if authenticated
      if (userId) {
        const score = chal.points || 100;
        const hadPriorAccepted = await Submission.exists({ userId, challengeId, verdict: 'AC' });
        const user = await User.findById(userId);
        if (user) {
          const firstSolve = !hadPriorAccepted && verdict === 'AC';
          user.stats.totalSubmissions = (user.stats.totalSubmissions || 0) + 1;
          if (firstSolve) {
            user.stats.totalScore = (user.stats.totalScore || 0) + score;
            user.stats.totalSolved = (user.stats.totalSolved || 0) + 1;
            const now = new Date();
            const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const today = startOfDay(now);
            const last = user.lastSolvedAt ? startOfDay(new Date(user.lastSolvedAt)) : null;
            if (!last) user.stats.currentStreak = 1; else {
              const diffDays = Math.round((today - last) / (24*60*60*1000));
              if (diffDays === 0) user.stats.currentStreak = user.stats.currentStreak || 1;
              else if (diffDays === 1) user.stats.currentStreak = (user.stats.currentStreak || 0) + 1;
              else user.stats.currentStreak = 1;
            }
            user.stats.maxStreak = Math.max(user.stats.maxStreak || 0, user.stats.currentStreak || 0);
            user.lastSolvedAt = now;
          }
          await user.save();
        }
        await Activity.create({
          userId,
          type: 'challenge_submit',
          challengeId,
          challengeTitle: chal.title,
          difficulty: chal.difficulty,
          status: verdict === 'AC' ? 'solved' : 'attempted',
          timeSpent: 0,
          metadata: { timeMs, memoryMB },
        });
      }
    })().catch(async () => {
      await Submission.updateOne({ _id: queued._id }, { $set: { status: 'ERROR' } });
    });
  } catch (e) {
    if (!req.user?.sub) return res.status(401).json({ error: 'Unauthorized' });
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getSubmissionStatus = async (req, res) => {
  const { id } = req.params;
  const sub = await Submission.findById(id).lean();
  if (!sub) return res.status(404).json({ error: 'Not found' });
  return res.json({
    id: sub._id.toString(),
    challengeId: sub.challengeId,
    language: sub.language,
    verdict: sub.verdict,
    status: sub.status,
    timeMs: sub.timeMs,
    memoryMB: sub.memoryMB,
    caseResults: sub.caseResults || [],
    details: sub.details || [],
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  });
};

export const saveDraft = async (req, res) => {
  const { challengeId, code, language } = req.body || {};
  if (!challengeId || typeof code !== 'string' || !language) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const userId = req.user?.sub || null; // optional if used with auth in future
  const filter = { challengeId, userId };
  const update = { code, language };
  const opts = { new: true, upsert: true, setDefaultsOnInsert: true };
  const result = await Draft.findOneAndUpdate(filter, update, opts).lean();
  return res.status(200).json({ saved: true, draft: result });
};

export const getDraft = async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user?.sub || null;
  const draft = await Draft.findOne({ challengeId, userId }).lean();
  if (!draft) return res.status(404).json({ error: 'Not found' });
  return res.json(draft);
};
