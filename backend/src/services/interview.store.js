// Simple in-memory store for multimodal interview data
// NOTE: replace with persistent store if needed

export const INTERVIEW_STORE = new Map();

export function initSession(sessionId, meta = {}) {
  if (!sessionId) return;
  if (!INTERVIEW_STORE.has(sessionId)) {
    INTERVIEW_STORE.set(sessionId, {
      meta,
      startedAt: Date.now(),
      transcript: [], // {t, text, final}
      metrics: {
        words: 0,
        fillers: 0,
        pauses: 0,
        wpmSamples: [],
        eyeContactSamples: [],
        // placeholder for future
        emotions: { positive: 0, neutral: 0, negative: 0 },
      },
      keywordsHit: new Set(),
    });
  }
}

export function addTranscript(sessionId, seg) {
  const s = INTERVIEW_STORE.get(sessionId);
  if (!s) return;
  const { text = '', final = false, t = Date.now() } = seg || {};
  s.transcript.push({ t, text, final: !!final });
  // crude word count and filler update (final only)
  if (final && typeof text === 'string' && text.trim()) {
    const words = text.split(/\s+/).filter(Boolean);
    s.metrics.words += words.length;
  }
}

export function addMetrics(sessionId, m) {
  const s = INTERVIEW_STORE.get(sessionId);
  if (!s) return;
  if (typeof m.wpm === 'number' && isFinite(m.wpm)) s.metrics.wpmSamples.push(m.wpm);
  if (typeof m.fillers === 'number') s.metrics.fillers = m.fillers;
  if (typeof m.pauses === 'number') s.metrics.pauses = m.pauses;
  if (typeof m.eyeContact === 'number') s.metrics.eyeContactSamples.push(m.eyeContact);
}

export function markKeywords(sessionId, words = []) {
  const s = INTERVIEW_STORE.get(sessionId);
  if (!s) return;
  for (const w of words) s.keywordsHit.add((w || '').toLowerCase());
}

export function getSessionData(sessionId) {
  return INTERVIEW_STORE.get(sessionId);
}

export function endSession(sessionId) {
  // nothing to clean right now; keep data for report generation
}
