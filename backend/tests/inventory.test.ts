import request from 'supertest';
import { Db } from '../src/db';
import { MAX_QUANTITY } from '../src/services/vehicleService';
import { setupApp, tokenFor, insertVehicle, quantityOf, App } from './helpers';

let app: App;
let db: Db;
let userToken: string;
let adminToken: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  ({ app, db } = setupApp());
  userToken = await tokenFor(app, db, 'USER');
  adminToken = await tokenFor(app, db, 'ADMIN');
});
afterEach(() => db.close());

const buy = (id: number | string, token = userToken) =>
  request(app).post(`/api/vehicles/${id}/purchase`).set(auth(token));
const restock = (id: number | string, body: object, token = adminToken) =>
  request(app).post(`/api/vehicles/${id}/restock`).set(auth(token)).send(body);

describe('POST /api/vehicles/:id/purchase', () => {
  it('requires a token', async () => {
    const id = insertVehicle(db, 3);
    const res = await request(app).post(`/api/vehicles/${id}/purchase`);
    expect(res.status).toBe(401);
    expect(quantityOf(db, id)).toBe(3);
  });

  it('lets a normal user buy one unit and returns the updated vehicle', async () => {
    const id = insertVehicle(db, 3);
    const res = await buy(id);
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(2);
    expect(quantityOf(db, id)).toBe(2);
  });

  it('can buy the last unit, then refuses with 409', async () => {
    const id = insertVehicle(db, 1);
    expect((await buy(id)).status).toBe(200);
    const res = await buy(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(quantityOf(db, id)).toBe(0);
  });

  it('refuses an out-of-stock vehicle with 409 and keeps quantity at 0', async () => {
    const id = insertVehicle(db, 0);
    const res = await buy(id);
    expect(res.status).toBe(409);
    expect(quantityOf(db, id)).toBe(0);
  });

  it('only changes the vehicle that was bought', async () => {
    const first = insertVehicle(db, 3);
    const second = insertVehicle(db, 3);
    await buy(first);
    expect(quantityOf(db, second)).toBe(3);
  });

  it('never oversells when many purchases arrive at once', async () => {
    const id = insertVehicle(db, 3);
    const results = await Promise.all(Array.from({ length: 10 }, () => buy(id)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(3);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(quantityOf(db, id)).toBe(0);
  });

  it('returns 404 for a vehicle that does not exist', async () => {
    expect((await buy(999)).status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for the invalid id "%s"', async (id) => {
    expect((await buy(id)).status).toBe(400);
  });
});

describe('POST /api/vehicles/:id/restock', () => {
  it('requires a token', async () => {
    const id = insertVehicle(db, 3);
    const res = await request(app).post(`/api/vehicles/${id}/restock`).send({ amount: 5 });
    expect(res.status).toBe(401);
  });

  it('forbids normal users (403) and leaves the quantity alone', async () => {
    const id = insertVehicle(db, 3);
    const res = await restock(id, { amount: 5 }, userToken);
    expect(res.status).toBe(403);
    expect(quantityOf(db, id)).toBe(3);
  });

  it('lets an admin add stock and returns the updated vehicle', async () => {
    const id = insertVehicle(db, 3);
    const res = await restock(id, { amount: 7 });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(10);
    expect(quantityOf(db, id)).toBe(10);
  });

  it('makes a sold-out vehicle purchasable again', async () => {
    const id = insertVehicle(db, 0);
    expect((await buy(id)).status).toBe(409);
    await restock(id, { amount: 2 });
    expect((await buy(id)).status).toBe(200);
    expect(quantityOf(db, id)).toBe(1);
  });

  const badAmounts: [string, object][] = [
    ['missing amount', {}],
    ['zero', { amount: 0 }],
    ['negative', { amount: -5 }],
    ['decimal', { amount: 2.5 }],
    ['text instead of a number', { amount: '5' }],
    ['null', { amount: null }],
    ['above the maximum', { amount: MAX_QUANTITY + 1 }],
  ];

  it.each(badAmounts)('rejects an invalid amount: %s', async (_label, body) => {
    const id = insertVehicle(db, 3);
    const res = await restock(id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(quantityOf(db, id)).toBe(3);
  });

  it('rejects a restock that would push stock past the maximum', async () => {
    const id = insertVehicle(db, 5);
    const res = await restock(id, { amount: MAX_QUANTITY });
    expect(res.status).toBe(400);
    expect(quantityOf(db, id)).toBe(5);
  });

  it('returns 404 for a vehicle that does not exist', async () => {
    expect((await restock(999, { amount: 5 })).status).toBe(404);
  });

  it('returns 400 for an invalid id', async () => {
    expect((await restock('abc', { amount: 5 })).status).toBe(400);
  });
});
