import request from 'supertest';
import { Db } from '../src/db';
import { setupApp, tokenFor, App } from './helpers';

let app: App;
let db: Db;
let userToken: string;
let adminToken: string;

const car = { make: 'Toyota', model: 'Camry', category: 'Sedan', price: 25000, quantity: 5 };
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const count = () => (db.prepare('SELECT COUNT(*) AS n FROM vehicles').get() as { n: number }).n;

beforeEach(async () => {
  ({ app, db } = setupApp());
  userToken = await tokenFor(app, db, 'USER');
  adminToken = await tokenFor(app, db, 'ADMIN');
});
afterEach(() => db.close());

const addCar = (body: object = car, token = userToken) =>
  request(app).post('/api/vehicles').set(auth(token)).send(body);
const update = (id: number | string, body: object, token = userToken) =>
  request(app).put(`/api/vehicles/${id}`).set(auth(token)).send(body);
const remove = (id: number | string, token = adminToken) =>
  request(app).delete(`/api/vehicles/${id}`).set(auth(token));

describe('POST /api/vehicles', () => {
  it('requires a token', async () => {
    const res = await request(app).post('/api/vehicles').send(car);
    expect(res.status).toBe(401);
  });

  it('adds a vehicle and gives each one a unique id', async () => {
    const first = await addCar();
    const second = await addCar();
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject(car);
    expect(typeof first.body.id).toBe('number');
    expect(second.body.id).not.toBe(first.body.id);
  });

  it('trims text fields', async () => {
    const res = await addCar({ ...car, make: '  Toyota ', model: ' Camry  ' });
    expect(res.body.make).toBe('Toyota');
    expect(res.body.model).toBe('Camry');
  });

  const badCars: [string, object][] = [
    ['empty body', {}],
    ['missing make', { ...car, make: undefined }],
    ['blank make', { ...car, make: '   ' }],
    ['make not a string', { ...car, make: 123 }],
    ['missing model', { ...car, model: undefined }],
    ['missing category', { ...car, category: undefined }],
    ['missing price', { ...car, price: undefined }],
    ['price as string', { ...car, price: '25000' }],
    ['price null', { ...car, price: null }],
    ['negative price', { ...car, price: -1 }],
    ['price too large', { ...car, price: 1000000000000 }],
    ['missing quantity', { ...car, quantity: undefined }],
    ['quantity as string', { ...car, quantity: '5' }],
    ['negative quantity', { ...car, quantity: -1 }],
    ['decimal quantity', { ...car, quantity: 2.5 }],
    ['quantity too large', { ...car, quantity: 1000000000 }],
  ];

  it.each(badCars)('rejects invalid input and saves nothing: %s', async (_label, body) => {
    const res = await addCar(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(count()).toBe(0);
  });
});

describe('GET /api/vehicles', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
  });

  it('returns an empty list when there are no vehicles', async () => {
    const res = await request(app).get('/api/vehicles').set(auth(userToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists all vehicles, including out-of-stock ones', async () => {
    await addCar();
    await addCar({ ...car, model: 'Corolla', quantity: 0 });
    const res = await request(app).get('/api/vehicles').set(auth(userToken));
    expect(res.body).toHaveLength(2);
    expect(res.body.some((v: { quantity: number }) => v.quantity === 0)).toBe(true);
  });
});

describe('PUT /api/vehicles/:id', () => {
  it('requires a token', async () => {
    const res = await request(app).put('/api/vehicles/1').send({ price: 1 });
    expect(res.status).toBe(401);
  });

  it('updates only the fields that were sent', async () => {
    const { body: created } = await addCar();
    const res = await update(created.id, { price: 27000 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...created, price: 27000 });
  });

  it('updates several fields at once and trims text', async () => {
    const { body: created } = await addCar();
    const res = await update(created.id, { make: ' Honda ', category: 'SUV', quantity: 9 });
    expect(res.body).toMatchObject({ make: 'Honda', category: 'SUV', quantity: 9, model: 'Camry' });
  });

  it('returns 404 for a vehicle that does not exist', async () => {
    const res = await update(999, { price: 1 });
    expect(res.status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for the invalid id "%s"', async (id) => {
    const res = await update(id, { price: 1 });
    expect(res.status).toBe(400);
  });

  const badUpdates: [string, object][] = [
    ['empty body', {}],
    ['only unknown fields', { colour: 'red' }],
    ['blank make', { make: '  ' }],
    ['make null', { make: null }],
    ['negative price', { price: -5 }],
    ['price as string', { price: '100' }],
    ['negative quantity', { quantity: -1 }],
    ['decimal quantity', { quantity: 1.5 }],
  ];

  it.each(badUpdates)('rejects invalid input: %s', async (_label, body) => {
    const { body: created } = await addCar();
    const res = await update(created.id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('DELETE /api/vehicles/:id', () => {
  it('requires a token', async () => {
    const res = await request(app).delete('/api/vehicles/1');
    expect(res.status).toBe(401);
  });

  it('forbids normal users (403) and leaves the vehicle in place', async () => {
    const { body: created } = await addCar();
    const res = await remove(created.id, userToken);
    expect(res.status).toBe(403);
    expect(count()).toBe(1);
  });

  it('lets an admin delete a vehicle', async () => {
    const { body: created } = await addCar();
    const res = await remove(created.id);
    expect(res.status).toBe(204);
    expect(count()).toBe(0);
  });

  it('returns 404 for a vehicle that does not exist', async () => {
    const res = await remove(999);
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid id', async () => {
    const res = await remove('abc');
    expect(res.status).toBe(400);
  });
});
