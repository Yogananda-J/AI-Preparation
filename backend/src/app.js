import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import challengeRoutes from './routes/challenge.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import profileRoutes from './routes/profile.routes.js';
import interviewV2Routes from './routes/interviewV2.routes.js';
import uploadRoutes from './routes/upload.routes.js';

const app = express();

app.use(helmet());

// Build CORS whitelist from env (supports comma-separated values)
const allowedOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (no origin) and whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
// Allow larger JSON payloads so base64-encoded interview videos can be uploaded
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

app.get(env.API_PREFIX + '/health', (req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() });
});

app.use(env.API_PREFIX + '/auth', authRoutes);
app.use(env.API_PREFIX + '/challenges', challengeRoutes);
app.use(env.API_PREFIX + '/leaderboard', leaderboardRoutes);
app.use(env.API_PREFIX + '/profile', profileRoutes);
app.use(env.API_PREFIX + '/interviews-v2', interviewV2Routes);
app.use(env.API_PREFIX + '/upload', uploadRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server Error' });
});

export default app;
