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

// Helper: detect if user code already defines a ListNode (top-level so harnesses can use it)
const definesListNode = (src) => {
  if (!src || typeof src !== 'string') return false;
  return /\bclass\s+ListNode\b/.test(src) || /\bstruct\s+ListNode\b/.test(src) || /\bfunction\s+ListNode\b/.test(src);
};

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
  const chosenPath = existsSync(lcPath) ? lcPath : legacyPath;
  let rawItems = [];
  try {
    if (existsSync(mergedPath)) {
      const rawMerged = readFileSync(mergedPath, 'utf-8');
      const merged = JSON.parse(rawMerged);
      if (merged && Array.isArray(merged.questions)) rawItems = merged.questions;
    }
    if ((!rawItems || !rawItems.length) && existsSync(lcPath)) {
      const rawLc = readFileSync(lcPath, 'utf-8');
      if (rawLc && rawLc.trim().startsWith('[')) rawItems = JSON.parse(rawLc);
    }
    if (!rawItems || !rawItems.length) {
      const legacyRaw = readFileSync(legacyPath, 'utf-8');
      rawItems = JSON.parse(legacyRaw);
    }
  } catch (e) {
    const legacyRaw = readFileSync(legacyPath, 'utf-8');
    rawItems = JSON.parse(legacyRaw);
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

// Try to detect a Java method name declared inside `class Solution { ... }` in user code
const detectJavaSolutionMethod = (src = '') => {
  if (!src || typeof src !== 'string') return null;
  // Find class Solution body
  const m = src.match(/class\s+Solution\s*\{([\s\S]*?)\}/);
  const body = m ? m[1] : src;
  // Find first non-constructor method name (avoid main)
  const re = /(?:public|protected|private)?\s*(?:static\s+)?[A-Za-z0-9_<>, \[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match;
  while ((match = re.exec(body))) {
    const name = match[1];
    if (!name) continue;
    if (name === 'main') continue;
    // skip if constructor (same as class name) - handled by pattern but safe
    if (name === 'Solution') continue;
    return name;
  }
  return null;
};

// Detect any method and the class that declares it. Returns { className, methodName } or null
const detectJavaMethodAndClass = (src = '') => {
  if (!src || typeof src !== 'string') return null;
  const classRe = /class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{([\s\S]*?)\n\}/g;
  let cm;
  while ((cm = classRe.exec(src))) {
    const className = cm[1];
    const body = cm[2] || '';
    const methodRe = /(?:public|protected|private)?\s*(?:static\s+)?[A-Za-z0-9_<>,\[\]\s]+\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;
    const m = body.match(methodRe);
    if (m && m[1]) return { className, methodName: m[1] };
  }
  // fallback: try to find any function-like declaration outside classes
  const globalMethod = src.match(/(?:public|protected|private)?\s*(?:static\s+)?[A-Za-z0-9_<>,\[\]\s]+\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (globalMethod && globalMethod[1]) return { className: null, methodName: globalMethod[1] };
  return null;
};

// Generic harness builder: attempts to call a function inferred from the title
const buildGenericHarness = {
  java: (userCode, fields, title) => {
  const detected = detectJavaMethodAndClass(userCode);
  const func = detected?.methodName || titleToFuncName(title);
  const targetClass = detected?.className || 'Solution';
    // Prepare arguments in order of fields
    const args = fields.map(f => f.name).join(', ');
    // Convert field values into Java literals (simple heuristics)
    const assigns = fields.map(f => {
      const v = (f.value || '').toString().trim();
      if (/^\[.*\]$/.test(v)) {
        return `int[] ${f.name} = new int[]{${v.replace(/^\s*\[|\]\s*$/g, '')}};`;
      }
      if (/^-?\d+$/.test(v)) return `int ${f.name} = ${v};`;
      if (/^(true|false)$/i.test(v)) return `boolean ${f.name} = ${v.toLowerCase()};`;
      return `String ${f.name} = "${v.replace(/"/g, '\\"')}";`;
    }).join('\n    ');
    const bodyLines = [];
    if (assigns) bodyLines.push(assigns);
  // Call the detected class/method (if detection yielded a class), otherwise default to Solution
  bodyLines.push(`    try { Object out = null; try { out = new ${targetClass}().${func}(${args}); } catch(Throwable ex) { try { out = ${func}(${args}); } catch(Exception ex2) { ex2.printStackTrace(); } } if (out == null) { System.out.print(""); } else if (out.getClass().isArray()) { if (out instanceof int[]) System.out.print(java.util.Arrays.toString((int[])out)); else if (out instanceof long[]) System.out.print(java.util.Arrays.toString((long[])out)); else if (out instanceof double[]) System.out.print(java.util.Arrays.toString((double[])out)); else if (out instanceof boolean[]) System.out.print(java.util.Arrays.toString((boolean[])out)); else if (out instanceof char[]) System.out.print(java.util.Arrays.toString((char[])out)); else System.out.print(java.util.Arrays.toString((Object[])out)); } else { System.out.print(out.toString()); } } catch(Exception e) { e.printStackTrace(); }`);
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
    return `${userCode}\n#include <bits/stdc++.h>\nusing namespace std;\nint main(){ ${arrAssigns} auto r = ${func}(${args}); /* print user result */ return 0; }`;
  },
  js: (userCode, fields, title) => {
    const func = titleToFuncName(title);
    const assigns = fields.map(f => `const ${f.name} = ${f.value || 'undefined'};`).join('\n');
    const body = `${assigns}\ntry { const out = (typeof ${func}==='function') ? ${func}(${fields.map(f=>f.name).join(',')}) : (typeof Solution==='function'&&typeof (new Solution())[func]==='function' ? (new Solution())[func](${fields.map(f=>f.name).join(',')}) : null); process.stdout.write(JSON.stringify(out)); } catch(e) { console.error(e && e.stack? e.stack : e); }`;
    return `${userCode}\n${body}`;
  },
  python: (userCode, fields, title) => {
    const func = titleToFuncName(title);
    const assigns = fields.map(f => `${f.name} = ${f.value || 'None'}`).join('\n');
    const body = `${assigns}\nimport sys, json, traceback\nout = None\ntry:\n    try:\n        out = getattr(Solution(), '${func}')(${fields.map(f=>f.name).join(',')})\n    except Exception:\n        try:\n            fn = globals().get('${func}')\n            if callable(fn):\n                out = fn(${fields.map(f=>f.name).join(',')})\n        except Exception:\n            traceback.print_exc()\n            out = None\n    if out is None:\n        print('')\n    else:\n        try:\n            if hasattr(out, '__iter__') and not isinstance(out, (str, bytes)):\n                print(json.dumps(list(out)))\n            else:\n                print(out)\n        except Exception:\n            print(out)\nexcept Exception:\n    traceback.print_exc()`;
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
  const JUDGE0_URL = process.env.JUDGE0_URL;
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

  const providedStdin = joinFieldsAsStdin(inputs);
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

        if (process.env.JUDGE_LOG === '1') {
          try { console.log(`[RUN][case ${i+1}] lang=${language} providedStdin=${!!providedStdin} fields=${JSON.stringify(fields)} isTwoSum=${/\btwo\s+sum\b/i.test(chal.title||'')} isAddTwoNumbers=${/\badd\s+two\s+numbers\b/i.test(chal.title||'')}`); } catch(_){}
        }

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
          source_code = (buildGenericHarness[ (lang==='c++'||lang==='cpp17') ? 'cpp' : (lang==='js'?'js': lang) ] || ((u,f,t)=>u))(code, fields, chal.title || '');
          stdin = (lang === 'python' || lang === 'javascript' || lang==='js' || lang==='node') ? providedStdin : '';
        }
        if (process.env.JUDGE_LOG === '1') {
          try { console.log(`[RUN][case ${i+1}] sending to ACE? ${!!ACE_URL && !!toId(language)} lang=${language} stdinPreview=${(stdin||'').slice(0,200)} sourcePreview=${(source_code||'').slice(0,400)} `); } catch(_){}
        }

        const langId = toId(language);
        let created = null;
        let token = null;
        try {
          if (process.env.JUDGE_LOG === '1') {
            try { console.log('[ACE RUN][posting] base=', base, 'langId=', langId, 'lang=', language, 'stdinPreview=', (stdin||'').slice(0,200)); } catch(_){}
          }
          const createResp = await fetch(`${base}/submissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language_id: langId, source_code, test_cases: [{ input: stdin, expected_output: expected }] })
          });
          if (process.env.JUDGE_LOG === '1') {
            try { console.log('[ACE RUN][postStatus] status=', createResp.status, 'statusText=', createResp.statusText); } catch(_){}
          }
          created = await createResp.json();
          token = created?.token;
          if (process.env.JUDGE_LOG === '1') {
            try { console.log('[ACE RUN][create] token=', token, 'created=', JSON.stringify(created).slice(0,1000)); } catch(_){}
          }
        } catch (err) {
          console.error('[ACE RUN][error posting]', err && err.stack ? err.stack : err);
          throw err;
        }
        let fin = null; const started = Date.now();
        for (let tries = 0; tries < 60; tries++) {
          await new Promise(r => setTimeout(r, 250));
          const stat = await fetch(`${base}/submissions/${token}`);
          const data = await stat.json();
          if (data && typeof data.status_id === 'number' && data.status_id !== 1 && data.status_id !== 2) { fin = data; break; }
        }
        if (process.env.JUDGE_LOG === '1') {
          try { console.log('[ACE RUN][finished] token=', token, 'result=', JSON.stringify(fin && (fin.test_cases||fin), null, 0).slice(0,4000)); } catch(_){}
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
          source_code = (buildGenericHarness[ (lang==='c++'||lang==='cpp17') ? 'cpp' : (lang==='js'?'js': lang) ] || ((u,f,t)=>u))(code, fields, chal.title || '');
          stdin = (lang === 'python' || lang === 'javascript' || lang==='js' || lang==='node') ? providedStdin : '';
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
          try {
            console.log(`[WA DEBUG][run][case ${i + 1}] Expected: |${expected}|`);
            console.log(`[WA DEBUG][run][case ${i + 1}] Actual:   |${actual}|`);
          } catch (_) {}
          v = actual && expected && actual === expected ? 'AC' : 'WA';
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

// Debug helper: return the composed source that would be sent to the judge for the first example
export const previewSource = async (req, res) => {
  const { challengeId, code, language } = req.body || {};
  if (!challengeId || !language) return res.status(400).json({ error: 'Missing fields' });
  const chal = await Challenge.findOne({ $or: [{ numId: challengeId }, { slug: challengeId }] }).lean();
  if (!chal) return res.status(404).json({ error: 'Challenge not found' });
  const examples = Array.isArray(chal.examples) ? chal.examples : [];
  if (!examples.length) return res.status(400).json({ error: 'No examples' });
  const ex = examples[0];
  const fields = parseFieldsFromInput(ex.input || '');
  const lang = (language || '').toLowerCase();
  let source = code || '';
  const isTwoSum = /\btwo\s+sum\b/i.test(chal.title || '');
  const isAddTwoNumbers = /\badd\s+two\s+numbers\b/i.test(chal.title || '');
  if (isTwoSum) {
    if (lang === 'java') source = buildTwoSumHarness.java(code, fields);
    else if (lang === 'cpp' || lang === 'c++' || lang === 'cpp17') source = buildTwoSumHarness.cpp(code, fields);
    else if (lang === 'javascript' || lang === 'js' || lang === 'node') source = buildTwoSumHarness.js(code, fields);
    else if (lang === 'python' || lang === 'py' || lang === 'python3') source = buildTwoSumHarness.python(code, fields);
  } else if (isAddTwoNumbers) {
    if (lang === 'java') source = buildAddTwoNumbersHarness.java(code, fields);
    else if (lang === 'cpp' || lang === 'c++' || lang === 'cpp17') source = buildAddTwoNumbersHarness.cpp(code, fields);
    else if (lang === 'javascript' || lang === 'js' || lang === 'node') source = buildAddTwoNumbersHarness.js(code, fields);
    else if (lang === 'python' || lang === 'py' || lang === 'python3') source = buildAddTwoNumbersHarness.python(code, fields);
  } else {
    source = (buildGenericHarness[(lang === 'c++' || lang === 'cpp17') ? 'cpp' : (lang === 'js' ? 'js' : lang)] || ((u,f,t)=>u))(code || '', fields, chal.title || '');
  }
  return res.json({ success: true, sourcePreview: source.slice(0, 20000) , fullSource: source });
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

      const runOneACE = async (index, fields, expected) => {
        const base = ACE_URL.replace(/\/$/, '');
        const lang = (language || '').toLowerCase();
        let source_code = code;
        let stdin = joinFieldsAsStdin(fields);

        const isTwoSum = /\btwo\s+sum\b/i.test(chal.title || '');
        const isAddTwoNumbers = /\badd\s+two\s+numbers\b/i.test(chal.title || '');

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
          source_code = (buildGenericHarness[ (lang==='c++'||lang==='cpp17') ? 'cpp' : (lang==='js'?'js': lang) ] || ((u,f,t)=>u))(code, fields, chal.title || '');
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
        const inputText = examples[index]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
        const entry = { index: index+1, verdict: v, input: inputText, timeMs: t, memoryMB: 0, expected, actual: stdout.trim(), stderr };
        caseResults.push(entry); detailsArr.push(entry);
      };

      const runOneJudge0 = async (index, fields, expected) => {
        const lang = (language || '').toLowerCase();
        let source_code = code;
        let stdin = joinFieldsAsStdin(fields);

        const isTwoSum = /\btwo\s+sum\b/i.test(chal.title || '');
        const isAddTwoNumbers = /\badd\s+two\s+numbers\b/i.test(chal.title || '');

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
          source_code = (buildGenericHarness[ (lang==='c++'||lang==='cpp17') ? 'cpp' : (lang==='js'?'js': lang) ] || ((u,f,t)=>u))(code, fields, chal.title || '');
        }

        const resp = await fetch(`${JUDGE0_URL.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`, {
          method:'POST', headers, body: JSON.stringify({ language_id: toId(language), source_code, stdin })
        });
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
        else v = (stdout.trim() === expected ? 'AC' : 'WA');

        if (v==='AC') passed++; else if (severity(v) > severity(verdict)) verdict = v;
        const inputText = examples[index]?.input || (fields && fields.length ? fields.map(f=>`${f.name}=${f.value}`).join(', ') : '');
        const entry = { index: index+1, verdict: v, input: inputText, timeMs: t, memoryMB: m, expected, actual: stdout.trim() };
        caseResults.push(entry);
        detailsArr.push(entry);
      };

      if (ACE_URL && toId(language)) {
        for (let i = 0; i < examples.length; i++) {
          const expected = (examples[i]?.output || '').toString().trim();
          const fields = parseFieldsFromInput(examples[i].input || '');
          await runOneACE(i, fields, expected);
        }
      } else if (JUDGE0_URL && toId(language)) {
        for (let i = 0; i < examples.length; i++) {
          const expected = (examples[i]?.output || '').toString().trim();
          const fields = parseFieldsFromInput(examples[i].input || '');
          await runOneJudge0(i, fields, expected);
        }
      } else {
        verdict = 'WA'; passed = 0; timeMs = 0; memoryMB = 0;
        for(let i=0;i<total;i++){ caseResults.push({ index: i+1, verdict: 'WA', timeMs: 0, memoryMB: 0 }); detailsArr.push({ index: i+1, verdict: 'WA', input: '', expected: '', actual: '' }); }
      }

      await Submission.updateOne({ _id: queued._id }, { $set: { verdict, timeMs, memoryMB, status: 'DONE', caseResults, details: detailsArr } });

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
