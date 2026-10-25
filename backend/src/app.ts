import express from 'express';
import cors from 'cors';
import { Db } from './db';
import { authRoutes } from './routes/auth';
import { vehicleRoutes } from './routes/vehicles';
import { errorHandler } from './middleware/errorHandler';

export function createApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes(db));
  app.use('/api/vehicles', vehicleRoutes(db));

  // Anything that matched no route above
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use(errorHandler);
  return app;
}
