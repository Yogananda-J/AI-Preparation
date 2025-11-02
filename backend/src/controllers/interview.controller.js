import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getSessionData, initSession, endSession } from '../services/interview.store.js';

// In-memory store for demo; replace with DB later
const SESSIONS = new Map();

export const startInterview = async (req, res) => {
  const { type = 'mixed', difficulty = 'mixed', duration = 45, topics = [], role = 'Software Engineer', experience = 'Junior', questionCount: reqCount } = req.body || {};
  const id = uuidv4();
  const session = {
    id,
    startedAt: new Date().toISOString(),
    config: { type, difficulty, duration, topics, role, experience },
    questions: [],
    answers: [],
    questionCount: Number(reqCount) || 20,
  };
  SESSIONS.set(id, session);
  try { initSession(id, { role, experience }); } catch (_) {}
  // Forward to ML service to initialize session and get first question
  try {
    const ML_BASE = process.env.ML_BASE_URL || 'http://localhost:8001';
    const mlRes = await axios.post(`${ML_BASE}/start_interview`, {
      session_id: id,
      role,
      duration,
      topics,
      experience,
      num_questions: session.questionCount,
      resumeName: req.body?.resumeName || '',
      resumeB64: req.body?.resumeB64 || '',
    });
    const data = mlRes.data || {};
    // Attach first question if provided
    if (data?.question) {
      session._useML = true;
      session.questions.push({
        id: data.question.id || data.question.q_id || 'q0',
        type: (data.question.type || '').toLowerCase().replace(/\s+/g, '-'),
        question: data.question.content || data.question.question || '',
        options: data.question.options || undefined,
        difficulty: 'Medium',
        timeLimit: data.question.limit || 8,
        hints: data.question.hints || [],
      });
      session.questionCount = data.question_count || session.questionCount;
    }
  } catch (e) {
    // If ML not available, continue with local flow
  }
  return res.json({ success: true, data: session });
};

export const getInterviewSession = async (req, res) => {
  const { id } = req.params;
  const s = SESSIONS.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  return res.json({ success: true, data: s });
};

function pickQuestion(role) {
  const pool = {
    'Software Engineer': [
      { id: 'q1', type: 'coding', question: 'Implement a function to reverse a linked list', difficulty: 'Medium', timeLimit: 15, hints: ['Iterative vs recursive', 'Use three pointers', 'Handle empty list'] },
      { id: 'q2', type: 'system-design', question: 'Design a URL shortening service like bit.ly', difficulty: 'Hard', timeLimit: 20, hints: ['Scalability', 'Database design', 'Custom URLs'] },
      { id: 'q3', type: 'behavioral', question: 'Tell me about a time you debugged a complex production issue', difficulty: 'Medium', timeLimit: 10, hints: ['STAR method', 'Problem-solving', 'Lessons learned'] },
    ],
    'Data Analyst': [
      { id: 'q4', type: 'behavioral', question: 'Describe a time you derived insight from messy data', difficulty: 'Medium', timeLimit: 10, hints: ['Cleaning', 'Visualization', 'Impact'] },
      { id: 'q5', type: 'technical', question: 'Explain the difference between correlation and causation', difficulty: 'Easy', timeLimit: 8, hints: ['Examples', 'Pitfalls'] },
    ],
    'Marketing Manager': [
      { id: 'q6', type: 'behavioral', question: 'How would you structure an experiment for a new campaign?', difficulty: 'Medium', timeLimit: 12, hints: ['Hypothesis', 'KPIs', 'Segments'] },
    ],
    'Product Manager': [
      { id: 'q7', type: 'system-design', question: 'Design a feature prioritization framework for a B2B SaaS', difficulty: 'Medium', timeLimit: 15, hints: ['RICE', 'Stakeholders', 'Metrics'] },
    ],
  };
  const arr = pool[role] || pool['Software Engineer'];
  return arr[Math.floor(Math.random() * arr.length)];
}

export const getNextQuestion = async (req, res) => {
  const { id } = req.params;
  const s = SESSIONS.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s._useML && s._mlDone) return res.json({ success: true, data: null });
  // If submitAnswer already fetched the next question from ML, serve it
  const pending = s._nextFromML;
  if (pending) {
    delete s._nextFromML;
    s.questions.push(pending);
    return res.json({ success: true, data: pending });
  }
  // Fallback to local picker (only when ML not in use)
  if (s._useML) return res.json({ success: true, data: null });
  const q = pickQuestion(s.config?.role || 'Software Engineer');
  s.questions.push(q);
  return res.json({ success: true, data: q });
};

export const submitAnswer = async (req, res) => {
  const { sessionId, questionId, answer = '', code = '', timeSpent = 0, mcqAnswer } = req.body || {};
  const s = SESSIONS.get(sessionId);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.answers.push({ questionId, answer, mcqAnswer, code, timeSpent });
  // Forward to ML to advance to next question
  try {
    const ML_BASE = process.env.ML_BASE_URL || 'http://localhost:8001';
    const mlRes = await axios.post(`${ML_BASE}/next_question`, {
      session_id: sessionId,
      answer_text: answer,
      mcq_answer: mcqAnswer,
    });
    const data = mlRes.data || {};
    if (!data?.done && data?.question) {
      // Normalize to frontend shape and store temporarily until getNextQuestion is called
      s._nextFromML = {
        id: data.question.id || data.question.q_id || 'qN',
        type: (data.question.type || '').toLowerCase().replace(/\s+/g, '-'),
        question: data.question.content || data.question.question || '',
        options: data.question.options || undefined,
        difficulty: 'Medium',
        timeLimit: data.question.limit || 8,
        hints: data.question.hints || [],
      };
    } else if (data?.done) {
      s._nextFromML = null;
      s._mlDone = true;
    }
  } catch (e) {
    // ignore ML errors; fallback behavior is acceptable
  }
  return res.json({ success: true, data: { received: true } });
};

export const completeInterview = async (req, res) => {
  const { id } = req.params;
  const s = SESSIONS.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.completedAt = new Date().toISOString();
  // Ask ML service for final report; fallback to local if unavailable
  try {
    const ML_BASE = process.env.ML_BASE_URL || 'http://localhost:8001';
    const mlRes = await axios.post(`${ML_BASE}/finish_interview`, { session_id: id });
    const r = mlRes.data || {};
    try { endSession(id); } catch (_) {}
    return res.json({ success: true, data: { score: r.overall ?? 0, time: 38 * 60, grade: gradeFromScore(r.overall ?? 0), report: r } });
  } catch (_) {
    const report = computeReport(id, s.config || {});
    try { endSession(id); } catch (_) {}
    return res.json({ success: true, data: { score: report.overall, time: 38 * 60, grade: gradeFromScore(report.overall) } });
  }
};

export const getAIFeedback = async (req, res) => {
  const { id } = req.params;
  const s = SESSIONS.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const report = computeReport(id, s.config || {});
  return res.json({ success: true, data: report });
};

// --- Scoring Engine ---
const ROLE_KEYWORDS = {
  'Software Engineer': ['algorithm','data structure','complexity','big o','agile','react','node','api','database','testing','design pattern','architecture'],
  'Data Analyst': ['sql','excel','tableau','power bi','regression','dashboard','kpi','cohort','ab test','hypothesis'],
  'Marketing Manager': ['seo','sem','cpc','ctr','conversion','campaign','persona','funnel','branding','roi'],
  'Product Manager': ['roadmap','prioritization','stakeholder','kpi','north star','user research','backlog','trade-off','metrics'],
};

function textFromTranscript(store) {
  const parts = (store?.transcript || []).filter(x=>x && x.final).map(x=>x.text || '');
  return parts.join(' ').trim();
}

function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

function scorePace(avgWpm){
  // Ideal 140-160; linear falloff
  if (!avgWpm || !isFinite(avgWpm)) return 50;
  if (avgWpm >= 140 && avgWpm <= 160) return 100;
  const d = Math.min(Math.abs(avgWpm - 150), 100);
  return clamp(100 - d, 0, 100);
}

function scoreClarity(fillerRate){
  // fillerRate = fillers / words; 0%->100, 10%->50, 20%->20
  if (!isFinite(fillerRate)) return 70;
  const p = fillerRate * 100;
  if (p <= 3) return 95;
  if (p >= 20) return 20;
  return clamp(100 - (p - 3) * 4, 20, 100);
}

function scoreEngagement(eye){
  if (!isFinite(eye)) return 60;
  return clamp(eye, 0, 100);
}

function scoreConfidence(eye, pauses, fillerRate){
  const e = isFinite(eye) ? eye/100 : 0.6;
  const p = isFinite(pauses) ? clamp(1 - (pauses/10), 0, 1) : 0.7; // <=10 pauses best
  const f = isFinite(fillerRate) ? clamp(1 - fillerRate*3, 0, 1) : 0.7;
  return Math.round(clamp((e*0.5 + p*0.25 + f*0.25)*100, 0, 100));
}

function scoreContentRelevance(text, role){
  const kws = (ROLE_KEYWORDS[role] || ROLE_KEYWORDS['Software Engineer']).map(s=>s.toLowerCase());
  const lower = (text||'').toLowerCase();
  const hit = kws.filter(k=>lower.includes(k));
  const ratio = kws.length ? (hit.length / kws.length) : 0;
  // simple semantic proxy
  return Math.round(clamp(ratio*100 + (ratio>0?20:0), 0, 100));
}

function keywordScore(text, role){
  const kws = (ROLE_KEYWORDS[role] || []);
  const lower = (text||'').toLowerCase();
  const hit = kws.filter(k=>lower.includes(k.toLowerCase()));
  const ratio = kws.length ? (hit.length / kws.length) : 0;
  return { score: Math.round(ratio*100), hit };
}

function gradeFromScore(s){
  if (s>=90) return 'A';
  if (s>=80) return 'A-';
  if (s>=70) return 'B';
  if (s>=60) return 'C';
  return 'D';
}

function computeReport(sessionId, cfg){
  const store = getSessionData(sessionId) || {};
  const text = textFromTranscript(store);
  const words = (text.split(/\s+/).filter(Boolean).length) || (store.metrics?.words || 0);
  const fillersCount = store.metrics?.fillers || 0;
  const fillerRate = words ? (fillersCount / words) : 0;
  const wpmSamples = store.metrics?.wpmSamples || [];
  const avgWpm = wpmSamples.length ? Math.round(wpmSamples.reduce((a,b)=>a+b,0)/wpmSamples.length) : 0;
  const pauses = store.metrics?.pauses || 0;
  const eyeSamples = store.metrics?.eyeContactSamples || [];
  const eye = eyeSamples.length ? Math.round(eyeSamples.reduce((a,b)=>a+b,0)/eyeSamples.length) : 0;
  const role = cfg.role || 'Software Engineer';

  const content = scoreContentRelevance(text, role); // 40%
  const clarity = scoreClarity(fillerRate); // 20%
  const pace = scorePace(avgWpm); // 10%
  const conf = scoreConfidence(eye, pauses, fillerRate); // 15%
  const engage = scoreEngagement(eye); // 10%
  const kw = keywordScore(text, role); // 5%

  const weighted = Math.round(
    content*0.40 + clarity*0.20 + pace*0.10 + conf*0.15 + engage*0.10 + (kw.score)*0.05
  );

  const improvements = [];
  if (fillerRate > 0.06) improvements.push('Reduce filler words by 25%');
  if (eye < 70) improvements.push('Increase average eye contact to at least 75%');
  if (avgWpm < 120) improvements.push('Increase speaking pace towards 140–160 WPM');
  if (avgWpm > 170) improvements.push('Slow down towards 140–160 WPM');
  if (kw.score < 50) improvements.push('Use more role-aligned keywords from the job description');

  const strengths = [];
  if (content >= 75) strengths.push('Strong content relevance to the prompts');
  if (clarity >= 75) strengths.push('Clear communication with low filler usage');
  if (engage >= 75) strengths.push('Good engagement and eye contact');

  // Annotated transcript: mark filler-heavy as corrections, detailed as strengths
  const annotations = (store.transcript || []).filter(Boolean).map((seg) => {
    const t = seg.text || '';
    const words = t.split(/\s+/).filter(Boolean);
    const fillerWords = ['um','uh','like','you know','so','actually'];
    const fillers = words.filter(w=>fillerWords.includes(w.toLowerCase())).length;
    const fr = words.length ? fillers/words.length : 0;
    return {
      t: seg.t,
      text: t,
      tag: fr>0.1 ? 'correction' : (t.length>80 ? 'strength' : 'neutral'),
      note: fr>0.1 ? 'High filler density in this sentence' : (t.length>80 ? 'Good level of detail here' : ''),
    };
  });

  return {
    overall: weighted,
    breakdown: {
      contentRelevance: content,
      communicationClarity: clarity,
      deliveryPace: pace,
      confidence: conf,
      engagement: engage,
      keywordAnalysis: kw.score,
    },
    actionableFeedback: (improvements.slice(0,3).length? improvements.slice(0,3): ['Practice structuring answers with STAR', 'Back your statements with examples', 'Summarize your key points at the end']).map((x,i)=>`${i+1}. ${x}`),
    strengths,
    transcriptAnnotations: annotations,
    meta: { words, avgWpm, fillerRate: Number(fillerRate.toFixed(3)), pauses, eyeContact: eye, role },
  };
}
