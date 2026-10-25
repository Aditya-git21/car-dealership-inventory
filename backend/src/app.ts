import express from 'express';
import cors from 'cors';
import { Db } from './db';
import { authRoutes } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';

export function createApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes(db));
  app.use(errorHandler);
  return app;
}
