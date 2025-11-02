import { MongoClient } from 'mongodb';
import { Worker } from 'bullmq';
import { nanoid } from 'nanoid';
import { spawn } from 'node:child_process';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/ace';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = process.env.QUEUE_NAME || 'submissions';
const PY_RUN_IMAGE = process.env.PY_RUN_IMAGE || 'python:3.11-alpine';
const JAVA_IMAGE = process.env.JAVA_IMAGE || 'eclipse-temurin:17-jdk';
const DEFAULT_TIME_LIMIT_SEC = Number(process.env.DEFAULT_TIME_LIMIT_SEC || 5);
const DEFAULT_MEMORY_LIMIT = process.env.DEFAULT_MEMORY_LIMIT || '512m';

const client = new MongoClient(MONGO_URL);
let db, submissions;

function docker(args, { stdin } = {}) {
  return new Promise((resolve) => {
    const p = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    if (stdin !== undefined && stdin !== null) {
      p.stdin.write(String(stdin));
    }
    p.stdin.end();
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

async function runPython({ source, stdin, timeLimitSec }) {
  const codeB64 = Buffer.from(source, 'utf8').toString('base64');
  const cmd = [
    'run','--rm',
    '--network','none',
    '--cpus','1',
    '--memory', DEFAULT_MEMORY_LIMIT,
    '--pids-limit','128',
    '--read-only',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=64m',
    '--security-opt','no-new-privileges',
    '-e','PYTHONDONTWRITEBYTECODE=1',
    '-e',`CODE_B64=${codeB64}`,
    PY_RUN_IMAGE,
    'sh','-lc',
    // decode code into /tmp/Main.py, then run it; stdin will be piped from the worker
    `apk add --no-cache coreutils >/dev/null 2>&1 || true; echo "$CODE_B64" | base64 -d > /tmp/Main.py && timeout ${timeLimitSec}s python /tmp/Main.py`
  ];
  return docker(cmd, { stdin });
}

async function runJava({ source, stdin, timeLimitSec }) {
  const codeB64 = Buffer.from(source, 'utf8').toString('base64');
  const cmd = [
    'run','--rm',
    '--network','none',
    '--cpus','1',
    '--memory', DEFAULT_MEMORY_LIMIT,
    '--pids-limit','128',
    '--read-only',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=64m',
    '--security-opt','no-new-privileges',
    '-e',`CODE_B64=${codeB64}`,
    JAVA_IMAGE,
    'sh','-lc',
    // decode to /tmp/Main.java, compile, then run TestRunner if present, else Main
    `echo "$CODE_B64" | base64 -d > /tmp/Main.java && cd /tmp && javac Main.java && (timeout ${timeLimitSec}s java TestRunner || timeout ${timeLimitSec}s java Main)`
  ];
  return docker(cmd, { stdin });
}

function languageToRunner(language_id) {
  // For PoC: 71 = Python 3
  if (Number(language_id) === 71) {
    return { ext: '.py', run: runPython };
  }
  // Java 17 (common Judge0 mapping 62)
  if (Number(language_id) === 62) {
    return { ext: '.java', run: runJava };
  }
  throw new Error(`Unsupported language_id ${language_id}`);
}

function normalize(s) {
  return (s ?? '').replace(/\r\n/g,'\n').trimEnd();
}

function equalOutputs(expected, actual) {
  const exp = normalize(expected);
  const got = normalize(actual);
  if (exp === got) return true;
  const expIsArr = exp.startsWith('[') && exp.endsWith(']');
  const gotIsArr = got.startsWith('[') && got.endsWith(']');
  if (expIsArr && gotIsArr) {
    // Ignore spaces inside bracketed array-like outputs
    const a = exp.replace(/\s+/g, '');
    const b = got.replace(/\s+/g, '');
    return a === b;
  }
  return false;
}

async function processSubmission(token) {
  console.log(`[worker] start token=${token}`);
  const s = await submissions.findOne({ token });
  if (!s) return;
  await submissions.updateOne({ token }, { $set: { status_id: 2, updated_at: new Date() } });

  const { language_id, source_code, test_cases } = s;
  const runner = languageToRunner(language_id);

  const perTest = [];
  let overall = 3; // assume Accepted
  let totalRuntime = 0;

  for (let i = 0; i < test_cases.length; i++) {
    const tc = test_cases[i];
    console.log(`[worker] running token=${token} case=${i}`);
    const start = Date.now();
    const { code, out, err } = await runner.run({ source: source_code, stdin: tc.input ?? '', timeLimitSec: DEFAULT_TIME_LIMIT_SEC });
    const runtime = Date.now() - start;
    totalRuntime += runtime;
    console.log(`[worker] result token=${token} case=${i} code=${code} runtime_ms=${runtime}`);

    let status_id = 3; // Accepted
    let actual = out;

    if (code === 124) {
      status_id = 5; // TLE
    } else if (code !== 0) {
      status_id = 7; // Runtime Error
    } else {
      const gotNorm = normalize(out);
      if (!equalOutputs(tc.expected_output, out)) {
        status_id = 4; // Wrong Answer
        try {
          console.log(`[WA DEBUG] token=${token} case=${i} expected=|${normalize(tc.expected_output)}| actual=|${gotNorm}|`);
        } catch (_) {}
      }
      actual = gotNorm + (gotNorm.endsWith('\n') ? '' : '\n');
    }

    if (status_id !== 3 && overall === 3) overall = status_id;

    perTest.push({
      index: i,
      input: tc.input ?? '',
      expected_output: tc.expected_output ?? '',
      actual_output: actual ?? '',
      stderr: err ?? '',
      status_id,
      runtime_ms: runtime,
    });
  }

  await submissions.updateOne(
    { token },
    { $set: {
        status_id: overall,
        runtime_ms: totalRuntime,
        test_cases: perTest,
        updated_at: new Date(),
      } }
  );
  console.log(`[worker] done token=${token} status=${overall} total_runtime_ms=${totalRuntime}`);
}

async function main() {
  await client.connect();
  db = client.db();
  submissions = db.collection('submissions');

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(`[worker] received job id=${job.id} token=${job.data?.token}`);
      try {
        await processSubmission(job.data.token);
      } catch (e) {
        console.error('Process submission failed', e);
        await submissions.updateOne({ token: job.data.token }, { $set: { status_id: 13, updated_at: new Date() } });
      }
    },
    { connection: { url: REDIS_URL } }
  );

  worker.on('failed', (job, err) => console.error('Job failed', job?.id, err));
  console.log('Worker started');
}

main().catch((e) => {
  console.error('Worker init failed', e);
  process.exit(1);
});
