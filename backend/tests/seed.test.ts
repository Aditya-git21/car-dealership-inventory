import request from 'supertest';
import { ensureAdmin } from '../src/services/authService';
import { Db } from '../src/db';
import { setupApp, App } from './helpers';

let app: App;
let db: Db;

beforeEach(() => {
  ({ app, db } = setupApp());
});
afterEach(() => db.close());

const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('ensureAdmin', () => {
  it('creates an admin who can log in', async () => {
    ensureAdmin(db, 'Admin@Shop.com', 'admin12345');
    const res = await login('admin@shop.com', 'admin12345');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('promotes an existing user and keeps their password', async () => {
    await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'secret123' });
    ensureAdmin(db, 'a@b.com', 'some-other-password');
    const res = await login('a@b.com', 'secret123');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('is safe to run twice', () => {
    ensureAdmin(db, 'admin@shop.com', 'admin12345');
    ensureAdmin(db, 'admin@shop.com', 'admin12345');
    const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    expect(row.n).toBe(1);
  });

  it('rejects an invalid email or a weak password', () => {
    expect(() => ensureAdmin(db, 'nope', 'admin12345')).toThrow();
    expect(() => ensureAdmin(db, 'admin@shop.com', 'short')).toThrow();
  });
});
