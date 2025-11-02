import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import http from 'http';
import { initInterviewWS } from './src/ws/interview.ws.js';

const start = async () => {
  await connectDB();
  const server = http.createServer(app);
  try { initInterviewWS(server, { path: env.API_PREFIX + '/interviews/stream' }); } catch (e) { /* optional */ }
  server.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
