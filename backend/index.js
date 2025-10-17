import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import app from './src/app.js';

const start = async () => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
