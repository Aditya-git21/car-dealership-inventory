import { Router } from 'express';
import { Db } from '../db';
import { registerUser } from '../services/authService';

export function authRoutes(db: Db) {
  const router = Router();

  router.post('/register', (req, res) => {
    const { email, password } = req.body;
    const user = registerUser(db, email, password);
    res.status(201).json({ user });
  });

  return router;
}
