import { Challenge } from '../models/Challenge.js';
import { Draft } from '../models/Draft.js';
import { Submission } from '../models/Submission.js';
import { User } from '../models/User.js';
import { Activity } from '../models/Activity.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* --------------------------------------------
 * Harness helpers (NEW): Java/Python utilities
 * ------------------------------------------ */

// Remove `package ...;`, remove public before class/interface/enum, and trim BOMs
const sanitizeJavaCode = (userCode = '') => {
  let src = userCode.replace(/^\uFEFF/, ''); // strip BOM
  // strip package lines safely
  src = src.replace(/^\s*package\s+[\w.]+\s*;\s*$/gm, '');
  // remove public ONLY when it precedes class/interface/enum
  src = src.replace(/\bpublic\s+(?=(class|interface|enum)\b)/g, '');
  return src;
};

// Detect if user already defines a main method anywhere
const hasUserMain = (userCode = '') => /public\s+static\s+void\s+main\s*\(\s*String\[\]\s*\w*\s*\)/.test(userCode);

// Compose a full Java program. If user already has a main, return sanitized user code.
// Else, append a deterministic public class Main that runs the provided mainBody.
const composeJavaWithMain = (userCode = '', mainBody = '') => {
  const cleaned = sanitizeJavaCode(userCode);
  if (hasUserMain(cleaned)) return cleaned; // don't double-wrap
  return `${cleaned}\npublic class Main {\n  public static void main(String[] args) throws Exception {\n${mainBody}\n  }\n}\n`;
};

// Shared small helpers
const stripBrackets = (s = '') => (s || '').replace(/^\s*\[|\]\s*$/g, '');
const joinFieldsAsStdin = (arr) => Array.isArray(arr) && arr.length ? arr.map(f => `${f.name}=${f.value}`).join('\n') : '';

/* --------------------------------------------
 * Shared helper: parse key=value style inputs
 * ------------------------------------------ */
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

/* --------------------------------------------
 * Seed logic (unchanged except small projection)
 * ------------------------------------------ */
const ensureSeeded = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const lcPath = path.resolve(__dirname, '../data/challenges.seed.lc.json');
  const legacyPath = path.resolve(__dirname, '../data/challenges.seed.json');
  const mergedPath = path.resolve(__dirname, '../data/merged_problems.json');
  const subsetPath = path.resolve(__dirname, '../data/merged_subset.json');
  // If DB already has data, don't attempt to read seed files
  const existing = await Challenge.countDocuments();
  if (existing > 0) return;
  let rawItems = [];
  try {
    if (existsSync(mergedPath)) {
      const rawMerged = readFileSync(mergedPath, 'utf-8');
      const merged = JSON.parse(rawMerged);
      if (merged && Array.isArray(merged.questions)) rawItems = merged.questions;
      else if (Array.isArray(merged)) rawItems = merged;
    }
    if ((!rawItems || !rawItems.length) && existsSync(subsetPath)) {
      const rawSubset = readFileSync(subsetPath, 'utf-8');
      const subset = JSON.parse(rawSubset);
      if (subset && Array.isArray(subset.questions)) rawItems = subset.questions;
      else if (subset && Array.isArray(subset.items)) rawItems = subset.items;
      else if (subset && Array.isArray(subset.problems)) rawItems = subset.problems;
      else if (Array.isArray(subset)) rawItems = subset;
    }
    if ((!rawItems || !rawItems.length) && existsSync(lcPath)) {
      const rawLc = readFileSync(lcPath, 'utf-8');
      if (rawLc && rawLc.trim().startsWith('[')) rawItems = JSON.parse(rawLc);
    }
    if ((!rawItems || !rawItems.length) && existsSync(legacyPath)) {
      const legacyRaw = readFileSync(legacyPath, 'utf-8');
      rawItems = JSON.parse(legacyRaw);
    }
  } catch (e) {
    // Ignore seed read errors; if DB is empty and we couldn't seed, just return
  }
  if (!rawItems || !rawItems.length) {
    return;
  }

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
      code: `# ${title}\n# Reads newline-separated key=value pairs from stdin\nimport sys\nraw = sys.stdin.read().strip().splitlines()\ninputs = {}\nfor line in raw:\n    if '=' in line:\n        k,v = line.split('=',1)\n        inputs[k.strip()] = v.strip()\n\n# TODO: parse inputs and print output\nprint(\"\")\n`,
    },
    java: {
      name: 'java',
      code: `// ${title}\nimport java.io.*;\nimport java.util.*;\nclass Solution {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        String s; Map<String,String> inputs = new HashMap<>();\n        while ((s = br.readLine()) != null) {\n            int idx = s.indexOf('=');\n            if (idx > 0) { inputs.put(s.substring(0,idx).trim(), s.substring(idx+1).trim()); }\n        }\n        // TODO: parse inputs and print output\n        System.out.print(\"\");\n    }\n}\n`,
    },
    javascript: {
      name: 'javascript',
      code: `// ${title}\n// Reads newline-separated key=value pairs from stdin\nconst fs = require('fs');\nconst raw = fs.readFileSync(0,'utf8').trim().split(/\\n+/).filter(Boolean);\nconst inputs = {};\nfor (const line of raw) { const i = line.indexOf('='); if (i>0) inputs[line.slice(0,i).trim()] = line.slice(i+1).trim(); }\n\n// TODO: parse inputs and print output\nprocess.stdout.write('');\n`,
    },
    cpp: {
      name: 'cpp',
      code: `// ${title}\n#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    ios::sync_with_stdio(false); cin.tie(nullptr);\n    string line; unordered_map<string,string> inputs;\n    while (getline(cin, line)) { auto pos = line.find('='); if (pos!=string::npos) inputs[line.substr(0,pos)] = line.substr(pos+1); }\n    // TODO: parse inputs and print output\n    cout << \"\";\n    return 0;\n}\n`,
    },
  });

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

// Helper: detect if user code already defines a ListNode (class/struct/function)
const definesListNode = (src) => {
  if (!src || typeof src !== 'string') return false;
  return /\bclass\s+ListNode\b/.test(src) || /\bstruct\s+ListNode\b/.test(src) || /\bfunction\s+ListNode\b/.test(src);
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

  const items = rawItems.map((it, idx) => {
    if (it.problem_id || it.frontend_id || it.problem_slug || it.topics || it.code_snippets || it.hints) {
      // Prefer explicit frontend_id / problem_id, otherwise fall back to array index (1-based)
      const numId = String(it.frontend_id ?? it.problem_id ?? it.numId ?? it.id ?? (idx + 1));
      const title = it.title || it.name || '';
      const difficulty = it.difficulty || 'Easy';
      const category = (Array.isArray(it.topics) && it.topics.length ? it.topics[0] : it.category) || 'General';
      const description = it.description || '';
      const examples = Array.isArray(it.examples)
        ? it.examples
            .map((ex) => {
              if (ex.example_text) {
                if (isJudgeSnippet(ex.example_text)) {
                  return null;
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
      const rawPrivate = it.private_tests || it.privateTests || it.hidden_tests || it.hiddenTests || [];
      const privateTests = Array.isArray(rawPrivate)
        ? rawPrivate.map((t) => ({ input: (t.input ?? t.in ?? '').toString(), output: (t.output ?? t.out ?? '').toString() }))
        : [];
      let rawSnippets = it.code_snippets || it.codeSnippets || defaultSnippets(title);
      if (rawSnippets && typeof rawSnippets === 'object') {
        rawSnippets = Object.fromEntries(Object.entries(rawSnippets).map(([k, v]) => {
          if (v && typeof v === 'object' && typeof v.code === 'string') return [k, v];
          if (typeof v === 'string') return [k, { name: k, code: v }];
          return [k, { name: k, code: '' }];
        }));
      }

      // Special-case stubs
      if (/\badd\s+two\s+numbers\b/i.test(title)) {
          rawSnippets = {
            ...rawSnippets,
            cpp: { name: 'cpp', code: `// Add Two Numbers (non-functional stub)\nstruct ListNode { int val; ListNode *next; ListNode(): val(0), next(nullptr) {} ListNode(int x): val(x), next(nullptr) {} ListNode(int x, ListNode *n): val(x), next(n) {} };\nListNode* addTwoNumbers(ListNode* l1, ListNode* l2) { return nullptr; }\n` },
            // For Java default stub, do NOT predefine ListNode; the harness will inject it at runtime when necessary
            java: { name: 'java', code: `// Add Two Numbers (non-functional stub)\nclass Solution {\n    public ListNode addTwoNumbers(ListNode l1, ListNode l2) { return new ListNode(0); }\n}\n` },
            python: { name: 'python', code: `# Add Two Numbers (non-functional stub)\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\nclass Solution:\n    def addTwoNumbers(self, l1, l2):\n        return None\n` },
            javascript: { name: 'javascript', code: `// Add Two Numbers (non-functional stub)\nfunction ListNode(val, next) { this.val = (val===undefined?0:val); this.next = (next===undefined?null:next); }\nvar addTwoNumbers = function(l1, l2) { return new ListNode(0); };\n` },
          };
        }
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

    // Legacy
    const title = it.title || '';
    const category = it.category || 'General';
    return {
      numId: String(it.numId || it.id || (idx + 1)),
      title,
      difficulty: it.difficulty || 'Easy',
      category,
      acceptance: it.acceptance ?? 0,
      points: it.points ?? 0,
      description: it.description || '',
      examples: it.examples || [],
      privateTests: it.privateTests || [],
      constraints: it.constraints || [],
      frontendId: String(it.numId || it.id || (idx + 1)),
      problemId: String(it.numId || it.id || (idx + 1)),
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
    slug: 1,           // include slug so it appears in response
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

/* --------------------------------------------
 * Small per-problem harness composers
 * (Keep behavior but route via helpers)
 * ------------------------------------------ */

const buildTwoSumHarness = {
  java: (userCode, fields) => {
    let numsVal = '[]', targetVal = '0';
    for (const f of fields) {
      if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString();
      if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString();
    }
    const javaArrayLiteral = `new int[]{${stripBrackets(numsVal)}}`;
    const body = [
      `    int[] nums = ${javaArrayLiteral};`,
      `    int target = ${targetVal};`,
      `    int[] result = new Solution().twoSum(nums, target);`,
      `    System.out.print(java.util.Arrays.toString(result).replace(" ", ""));`
    ].join('\n');
    return composeJavaWithMain(userCode, body);
  },
  cpp: (userCode, fields) => {
    let numsVal = '[]', targetVal = '0';
    for (const f of fields) {
      if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString();
      if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString();
    }
    const vecInit = stripBrackets(numsVal);
    return `#include <bits/stdc++.h>\nusing namespace std;\n${userCode}\nint main(){ vector<int> nums={${vecInit}}; int target=${targetVal}; vector<int> res=twoSum(nums,target); cout<<"["; for(size_t i=0;i<res.size();++i){ if(i) cout<<","; cout<<res[i]; } cout<<"]"; return 0; }\n`;
  },
  js: (userCode, fields) => {
    let numsVal = '[]', targetVal = '0';
    for (const f of fields) {
      if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString();
      if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString();
    }
    return `${userCode}\nconst nums=${numsVal}; const target=${targetVal}; const res = typeof twoSum==='function'? twoSum(nums, target) : []; const out = '[' + (Array.isArray(res)? res.join(','): '') + ']'; process.stdout.write(out);\n`;
  },
  python: (userCode, fields) => {
    let numsVal = '[]', targetVal = '0';
    for (const f of fields) {
      if (/^nums$/i.test(f.name)) numsVal = (f.value || '').toString();
      if (/^target$/i.test(f.name)) targetVal = (f.value || '').toString();
    }
    return `${userCode}
import sys, traceback
nums = ${numsVal}
target = ${targetVal}
try:
    try:
        res = Solution().twoSum(nums, target)
    except Exception:
        res = twoSum(nums, target)
except Exception:
    traceback.print_exc()
    res = []
print('[' + ','.join(str(x) for x in (res if isinstance(res, list) else [])) + ']')
`;
  },
};

const buildAddTwoNumbersHarness = {
  java: (userCode, fields) => {
    let l1 = '[]', l2 = '[]';
    for (const f of fields) {
      if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString();
      if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString();
    }
    const needList = !definesListNode(userCode);
    const listUtils = needList ? `class ListNode{ int val; ListNode next; ListNode(){} ListNode(int v){ val=v; } ListNode(int v, ListNode n){ val=v; next=n; } }
class LL { static ListNode build(int[] a){ ListNode d=new ListNode(0), c=d; for(int x: a){ c.next=new ListNode(x); c=c.next; } return d.next; } static String ser(ListNode h){ StringBuilder sb=new StringBuilder("["); boolean first=true; while(h!=null){ if(!first) sb.append(','); first=false; sb.append(h.val); h=h.next; } sb.append(']'); return sb.toString(); } }
` : '';
    const body = [
      `    int[] a=new int[]{${stripBrackets(l1)}};`,
      `    int[] b=new int[]{${stripBrackets(l2)}};`,
      `    ListNode r=new Solution().addTwoNumbers(LL.build(a), LL.build(b));`,
      `    System.out.print(LL.ser(r));`
    ].join('\n');
    const cleaned = sanitizeJavaCode(`${userCode}\n${listUtils}`);
    return composeJavaWithMain(cleaned, body);
  },
  cpp: (userCode, fields) => {
    let l1 = '[]', l2 = '[]';
    for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
    const arr1 = stripBrackets(l1);
    const arr2 = stripBrackets(l2);
  const needList = !definesListNode(userCode);
  const listUtils = needList ? `#include <bits/stdc++.h>
using namespace std;
struct ListNode{ int val; ListNode* next; ListNode(int x): val(x), next(nullptr) {} };
ListNode* build(const vector<int>& v){ ListNode dummy(0); ListNode* cur=&dummy; for(int x: v){ cur->next=new ListNode(x); cur=cur->next; } return dummy.next; }
string serialize(ListNode* h){ string s="["; bool first=true; while(h){ if(!first) s+=","; first=false; s+=to_string(h->val); h=h->next; } s+="]"; return s; }
` : '';
  return `${listUtils}\n${userCode}\nint main(){ vector<int> a={${arr1}}; vector<int> b={${arr2}}; ListNode* l1=build(a); ListNode* l2=build(b); ListNode* r=addTwoNumbers(l1,l2); cout<<serialize(r); return 0; }\n`;
  },
  js: (userCode, fields) => {
    let l1 = '[]', l2 = '[]';
    for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
  const needList = !definesListNode(userCode);
  const utils = needList ? `function ListNode(val, next){ this.val=val??0; this.next=next??null; }
function build(arr){ let d=new ListNode(0), c=d; for(const x of arr){ c.next=new ListNode(Number(x)); c=c.next; } return d.next; }
function serialize(h){ const out=[]; while(h){ out.push(h.val); h=h.next; } return '['+out.join(',')+']'; }
` : '';
  // Try top-level function first, then Solution class method if present
  return `${utils}${userCode}\nconst l1=${l1}; const l2=${l2};\nlet r = null;\ntry {\n  if (typeof addTwoNumbers === 'function') r = addTwoNumbers(build(l1), build(l2));\n  else if (typeof Solution === 'function' && typeof (new Solution()).addTwoNumbers === 'function') r = (new Solution()).addTwoNumbers(build(l1), build(l2));\n} catch(e) { console.error(e && e.stack? e.stack : e); r = null; }\nprocess.stdout.write(serialize(r));\n`;
  },
  python: (userCode, fields) => {
    let l1 = '[]', l2 = '[]';
    for (const f of fields) { if (/^l1$/i.test(f.name)) l1 = (f.value || '').toString(); if (/^l2$/i.test(f.name)) l2 = (f.value || '').toString(); }
    const needList = !definesListNode(userCode);
    const helper = needList ? `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build(a):
    d = ListNode(0); c = d
    for x in a:
        c.next = ListNode(int(x)); c = c.next
    return d.next

def ser(h):
    out = []
    while h:
        out.append(h.val)
        h = h.next
    return '[' + ','.join(str(x) for x in out) + ']'
` : '';
    return `${userCode}\n${helper}\nimport sys, traceback
try:
    r = Solution().addTwoNumbers(build(${l1}), build(${l2}))
except Exception:
    try:
        r = addTwoNumbers(build(${l1}), build(${l2}))
    except Exception:
        r = None
print(ser(r))
`;
  },
};

// Convert title -> camelCase function name, e.g. "Two Sum" -> twoSum
const titleToFuncName = (title = '') => {
  if (!title || typeof title !== 'string') return 'solve';
  const parts = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'solve';
  return parts.map((p, i) => i === 0 ? p : (p[0].toUpperCase() + p.slice(1))).join('');
};

// Expanded candidate names inferred from a problem title
const funcCandidates = (title = '') => {
  const t = (title || '').trim().toLowerCase();
  const primary = titleToFuncName(title);
  const norm = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const m = new Map();
  const add = (s) => { if (s && !m.has(s)) m.set(s, true); };
  add(primary);
  // Common LeetCode canonical names for a few popular problems
  const known = {
    'two sum': ['twoSum', 'two_sum'],
    'add two numbers': ['addTwoNumbers', 'add_two_numbers'],
    'palindrome number': ['isPalindrome', 'is_palindrome'],
    'median of two sorted arrays': ['findMedianSortedArrays', 'medianOfTwoSortedArrays', 'find_median_sorted_arrays', 'median_of_two_sorted_arrays'],
    'zigzag conversion': ['convert', 'zigzagConvert', 'zigzag_conversion'],
    'regular expression matching': ['isMatch', 'is_match', 'regexMatch', 'regex_match'],
    'reverse integer': ['reverse', 'reverseInteger', 'reverse_integer'],
    'rotate image': ['rotate', 'rotateImage', 'rotate_image'],
    'remove nth node from end of list': ['removeNthFromEnd', 'removeNthNodeFromEndOfList', 'remove_nth_from_end', 'remove_nth_node_from_end_of_list'],
    'longest substring without repeating characters': ['lengthOfLongestSubstring', 'length_of_longest_substring'],
    'longest palindromic substring': ['longestPalindrome', 'longest_palindromic_substring'],
    'valid parentheses': ['isValid','validParentheses'],
    'container with most water': ['maxArea','containerWithMostWater'],
    'merge two sorted lists': ['mergeTwoLists'],
    'remove duplicates from sorted array': ['removeDuplicates'],
    'search insert position': ['searchInsert'],
  };
  Object.entries(known).forEach(([k, arr]) => {
    if (norm.includes(k)) arr.forEach(add);
  });
  // Also add snake_case variant of primary
  add(primary.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()));
  // Add a very common generic name used by many stubs
  add('solve');
  return Array.from(m.keys());
};

// Generic harness builder: attempts to call a function inferred from the title
const buildGenericHarness = {
  java: (userCode, fields, title) => {
    const cand = funcCandidates(title);
    // Prepare arguments in order of fields
    const args = fields.map(f => f.name).join(', ');
    // For array-like inputs, support: 1D int[], 1D String[], and 2D int[][].
    // Build ListNode only for 1D numeric arrays and when no 2D arrays are present.
    const isArr = (s) => /^\[.*\]$/.test((s||'').toString().trim());
    const isStrArr = (s) => {
      const v = (s||'').toString().trim();
      return /^\[.*\]$/.test(v) && /"/.test(v);
    };
    const isNumArr = (s) => {
      const v = (s||'').toString().trim();
      return /^\[.*\]$/.test(v) && !/"/.test(v);
    };
    const is2D = (s) => /^\s*\[\s*\[/.test((s||'').toString().trim());
    const any2D = fields.some(f => is2D(f.value));
    const needsList = !any2D && fields.some(f => isNumArr(f.value));
    const java2DHelper = any2D ? `class J { static String ser2D(int[][] m){ StringBuilder sb=new StringBuilder("["); for(int i=0;i<m.length;i++){ if(i>0) sb.append(','); sb.append('['); for(int j=0;j<m[i].length;j++){ if(j>0) sb.append(','); sb.append(m[i][j]); } sb.append(']'); } sb.append(']'); return sb.toString(); } }\n` : '';
    const listHelpers = needsList ? `class LL { 
  static Object build(Class<?> LNC, int[] a){
    try{
      java.lang.reflect.Constructor<?> cons = null;
      for (java.lang.reflect.Constructor<?> c : LNC.getDeclaredConstructors()) {
        Class<?>[] ps = c.getParameterTypes();
        if (ps.length == 0 || (ps.length==1 && (ps[0]==int.class || ps[0]==Integer.class))) { cons = c; break; }
      }
      Object dummy = LNC.getDeclaredConstructor().newInstance();
      java.lang.reflect.Field nextF = LNC.getDeclaredField("next");
      nextF.setAccessible(true);
      java.lang.reflect.Field valF = null;
      try { valF = LNC.getDeclaredField("val"); valF.setAccessible(true); } catch(Throwable __miss) {}
      Object cur = dummy;
      for (int x : a) {
        Object node;
        try { node = LNC.getDeclaredConstructor(int.class).newInstance(x); }
        catch(Throwable __alt){ node = LNC.getDeclaredConstructor().newInstance(); if (valF!=null) valF.set(node, Integer.valueOf(x)); }
        nextF.set(cur, node);
        cur = node;
      }
      return nextF.get(dummy);
    } catch(Throwable __e){ return null; }
  }
  static String ser(Object h){
    if (h == null) return "[]";
    try{
      Class<?> LNC = h.getClass();
      java.lang.reflect.Field nextF = LNC.getDeclaredField("next"); nextF.setAccessible(true);
      java.lang.reflect.Field valF = null; try { valF = LNC.getDeclaredField("val"); valF.setAccessible(true); } catch(Throwable __miss) {}
      StringBuilder sb=new StringBuilder("["); boolean first=true; Object cur=h; 
      while(cur!=null){ if(!first) sb.append(','); first=false; Object v = (valF!=null? valF.get(cur) : null); sb.append(String.valueOf(v)); cur = nextF.get(cur); }
      sb.append(']'); return sb.toString();
    } catch(Throwable __e){ return String.valueOf(h); }
  }
}
` : '';
    // Declarations: build variables per type
    const assigns = fields.map(f => {
      const v = (f.value || '').toString().trim();
      if (is2D(v)) {
        const cleaned = v.replace(/\s+/g,'');
        const javaInit = cleaned.replace(/^\[\[/,'{{').replace(/\]\]$/,'}}').replace(/\],\[/g,'},{');
        return `int[][] ${f.name} = new int[][]${javaInit};`;
      }
      if (isNumArr(v)) {
        const arrInit = v.replace(/^\s*\[|\]\s*$/g, '');
        return `int[] ${f.name}_arr = new int[]{${arrInit}};`;
      }
      if (isStrArr(v)) {
        const arrInit = v.replace(/^\s*\[|\]\s*$/g, '');
        return `String[] ${f.name} = new String[]{${arrInit}};`;
      }
      if (/^-?\d+$/.test(v)) return `int ${f.name} = ${v};`;
      if (/^(true|false)$/i.test(v)) return `boolean ${f.name} = ${v.toLowerCase()};`;
      const unquoted = v.replace(/^"|"$/g, '');
      return `String ${f.name} = "${unquoted.replace(/"/g, '\\"')}";`;
    }).join('\n    ');
    // Type/value pairs A: use primitive/array/string as-is (arrays -> int[] using <name>_arr)
    const typeLitsA = fields.map(f => {
      const v = (f.value || '').toString().trim();
      if (is2D(v)) return 'int[][].class';
      if (isNumArr(v)) return 'int[].class';
      if (isStrArr(v)) return 'String[].class';
      if (/^-?\d+$/.test(v)) return 'int.class';
      if (/^(true|false)$/i.test(v)) return 'boolean.class';
      return 'String.class';
    }).join(', ');
    const valExprsA = fields.map(f => {
      const v = (f.value || '').toString().trim();
      if (is2D(v)) return `${f.name}`;
      if (isNumArr(v)) return `${f.name}_arr`;
      if (isStrArr(v)) return `${f.name}`;
      if (/^-?\d+$/.test(v)) return `Integer.valueOf(${f.name})`;
      if (/^(true|false)$/i.test(v)) return `Boolean.valueOf(${f.name})`;
      return f.name;
    }).join(', ');
    // types/values B will be constructed at runtime using resolved LNC

    const namesArr = JSON.stringify(cand);
    const namesArrJava = `new String[]{ ${cand.map(n => '"' + String(n).replace(/"/g, '\\"') + '"').join(', ')} }`;
    const bodyLines = [];
    if (java2DHelper) bodyLines.push(java2DHelper);
    // Helper to JSON-quote strings safely in Java generation (uses char literals to avoid fragile escapes)
    bodyLines.push(`class Q { static String q(String s){ StringBuilder sb=new StringBuilder(); sb.append((char)34); for (int i=0;i<s.length();i++){ char c=s.charAt(i); if (c=='\\' || c=='"') sb.append('\\'); sb.append(c); } sb.append((char)34); return sb.toString(); } }`);
    if (listHelpers) bodyLines.push(listHelpers);
    if (assigns) bodyLines.push(assigns);
    bodyLines.push(`    try {
      Object out = null;
      Class<?> solCls = Solution.class;
      Object sol = null;
      try { sol = solCls.getDeclaredConstructor().newInstance(); } catch (Throwable __inst) { sol = null; }
      String[] __names = ${namesArrJava};
      Class<?>[] __typesA = new Class<?>[]{ ${typeLitsA} };
      Object[] __valsA = new Object[]{ ${valExprsA} };
      ${(!any2D && needsList) ? `// Resolve user's ListNode class if present (only for 1D LL problems)
      Class<?> LNC = null; try { LNC = Class.forName("ListNode"); } catch(Throwable __e1){ try { LNC = Class.forName("Solution$ListNode"); } catch(Throwable __e2){ LNC = null; } }
      // Build B types/values dynamically
      Class<?>[] __typesB = (LNC!=null) ? new Class<?>[]{ LNC${fields.filter(f=>!isNumArr(f.value)).map(f=>`, ${/^-?\d+$/.test((f.value||'').toString().trim())?'int.class': (/^(true|false)$/i.test((f.value||'').toString().trim())?'boolean.class':'String.class')}`).join('')} } : new Class<?>[]{};
      Object[] __valsB = (LNC!=null) ? new Object[]{ ${fields.map(f=>{
        const v=(f.value||'').toString().trim();
        if (isNumArr(v)) return `LL.build(LNC, ${f.name}_arr)`;
        if (/^-?\d+$/.test(v)) return `Integer.valueOf(${f.name})`;
        if (/^(true|false)$/i.test(v)) return `Boolean.valueOf(${f.name})`;
        return f.name;
      }).join(', ')} } : new Object[]{};` : `Class<?> LNC = null; Class<?>[] __typesB = new Class<?>[]{}; Object[] __valsB = new Object[]{};`}
      for (int __i = 0; __i < __names.length && out == null; __i++) {
        String __nm = __names[__i];
        try {
          java.lang.reflect.Method m = null;
          // Try signature A
          try { m = solCls.getMethod(__nm, __typesA); } catch (NoSuchMethodException __e1) { try { m = solCls.getDeclaredMethod(__nm, __typesA); m.setAccessible(true); } catch (Throwable __e2) { m = null; } }
          if (m != null) { out = sol != null ? m.invoke(sol, __valsA) : m.invoke(null, __valsA); }
          // Try signature B if still null
          if (out == null) {
            m = null;
            try { m = solCls.getMethod(__nm, __typesB); } catch (NoSuchMethodException __e3) { try { m = solCls.getDeclaredMethod(__nm, __typesB); m.setAccessible(true); } catch (Throwable __e4) { m = null; } }
            if (m != null) { out = sol != null ? m.invoke(sol, __valsB) : m.invoke(null, __valsB); }
          }
        } catch (Throwable __call) { /* try next */ }
      }
      // Fallback: try candidate names again allowing compatible param boxing, but do NOT scan unrelated methods
      if (out == null) {
        try {
          for (String __nm : __names) {
            try {
              java.lang.reflect.Method[] __methods = solCls.getDeclaredMethods();
              for (java.lang.reflect.Method m : __methods) {
                if (!m.getName().equals(__nm)) continue;
                Class<?>[] pts = m.getParameterTypes();
                // Match either A or B arity
                if (pts.length != __typesA.length) continue;
                boolean ok = true;
                for (int i = 0; i < __typesA.length; i++) {
                  Class<?> a = pts[i];
                  Class<?> b = __typesA[i];
                  if (a.isPrimitive()) {
                    if (a == int.class) a = Integer.class; else if (a == boolean.class) a = Boolean.class; else if (a == long.class) a = Long.class; else if (a == double.class) a = Double.class; else if (a == float.class) a = Float.class; else if (a == char.class) a = Character.class; else if (a == byte.class) a = Byte.class; else if (a == short.class) a = Short.class;
                  }
                  if (b.isPrimitive()) {
                    if (b == int.class) b = Integer.class; else if (b == boolean.class) b = Boolean.class; else if (b == long.class) b = Long.class; else if (b == double.class) b = Double.class; else if (b == float.class) b = Float.class; else if (b == char.class) b = Character.class; else if (b == byte.class) b = Byte.class; else if (b == short.class) b = Short.class;
                  }
                  if (!a.isAssignableFrom(b)) { ok = false; break; }
                }
                if (!ok) continue;
                try {
                  m.setAccessible(true);
                  boolean isStatic = java.lang.reflect.Modifier.isStatic(m.getModifiers());
                  out = isStatic ? m.invoke(null, __valsA) : (sol != null ? m.invoke(sol, __valsA) : null);
                  if (out != null || isStatic) break;
                } catch (Throwable __ignore) { /* try next */ }
              }
              if (out != null) break;
            } catch (Throwable __step) { /* try next name */ }
          }
        } catch (Throwable __nope) { /* ignore */ }
      }
      // Last-resort fallback: if exactly one declared method matches by arity/type assignability, invoke it
      if (out == null) {
        try {
          java.util.List<java.lang.reflect.Method> __cands = new java.util.ArrayList<>();
          for (java.lang.reflect.Method m : solCls.getDeclaredMethods()) {
            Class<?>[] pts = m.getParameterTypes();
            if (pts.length != __typesA.length) continue;
            boolean ok = true;
            for (int i = 0; i < __typesA.length; i++) {
              Class<?> a = pts[i]; Class<?> b = __typesA[i];
              if (a.isPrimitive()) {
                if (a == int.class) a = Integer.class; else if (a == boolean.class) a = Boolean.class; else if (a == long.class) a = Long.class; else if (a == double.class) a = Double.class; else if (a == float.class) a = Float.class; else if (a == char.class) a = Character.class; else if (a == byte.class) a = Byte.class; else if (a == short.class) a = Short.class;
              }
              if (b.isPrimitive()) {
                if (b == int.class) b = Integer.class; else if (b == boolean.class) b = Boolean.class; else if (b == long.class) b = Long.class; else if (b == double.class) b = Double.class; else if (b == float.class) b = Float.class; else if (b == char.class) b = Character.class; else if (b == byte.class) b = Byte.class; else if (b == short.class) b = Short.class;
              }
              if (!a.isAssignableFrom(b)) { ok = false; break; }
            }
            if (ok) __cands.add(m);
          }
          if (__cands.size() == 1) {
            java.lang.reflect.Method m = __cands.get(0);
            m.setAccessible(true);
            boolean isStatic = java.lang.reflect.Modifier.isStatic(m.getModifiers());
            out = isStatic ? m.invoke(null, __valsA) : (sol != null ? m.invoke(sol, __valsA) : null);
          }
        } catch (Throwable __ignore) { /* no-op */ }
      }
      if (out == null) {
        try { 
          ${any2D ? (()=>{ const first2D = (fields.find(f=>is2D(f.value))||{}).name || ''; return first2D ? `System.out.print(J.ser2D(${first2D}));` : 'System.out.print("");'; })() : ''}
          ${(!any2D && needsList) ? 'if (LNC != null) System.out.print("[]"); else System.out.print("");' : ''}
        } catch(Throwable __ignore){ System.out.print(""); }
      }
      else if (out.getClass().isArray()) {
        if (out instanceof int[]) System.out.print(java.util.Arrays.toString((int[])out));
        else if (out instanceof long[]) System.out.print(java.util.Arrays.toString((long[])out));
        else if (out instanceof double[]) System.out.print(java.util.Arrays.toString((double[])out));
        else if (out instanceof boolean[]) System.out.print(java.util.Arrays.toString((boolean[])out));
        else if (out instanceof char[]) System.out.print(java.util.Arrays.toString((char[])out));
        else System.out.print(java.util.Arrays.toString((Object[])out));
      } else if (out instanceof java.lang.Number) {
        if (out instanceof java.lang.Double || out instanceof java.lang.Float) {
          java.text.DecimalFormat __df = new java.text.DecimalFormat("0.00000");
          System.out.print(__df.format(((java.lang.Number)out).doubleValue()));
        } else {
          System.out.print(out.toString());
        }
      } else if (out instanceof java.lang.String) {
        System.out.print(out.toString());
      } else if (out instanceof java.util.Collection) {
        try {
          java.util.Collection<?> coll = (java.util.Collection<?>) out;
          // Detect nested collection of strings
          boolean nested = false, allStr = true;
          for (Object e : coll) { if (e instanceof java.util.Collection) { nested = true; break; } }
          if (!nested) {
            // Flat collection -> treat as array of strings/numbers, quote strings
            java.util.List<String> items = new java.util.ArrayList<>();
            for (Object e : coll) {
              if (e instanceof String) items.add(Q.q((String)e));
              else items.add(String.valueOf(e));
            }
            java.util.Collections.sort(items);
            System.out.print("[" + String.join(",", items) + "]");
          } else {
            // Nested: List<List<...>>; assume strings for stable compare
            java.util.List<java.util.List<String>> groups = new java.util.ArrayList<>();
            for (Object g : coll) {
              if (g instanceof java.util.Collection) {
                java.util.List<String> gl = new java.util.ArrayList<>();
                for (Object e : (java.util.Collection<?>) g) {
                  if (e instanceof String) gl.add((String)e); else gl.add(String.valueOf(e));
                }
                java.util.Collections.sort(gl);
                groups.add(gl);
              }
            }
            java.util.Collections.sort(groups, (a,b) -> {
              if (a.size() != b.size()) return Integer.compare(a.size(), b.size());
              for (int i=0; i<Math.min(a.size(), b.size()); i++) {
                int c = a.get(i).compareTo(b.get(i)); if (c!=0) return c;
              }
              return Integer.compare(a.size(), b.size());
            });
            StringBuilder sb = new StringBuilder("[");
            for (int i=0;i<groups.size();i++){
              if (i>0) sb.append(',');
              sb.append('[');
              java.util.List<String> gl = groups.get(i);
              for (int j=0;j<gl.size();j++){
                if (j>0) sb.append(',');
                String s = gl.get(j);
                sb.append(Q.q(s));
              }
              sb.append(']');
            }
            sb.append(']');
            System.out.print(sb.toString());
          }
        } catch (Throwable __serColl) { System.out.print(out.toString()); }
      } else {
        // Try to serialize as a node (has fields val,next) when LL helpers exist; else fallback
        try {
          java.lang.reflect.Field nf = out.getClass().getDeclaredField("next"); nf.setAccessible(true);
          ${needsList ? 'System.out.print(LL.ser(out));' : 'System.out.print(out.toString());'}
        } catch (Throwable __x) { System.out.print(out.toString()); }
      }
    } catch (Exception e) { e.printStackTrace(); }`);
    const body = bodyLines.join('\n');
    const cleaned = sanitizeJavaCode(userCode);
    return composeJavaWithMain(cleaned, body);
  },
  cpp: (userCode, fields, title) => {
    const func = titleToFuncName(title);
    const arrAssigns = fields.map(f => {
      const v = (f.value || '').toString().trim();
      if (/^\[.*\]$/.test(v)) return `vector<int> ${f.name} = {${v.replace(/^\s*\[|\]\s*$/g, '')}};`;
      if (/^-?\d+$/.test(v)) return `int ${f.name} = ${v};`;
      return `string ${f.name} = "${v.replace(/"/g, '\\"')}";`;
    }).join('\n    ');
    const args = fields.map(f => f.name).join(', ');
    return `${userCode}\n#include <bits/stdc++.h>\nusing namespace std;\n\nstatic void printAny(const string& s){ cout<<s; }\nstatic void printAny(const char* s){ cout<<s; }\nstatic void printAny(char c){ cout<<c; }\nstatic void printAny(bool b){ cout<<(b?"true":"false"); }\nstatic void printAny(int x){ cout<<x; }\nstatic void printAny(long long x){ cout<<x; }\nstatic void printAny(double d){ cout.setf(std::ios::fixed); cout<<setprecision(5)<<d; }\nstatic void printAny(float f){ cout.setf(std::ios::fixed); cout<<setprecision(5)<<f; }\n\ntemplate<typename T> static void printAny(const vector<T>& v){ cout<<"["; for (size_t i=0;i<v.size();++i){ if(i) cout<<","; printAny(v[i]); } cout<<"]"; }\n\nint main(){ ${arrAssigns} auto r = ${func}(${args}); printAny(r); return 0; }`;
  },
  js: (userCode, fields, title) => {
    const cand = funcCandidates(title);
    const assigns = fields.map(f => `const ${f.name} = ${f.value || 'undefined'};`).join('\n');
    const tryCalls = cand.map((name) => `if (typeof ${name}==='function') { out = ${name}(${fields.map(f=>f.name).join(',')}); } else if (typeof Solution==='function' && typeof (new Solution())['${name}']==='function') { out = (new Solution())['${name}'](${fields.map(f=>f.name).join(',')}); }`).join(' else ');
    const firstArg = fields[0]?.name || null;
    const body = `${assigns}\ntry { let out = null; ${tryCalls}; let __s=''; if (out === undefined || out === null) { ${firstArg ? `try { __s = JSON.stringify(${firstArg}); } catch(_) { __s = ''; }` : `__s = '';`} } else if (typeof out==='number') { __s = Number.isInteger(out) ? String(out) : out.toFixed(5); } else if (typeof out==='string') { __s = JSON.stringify(out); } else { __s = JSON.stringify(out); } process.stdout.write(__s ?? ''); } catch(e) { console.error(e && e.stack? e.stack : e); }`;
    return `${userCode}\n${body}`;
  },
  python: (userCode, fields, title) => {
    const cand = funcCandidates(title);
    const assigns = fields.map(f => `${f.name} = ${f.value || 'None'}`).join('\n');
    const pyList = JSON.stringify(cand);
    const firstArg = fields[0]?.name || '';
    // Prepare linked-list helpers and per-arg ll variants
    const llPrep = fields.map(f => `${f.name}__ll = build(${f.name}) if isinstance(${f.name}, list) else ${f.name}`).join('\n');
    const llPrepIndented = llPrep ? llPrep.split('\n').map(l => `    ${l}`).join('\n') : '';
    const argsRaw = fields.map(f=>f.name).join(',');
    const argsLL = fields.map(f=>`${f.name}__ll`).join(',');
    const body = `${assigns}
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build(a):
    try:
        it = list(a)
    except Exception:
        return a
    d = ListNode(0); c = d
    for x in it:
        c.next = ListNode(int(x) if isinstance(x, (int, float, str)) and str(x).lstrip('-').isdigit() else x)
        c = c.next
    return d.next

def ser(h):
    out = []
    while h:
        out.append(h.val)
        h = h.next
    return '[' + ','.join(str(x) for x in out) + ']'

import sys, json, traceback, math, inspect
out = None
try:
${llPrepIndented}
    __cands = ${pyList}
    __args = [${argsRaw}]
    __args_ll = [${argsLL}]
    for __name in __cands:
        try:
            out = getattr(Solution(), __name)(*__args)
            break
        except Exception:
            try:
                out = getattr(Solution(), __name)(*__args_ll)
                break
            except Exception:
                try:
                    fn = globals().get(__name)
                    if callable(fn) and not inspect.isclass(fn) and fn.__name__ != 'Solution':
                        try:
                            out = fn(*__args)
                        except Exception:
                            out = fn(*__args_ll)
                        break
                except Exception:
                    pass
    # Fallback: scan Solution methods and globals by arity if still None
    if out is None:
        try:
            __sol = Solution()
            __need = ${fields.length}
            if __need > 0:
                for _n in dir(__sol):
                    try:
                        __fn = getattr(__sol, _n)
                        if callable(__fn):
                            sig = inspect.signature(__fn)
                            req = [p for p in sig.parameters.values() if p.default is p.empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]
                            if len(req) == __need:
                                try:
                                    out = __fn(*__args)
                                    break
                                except Exception:
                                    try:
                                        out = __fn(*__args_ll)
                                        break
                                    except Exception:
                                        pass
                    except Exception:
                        pass
            if out is None and __need > 0:
                for _n, _fn in list(globals().items()):
                    if (inspect.isfunction(_fn) or inspect.ismethod(_fn)) and getattr(_fn, '__name__', '') not in ('Solution',):
                        try:
                            sig = inspect.signature(_fn)
                            req = [p for p in sig.parameters.values() if p.default is p.empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]
                            if len(req) == __need:
                                try:
                                    out = _fn(*__args)
                                    break
                                except Exception:
                                    try:
                                        out = _fn(*__args_ll)
                                        break
                                    except Exception:
                                        pass
                        except Exception:
                            pass
        except Exception:
            pass
    # Normalize accidental Solution object
    try:
        if out is not None and out.__class__.__name__ == 'Solution':
            out = None
    except Exception:
        pass
    if out is None:
        ${firstArg ? `\n        try:\n            # Prefer LL first-arg if available for in-place LL ops\n            sys.stdout.write(ser(${firstArg}__ll) if '${firstArg}__ll' in globals() else json.dumps(${firstArg}, separators=(',',':')))\n        except Exception:\n            sys.stdout.write('')` : `sys.stdout.write('')`}
    else:
        try:
            # If a ListNode was returned, serialize it
            if hasattr(out, 'val') and hasattr(out, 'next') and not hasattr(out, '__iter__'):
                sys.stdout.write(ser(out))
            elif hasattr(out, '__iter__') and not isinstance(out, (str, bytes)):
                sys.stdout.write(json.dumps(list(out), separators=(',',':')))
            elif isinstance(out, float) and not math.isfinite(out):
                sys.stdout.write(str(out))
            elif isinstance(out, float):
                sys.stdout.write(f"{out:.5f}")
            elif isinstance(out, str):
                sys.stdout.write(json.dumps(out))
            else:
                sys.stdout.write(str(out))
        except Exception:
            sys.stdout.write(str(out) if out is not None else '')
except Exception:
    traceback.print_exc()`;
    return `${userCode}\n${body}`;
  }
};

/* --------------------------------------------
 * Run/Submit endpoints
 * ------------------------------------------ */

export const runCode = async (req, res) => {
  const { challengeId, code, language, inputs } = req.body || {};
  if (!challengeId || !code || !language) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const chal = await Challenge.findOne({ $or: [{ numId: challengeId }, { slug: challengeId }] }).lean();
  if (!chal) return res.status(404).json({ error: 'Challenge not found' });
  const examples = Array.isArray(chal.examples) ? chal.examples : [];
  if (!examples.length) return res.status(400).json({ error: 'No test cases for this challenge' });

  const ACE_URL = (process.env.ACE_URL || '').trim();

  const langMap = {
    javascript: 63, js: 63, node: 63,
    python: 71, python3: 71, py: 71,
    java: 62,
    cpp: 54, 'c++': 54, 'cpp17': 54,
  };
  const toId = (lang) => langMap[(lang || '').toLowerCase()] || null;

  const providedStdin = joinFieldsAsStdin(inputs);
  const hasPythonStdin = (src='') => /\b(sys\.stdin\b|input\s*\()/m.test(src || '');
  const parseStdinToFields = (s) => {
    if (!s || typeof s !== 'string') return [];
    return s.split(/\n+/).map((line) => {
      const i = line.indexOf('=');
      if (i > 0) return { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
      return null;
    }).filter(Boolean);
  };

  try {
    if (ACE_URL && toId(language)) {
      const base = ACE_URL.replace(/\/$/, '');
      let passed = 0;
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
        const fields = providedStdin ? parseStdinToFields(providedStdin) : parseFieldsFromInput(examples[i]?.input || '');
        let source_code = code;
        let stdin = providedStdin;

        const isTwoSum = /\btwo\s+sum\b/i.test(chal.title || '');
        const isAddTwoNumbers = /\badd\s+two\s+numbers\b/i.test(chal.title || '');

        const lang = (language || '').toLowerCase();
        if (isTwoSum) {
          if (lang === 'java') source_code = buildTwoSumHarness.java(code, fields);
          else if (lang === 'cpp' || lang === 'c++' || lang === 'cpp17') source_code = buildTwoSumHarness.cpp(code, fields);
          else if (lang === 'javascript' || lang === 'js' || lang === 'node') source_code = buildTwoSumHarness.js(code, fields);
          else if (lang === 'python' || lang === 'py' || lang === 'python3') source_code = buildTwoSumHarness.python(code, fields);
          stdin = '';
        } else if (isAddTwoNumbers) {
          if (lang === 'java') source_code = buildAddTwoNumbersHarness.java(code, fields);
          else if (lang === 'cpp' || lang === 'c++' || lang === 'cpp17') source_code = buildAddTwoNumbersHarness.cpp(code, fields);
          else if (lang === 'javascript' || lang === 'js' || lang === 'node') source_code = buildAddTwoNumbersHarness.js(code, fields);
          else if (lang === 'python' || lang === 'py' || lang === 'python3') source_code = buildAddTwoNumbersHarness.python(code, fields);
          stdin = '';
        } else if (['java', 'python', 'cpp', 'c++', 'cpp17', 'javascript', 'js', 'node'].includes(lang)) {
          // Use the generic harness builder which will try to call a function inferred from the title
          if (process.env.JUDGE_LOG === '1') console.log('Using generic harness for', chal.title);
          if (lang === 'python' && hasPythonStdin(code)) {
            // User program manages stdin/printing; submit as-is
            source_code = code;
          } else {
            source_code = (buildGenericHarness[ (lang==='c++'||lang==='cpp17') ? 'cpp' : (lang==='js'?'js': lang) ] || ((u,f,t)=>u))(code, fields, chal.title || '');
          }
          if (process.env.JUDGE_LOG === '1') console.log('Generated source code:', source_code.slice(0,2000));
          // If user Java code already has a main method, allow stdin so their program can read inputs.
          // Otherwise, for Java we rely on our reflective harness and keep stdin empty.
          if (lang === 'java') {
            stdin = hasUserMain(code) ? (providedStdin || joinFieldsAsStdin(fields)) : '';
          } else {
            stdin = '';
          }
          if (process.env.JUDGE_LOG === '1') console.log('Using stdin:', stdin ? stdin.slice(0,200) : '(none)');
        }

        const langId = toId(language);
        if ((language || '').toLowerCase() === 'java') {
          try {
            // Only normalize visible escapes; do NOT collapse backslashes or quotes
            source_code = source_code
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
          } catch(_) {}
        }
        if (process.env.JUDGE_LOG === '1') console.log('Submitting to ACE:', { language_id: langId, source_code, test_cases: [{ input: stdin, expected_output: expected }] });
        const createResp = await fetch(`${base}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language_id: langId, source_code, test_cases: [{ input: stdin, expected_output: expected }] })
        });
        const created = await createResp.json();
        const token = created?.token;
        if (process.env.JUDGE_LOG === '1') console.log('ACE create response:', created);
        if (process.env.JUDGE_LOG === '1') {
          try { console.log('[ACE RUN][create] token=', token, 'lang=', language, 'stdin=', (stdin||'').slice(0,200), 'source_snippet=', (source_code||'').slice(0,2000)); } catch(_){}
        }
        let fin = null; const started = Date.now();
        for (let tries = 0; tries < 60; tries++) {
          await new Promise(r => setTimeout(r, 250));
          const stat = await fetch(`${base}/submissions/${token}`);
          const data = await stat.json();
          if (data && typeof data.status_id === 'number' && data.status_id !== 1 && data.status_id !== 2) { fin = data; break; }
       } if (process.env.JUDGE_LOG === '1') console.log('ACE final response:', fin);
        if (process.env.JUDGE_LOG === '1') {
          try { console.log('[ACE RUN][finished] token=', token, 'result=', JSON.stringify(fin && (fin.test_cases||fin), null, 0).slice(0,4000)); } catch(_){}
        }
        const tc = fin?.test_cases?.[0] || {};
        const statusId = fin?.status_id ?? 13;
        const stdout = (tc.actual_output || tc.stdout || '').toString();
        const stderr = tc.stderr || '';
        const t = Math.max(0, (Date.now() - started));
        aggTime += t;

        const __eq = (a, b) => {
          if (a === b) return true;
          const sa = (a ?? '').toString().trim();
          const sb = (b ?? '').toString().trim();
          // case-insensitive boolean equivalence
          const la = sa.toLowerCase();
          const lb = sb.toLowerCase();
          if ((la === 'true' || la === 'false') && (lb === 'true' || lb === 'false')) {
            return la === lb;
          }
          try { const pa = JSON.parse(sa); const pb = JSON.parse(sb); if (typeof pa === 'boolean' && typeof pb === 'boolean') return pa === pb; } catch(_) {}
          // string vs JSON-quoted string
          try { const pb = JSON.parse(sb); if (typeof pb === 'string' && sa === pb) return true; } catch(_) {}
          try { const pa = JSON.parse(sa); if (typeof pa === 'string' && pa === JSON.parse(sb)) return true; } catch(_) {}
          // array equivalence: JSON vs Java-style [a, b, c]
          const parseArr = (s) => {
            try { const x = JSON.parse(s); if (Array.isArray(x)) return x.map((v)=>v); } catch(_) {}
            if (/^\[.*\]$/.test(s)) {
              const inner = s.slice(1, -1).trim();
              if (!inner) return [];
              const parts = inner.split(/\s*,\s*/).map((p)=>{
                const q = p.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
                return q;
              });
              return parts;
            }
            return null;
          };
          const aa = parseArr(sa); const bb = parseArr(sb);
          if (aa && bb) {
            if (aa.length !== bb.length) return false;
            for (let i=0;i<aa.length;i++) {
              const va = (aa[i] ?? '').toString();
              const vb = (bb[i] ?? '').toString();
              // reuse scalar rules: numbers, booleans, or exact string
              const lva = va.toLowerCase(); const lvb = vb.toLowerCase();
              if ((lva === 'true' || lva === 'false') && (lvb === 'true' || lvb === 'false')) { if (lva !== lvb) return false; continue; }
              if (!isNaN(Number(va)) && !isNaN(Number(vb))) { if (Number(va) !== Number(vb)) return false; continue; }
              if (va !== vb) return false;
            }
            return true;
          }
          // numeric equivalence
          if (!isNaN(Number(sa)) && !isNaN(Number(sb))) return Number(sa) === Number(sb);
          return false;
        };
        let v = 'AC';
        if (statusId === 8) v = 'CE';
        else if (statusId === 5) v = 'TLE';
        else if (statusId === 7) v = 'RE';
        else {
          const actual = stdout.trim();
          const exp = (expected || '').toString();
          v = __eq(actual, exp) ? 'AC' : 'WA';
        }
        if (v === 'AC') passed += 1; else if (severity(v) > severity(finalVerdict)) finalVerdict = v;
        const inputText = examples[i]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
        caseLines.push(`Test Case ${i + 1}: ${v === 'AC' ? '✅ Passed' : `❌ ${v}`}\ninput: ${inputText}\nexpected: ${expected || '(empty)'}\nactual: ${stdout.trim() || '(empty)'}${stderr ? `\nstderr: ${stderr}` : ''}`);
        caseResults.push({ index: i + 1, verdict: v, input: inputText, expected, actual: stdout.trim(), timeMs: t, memoryMB: 0, stderr });
      }

      const detailsText = caseLines.join('\n');
      return res.json({ success: true, data: { verdict: finalVerdict, passed, total: order.length, time: aggTime, memory: 0, caseResults, details: caseResults, rawDetails: detailsText } });
    }
  } catch (e) {
    // fallthrough to simulated
  }

  // Fallback simulated result
  try {
    const examples2 = Array.isArray(chal?.examples) ? chal.examples : [];
    const pick = examples2.slice(0, Math.min(3, examples2.length));
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
    const { challengeId, code, language, caseResults: providedCases } = req.body || {};
    if (!challengeId) {
      return res.status(400).json({ error: 'Missing challengeId' });
    }

    const chal = await Challenge.findOne({ $or: [{ numId: challengeId }, { slug: challengeId }] });
    if (!chal) return res.status(404).json({ error: 'Challenge not found' });
    // Use a string key for submissions as enforced by the schema
    const challengeKey = (chal?.numId != null)
      ? String(chal.numId)
      : (chal?.slug ? String(chal.slug) : String(challengeId));

    // Fast path: frontend supplies run results (caseResults). We compute verdict without re-running.
    if (Array.isArray(providedCases) && providedCases.length) {
      // Normalize each case into a consistent structure and compute per-case verdict
      const norm = (x) => (x ?? '').toString();
      const __eq = (a, b) => {
        if (a === b) return true;
        const sa = norm(a).trim();
        const sb = norm(b).trim();
        try { const pb = JSON.parse(sb); if (typeof pb === 'string' && sa === pb) return true; } catch (_) {}
        try { const pa = JSON.parse(sa); if (typeof pa === 'string' && pa === JSON.parse(sb)) return true; } catch (_) {}
        if (!isNaN(Number(sa)) && !isNaN(Number(sb))) return Number(sa) === Number(sb);
        return false;
      };
      const normalizedCases = providedCases.map((c, i) => {
        const statusId = Number(c?.status_id ?? c?.statusId ?? 0) || 0;
        const expected = c?.expected ?? c?.expected_output ?? '';
        const actual = c?.actual ?? c?.actual_output ?? '';
        let cv = 'WA';
        if (statusId === 8) cv = 'CE';
        else if (statusId === 5) cv = 'TLE';
        else if (statusId === 7) cv = 'RE';
        else cv = __eq(actual, expected) ? 'AC' : 'WA';
        return {
          index: Number(c?.index ?? i),
          input: c?.input ?? '',
          expected,
          actual,
          stderr: c?.stderr ?? '',
          statusId,
          timeMs: Number(c?.timeMs ?? c?.runtime_ms ?? 0) || 0,
          memoryMB: Number(c?.memoryMB ?? c?.memory_mb ?? 0) || 0,
          verdict: cv,
        };
      });
      const total = normalizedCases.length;
      const passed = normalizedCases.filter(c => (c?.verdict || '').toUpperCase() === 'AC').length;
      const verdict = passed === total ? 'AC' : (passed > 0 ? 'PA' : 'WA');
      const timeMs = normalizedCases.reduce((s,c)=>s + (Number(c?.timeMs)||0), 0);
      const memoryMB = normalizedCases.reduce((s,c)=>Math.max(s, Number(c?.memoryMB)||0), 0);

      const sub = await Submission.create({
        userId: userId || undefined,
        challengeId: challengeKey,
        language: language || 'unknown',
        code: typeof code === 'string' ? code : '',
        verdict,
        status: 'DONE',
        timeMs,
        memoryMB,
        score: chal.points || 100,
        caseResults: normalizedCases,
        details: normalizedCases,
      });

      // Leaderboard/user stats update (award partial credit) — resilient
      if (userId) {
        try {
          const baseScore = chal.points || 100;
          const partScore = Math.round(baseScore * (total > 0 ? (passed / total) : 0));
          const hadPriorAccepted = await Submission.exists({ userId, challengeId: challengeKey, verdict: 'AC' });
          const user = await User.findById(userId);
          if (user) {
            // Initialize stats object safely
            user.stats = user.stats || {};
            user.stats.totalSubmissions = Number(user.stats.totalSubmissions || 0) + 1;
            // Always award proportional score for this submission
            user.stats.totalScore = Number(user.stats.totalScore || 0) + Number(partScore || 0);
            // Count solved only on first full AC for this challenge
            if (!hadPriorAccepted && verdict === 'AC') {
              user.stats.totalSolved = Number(user.stats.totalSolved || 0) + 1;
              const now = new Date();
              const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const today = startOfDay(now);
              const last = user.lastSolvedAt ? startOfDay(new Date(user.lastSolvedAt)) : null;
              if (!last) user.stats.currentStreak = 1; else {
                const diffDays = Math.round((today - last) / (24*60*60*1000));
                if (diffDays === 0) user.stats.currentStreak = Number(user.stats.currentStreak || 1);
                else if (diffDays === 1) user.stats.currentStreak = Number(user.stats.currentStreak || 0) + 1;
                else user.stats.currentStreak = 1;
              }
              user.stats.maxStreak = Math.max(Number(user.stats.maxStreak || 0), Number(user.stats.currentStreak || 0));
              user.lastSolvedAt = now;
            }
            await user.save();
          }
          await Activity.create({
            userId,
            type: 'challenge_submit',
            challengeId,
            challengeTitle: chal.title || String(chal?.title || ''),
            difficulty: chal.difficulty || String(chal?.difficulty || ''),
            status: verdict === 'AC' ? 'solved' : (passed > 0 ? 'partially_accepted' : 'attempted'),
            timeSpent: 0,
            metadata: { timeMs, memoryMB, passed, total },
          });
        } catch (e) {
          console.error('submitSolution stats update error:', e && e.message ? e.message : e);
        }
      }

      return res.status(200).json({
        submissionId: sub._id.toString(),
        status: 'DONE',
        message: 'Successfully submitted',
        data: { verdict, passed, total, time: timeMs, memory: memoryMB, caseResults: normalizedCases }
      });
    }

    // Enforced: submit must be based on provided run results
    return res.status(400).json({ error: 'Submit requires caseResults from the latest Run (no server re-run).' });
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
  const userId = req.user?.sub || null;
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
