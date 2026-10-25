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
  const valid = { email: 'a@b.com', password: 'secret123' };
  const register = (body: object) =>
    request(app).post('/api/auth/register').send(body);

  it('registers a new user and never returns the password', async () => {
    const res = await register(valid);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  // One table of bad inputs, so each case becomes its own test
  const badInputs: [string, object][] = [
    ['missing both fields', {}],
    ['missing password', { email: 'a@b.com' }],
    ['missing email', { password: 'secret123' }],
    ['empty email', { email: '', password: 'secret123' }],
    ['bad email format', { email: 'not-an-email', password: 'secret123' }],
    ['short password', { email: 'a@b.com', password: 'short' }],
    ['email is not a string', { email: 123, password: 'secret123' }],
    ['password is not a string', { email: 'a@b.com', password: 12345678 }],
  ];

  it.each(badInputs)('rejects invalid input: %s', async (_label, body) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects malformed JSON with a JSON error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects a duplicate email, ignoring case', async () => {
    await register(valid);
    const res = await register({ ...valid, email: 'A@B.com' });
    expect(res.status).toBe(409);
  });

  it('stores the email trimmed and lowercased', async () => {
    await register({ ...valid, email: '  A@B.com ' });
    const row = db.prepare('SELECT email FROM users').get() as { email: string };
    expect(row.email).toBe('a@b.com');
  });

  it('stores a hashed password, not plain text', async () => {
    await register(valid);
    const row = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
    expect(row.password_hash).not.toBe(valid.password);
  });
});
