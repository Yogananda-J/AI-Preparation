import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT || 4003;
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'submission' }));

// Minimal stubs
app.post('/submissions', (req, res) => {
  const id = randomUUID();
  res.status(202).json({ submissionId: id, status: 'QUEUED' });
});

app.get('/submissions/:id', (req, res) => {
  res.json({ id: req.params.id, status: 'PENDING' });
});

app.listen(PORT, () => console.log(`[submission-service] listening on :${PORT}`));
