import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 4000;
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// TODO: add proxy routes to services, e.g. /auth -> http://auth-service:4001
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

app.listen(PORT, () => console.log(`[gateway] listening on :${PORT}`));
