import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Db } from '../db';
import { HttpError } from '../errors';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function registerUser(db: Db, email: unknown, password: unknown) {
  // Input from the internet is untrusted: check the type before using it
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Email and password are required');
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) {
    throw new HttpError(400, 'Invalid email');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
    throw new HttpError(409, 'Email already registered');
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(cleanEmail, hash);
    return { id: Number(info.lastInsertRowid), email: cleanEmail, role: 'USER' };
  } catch (err: any) {
    // Two identical requests at the same instant: the DB's UNIQUE rule still catches it
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'Email already registered');
    }
    throw err;
  }
}

interface UserRow {
  id: number;
  email: string;
  role: string;
  password_hash: string;
}

export function loginUser(db: Db, email: unknown, password: unknown) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const row = db
    .prepare('SELECT id, email, role, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as UserRow | undefined;

  // Same message for "no such user" and "wrong password", so attackers
  // can't use the API to find out which emails are registered
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = jwt.sign({ id: row.id, role: row.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  return { token, user: { id: row.id, email: row.email, role: row.role } };
}
