import fs from 'fs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createDb, Db } from '../src/db';

const DB_FILE = 'test.db';
let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  fs.rmSync(DB_FILE, { force: true });
  db = createDb(DB_FILE);
  app = createApp(db);
});

afterEach(() => db.close());

describe('POST /api/auth/register', () => {
  it('registers a new user and never returns the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.password_hash).toBeUndefined();
  });
});
