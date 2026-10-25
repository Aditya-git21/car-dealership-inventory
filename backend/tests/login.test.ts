import fs from 'fs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { createDb, Db } from '../src/db';
import { JWT_SECRET } from '../src/config';

const DB_FILE = 'test.db';
let db: Db;
let app: ReturnType<typeof createApp>;

const creds = { email: 'a@b.com', password: 'secret123' };
const login = (body: object) => request(app).post('/api/auth/login').send(body);

beforeEach(async () => {
  fs.rmSync(DB_FILE, { force: true });
  db = createDb(DB_FILE);
  app = createApp(db);
  // every test starts with one registered user
  await request(app).post('/api/auth/register').send(creds);
});

afterEach(() => db.close());

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and returns a token and user', async () => {
    const res = await login(creds);

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('puts the user id and role inside the token, with an expiry', async () => {
    const res = await login(creds);
    const decoded = jwt.verify(res.body.token, JWT_SECRET) as jwt.JwtPayload;

    expect(decoded.id).toBe(res.body.user.id);
    expect(decoded.role).toBe('USER');
    expect(decoded.exp).toBeDefined();
  });

  it('ignores email case and surrounding spaces', async () => {
    const res = await login({ ...creds, email: '  A@B.com ' });
    expect(res.status).toBe(200);
  });

  it('puts ADMIN in the token for an admin user', async () => {
    db.prepare("UPDATE users SET role = 'ADMIN' WHERE email = ?").run('a@b.com');
    const res = await login(creds);
    const decoded = jwt.verify(res.body.token, JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.role).toBe('ADMIN');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await login({ ...creds, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('gives the same 401 message for an unknown email as for a wrong password', async () => {
    const wrongPassword = await login({ ...creds, password: 'wrong-password' });
    const unknownEmail = await login({ email: 'nobody@b.com', password: 'secret123' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
  });

  const badInputs: [string, object][] = [
    ['missing both fields', {}],
    ['missing password', { email: 'a@b.com' }],
    ['missing email', { password: 'secret123' }],
    ['empty password', { email: 'a@b.com', password: '' }],
    ['email is not a string', { email: 123, password: 'secret123' }],
    ['password is not a string', { email: 'a@b.com', password: 12345678 }],
  ];

  it.each(badInputs)('rejects invalid input: %s', async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
