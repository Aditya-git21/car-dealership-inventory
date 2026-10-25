import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_SECRET } from '../src/config';
import { Db } from '../src/db';
import { setupApp, tokenFor, App } from './helpers';

let app: App;
let db: Db;

beforeEach(() => {
  ({ app, db } = setupApp());
});
afterEach(() => db.close());

const expired = jwt.sign(
  { id: 1, role: 'USER', exp: Math.floor(Date.now() / 1000) - 10 },
  JWT_SECRET
);

describe('authenticate middleware (checked via GET /api/vehicles)', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  const badHeaders: [string, string][] = [
    ['wrong scheme', 'Token abc'],
    ['Bearer with no token', 'Bearer '],
    ['garbage token', 'Bearer not.a.token'],
    ['signed with a different secret', `Bearer ${jwt.sign({ id: 1, role: 'USER' }, 'other-secret')}`],
    ['expired token', `Bearer ${expired}`],
    ['token without a role', `Bearer ${jwt.sign({ id: 1 }, JWT_SECRET)}`],
  ];

  it.each(badHeaders)('rejects: %s', async (_label, header) => {
    const res = await request(app).get('/api/vehicles').set('Authorization', header);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('lets a valid token through', async () => {
    const token = await tokenFor(app, db, 'USER');
    const res = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
