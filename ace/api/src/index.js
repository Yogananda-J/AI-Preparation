import express from 'express';
import { MongoClient } from 'mongodb';
import { Queue } from 'bullmq';
import { nanoid } from 'nanoid';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json({ limit: '256kb' }));

const PORT = process.env.PORT || 8080;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/ace';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = process.env.QUEUE_NAME || 'submissions';

let db, submissions, queue;

async function init() {
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  db = mongo.db();
  submissions = db.collection('submissions');
  queue = new Queue(QUEUE_NAME, { connection: { url: REDIS_URL } });

  app.post('/submissions', async (req, res) => {
    try {
      const { language_id, source_code, test_cases } = req.body || {};
      if (!language_id || !source_code || !Array.isArray(test_cases) || test_cases.length === 0) {
        return res.status(400).json({ error: 'language_id, source_code, test_cases[] are required' });
      }
      const token = nanoid();
      const doc = {
        token,
        language_id,
        source_code,
        test_cases,
        status_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await submissions.insertOne(doc);
      await queue.add('submission', { token });
      return res.status(201).json({ token });
    } catch (e) {
      console.error('POST /submissions', e);
      return res.status(500).json({ error: 'Internal Error' });
    }
  });

  app.get('/submissions/:token', async (req, res) => {
    const s = await submissions.findOne({ token: req.params.token }, { projection: { _id: 0 } });
    if (!s) return res.status(404).json({ error: 'Not found' });
    return res.json(s);
  });

  app.listen(PORT, () => console.log(`API listening on ${PORT}`));
}

init().catch((e) => {
  console.error('Failed to init API', e);
  process.exit(1);
});
