import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4005;
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'interview' }));

const wss = new WebSocketServer({ server, path: '/interviews/stream' });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', t: Date.now() }));
});

server.listen(PORT, () => console.log(`[interview-service] listening on :${PORT}`));
