// Optional WebSocket scaffold for interview streaming
// Uses 'ws' if available. In absence, init is a no-op.

import { initSession, addTranscript, addMetrics } from '../services/interview.store.js';
import { env } from '../config/env.js';
import { createRequire } from 'module';

export function initInterviewWS(server, { path = '/api/interviews/stream' } = {}) {
  let WSS = null;
  try {
    // Load ws in ESM context
    const require = createRequire(import.meta.url);
    const ws = require('ws');
    const { WebSocketServer } = ws;
    WSS = new WebSocketServer({ server, path });
  } catch (e) {
    console.warn('[WS] ws module not installed; interview streaming disabled');
    return;
  }

  console.log('[WS] Interview stream listening on', path);

  WSS.on('connection', (socket, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId') || 'unknown';
    const startedAt = Date.now();
    initSession(sessionId, { ip: req.socket?.remoteAddress });

    const send = (obj) => {
      try { socket.send(JSON.stringify(obj)); } catch (_) {}
    };

    // Greet and send a mock interviewer prompt
    send({ type: 'prompt', text: 'Welcome! Let\'s start with introductions. Tell me about yourself.' });

    socket.on('message', async (data) => {
      // Expect JSON messages from client with {type: 'audio'|'video'|'control', payload: base64, ts}
      let msg = null;
      try { msg = JSON.parse(data.toString()); } catch (_) { return; }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'control') {
        if (msg.action === 'stop') {
          send({ type: 'info', ok: true });
          try { socket.close(); } catch (_) {}
        }
        return;
      }

      if (msg.type === 'audio') {
        const ML = process.env.ML_SERVICE_URL || env.ML_SERVICE_URL || '';
        if (ML) {
          try {
            fetch((ML.replace(/\/$/, '')) + '/asr', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio_b64: msg.payload, sample_rate: 16000 })
            })
              .then(r=>r.json())
              .then((out) => {
                const tObj = { type: 'transcript', text: out.text || '', final: !!out.final, t: Date.now() };
                send(tObj); addTranscript(sessionId, tObj);
                const mObj = { type: 'metrics', wpm: out.wpm, fillers: out.fillers, pauses: out.pauses };
                send(mObj); addMetrics(sessionId, mObj);
              })
              .catch(() => { /* fall back to mock below */ });
          } catch (_) {}
        }
        if (!ML) {
          // Mock path
          const elapsedMin = Math.max(0.5 / 60, (Date.now() - startedAt) / 60000);
          const fakeWords = Math.floor(120 * elapsedMin);
          const wpm = Math.min(180, Math.max(80, Math.round(fakeWords / elapsedMin)));
          const fillers = Math.floor((elapsedMin * 60) / 30);
          const pauses = Math.floor((elapsedMin * 60) / 20);
          const tObj = { type: 'transcript', text: '...', final: false, t: Date.now() };
          send(tObj); addTranscript(sessionId, tObj);
          const mObj = { type: 'metrics', wpm, fillers, pauses };
          send(mObj); addMetrics(sessionId, mObj);
        }
        return;
      }

      if (msg.type === 'video') {
        const ML = process.env.ML_SERVICE_URL || env.ML_SERVICE_URL || '';
        if (ML) {
          try {
            fetch((ML.replace(/\/$/, '')) + '/fer', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_b64: msg.payload })
            })
              .then(r=>r.json())
              .then((out) => {
                const eye = typeof out.eye_contact === 'number' ? Math.round(out.eye_contact) : undefined;
                if (eye !== undefined) {
                  const mObj = { type: 'metrics', eyeContact: eye };
                  send(mObj); addMetrics(sessionId, mObj);
                }
              })
              .catch(() => { /* ignore */ });
          } catch (_) {}
        } else {
          // Mock occasionally
          if (Math.random() < 0.1) {
            const mObj = { type: 'metrics', eyeContact: Math.round(60 + Math.random() * 30) };
            send(mObj); addMetrics(sessionId, mObj);
          }
        }
        return;
      }
    });

    socket.on('close', () => {
      // cleanup
    });
  });
}
