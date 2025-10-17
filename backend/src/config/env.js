import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aicodeskill',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  API_PREFIX: process.env.API_PREFIX || '/api',
};
