import { Router } from 'express';
import { Db } from '../db';
import { registerUser, loginUser } from '../services/authService';

export function authRoutes(db: Db) {
  const router = Router();

  router.post('/register', (req, res) => {
    // req.body can be undefined if no body was sent, so default to {}
    const { email, password } = req.body ?? {};
    res.status(201).json({ user: registerUser(db, email, password) });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    res.json(loginUser(db, email, password));
  });

  return router;
}
