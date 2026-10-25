import bcrypt from 'bcryptjs';
import { Db } from '../db';

export function registerUser(db: Db, email: string, password: string) {
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, hash);
  return { id: Number(info.lastInsertRowid), email, role: 'USER' };
}
