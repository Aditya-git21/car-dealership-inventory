import fs from 'fs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createDb, Db } from '../src/db';

export type App = ReturnType<typeof createApp>;

// Fresh database file + app for every test
export function setupApp(file = 'test.db'): { app: App; db: Db } {
  fs.rmSync(file, { force: true });
  const db = createDb(file);
  return { app: createApp(db), db };
}

// Registers a user, optionally promotes to ADMIN, and returns a login token.
// The promotion happens BEFORE login so the token carries the ADMIN role.
export async function tokenFor(app: App, db: Db, role: 'USER' | 'ADMIN'): Promise<string> {
  const email = `${role.toLowerCase()}@test.com`;
  const password = 'secret123';
  await request(app).post('/api/auth/register').send({ email, password });
  if (role === 'ADMIN') {
    db.prepare("UPDATE users SET role = 'ADMIN' WHERE email = ?").run(email);
  }
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}
