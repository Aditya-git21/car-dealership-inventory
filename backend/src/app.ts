import express from 'express';
import cors from 'cors';
import { Db } from './db';
import { authRoutes } from './routes/auth';

export function createApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes(db));
  return app;
}
