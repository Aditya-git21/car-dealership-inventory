import request from 'supertest';
import { Db } from '../src/db';
import { setupApp, tokenFor, App } from './helpers';

let app: App;
let db: Db;
let token: string;

// make, model, category, price, quantity  (ids 1 to 5, in this order)
const seed: [string, string, string, number, number][] = [
  ['Toyota', 'Camry', 'Sedan', 25000, 5],
  ['Toyota', 'RAV4', 'SUV', 32000, 0], // out of stock, must still be searchable
  ['Honda', 'Civic', 'Sedan', 22000, 3],
  ['Honda', 'CR-V', 'SUV', 30000, 2],
  ['Ford', 'F-150', 'Truck', 45000, 4],
];

beforeEach(async () => {
  ({ app, db } = setupApp());
  token = await tokenFor(app, db, 'USER');
  const insert = db.prepare(
    'INSERT INTO vehicles (make, model, category, price, quantity) VALUES (?, ?, ?, ?, ?)'
  );
  seed.forEach((row) => insert.run(...row));
});
afterEach(() => db.close());

const auth = () => ({ Authorization: `Bearer ${token}` });
const search = (query: Record<string, string> = {}) =>
  request(app).get('/api/vehicles/search').query(query).set(auth());
const models = (res: { body: any }) => res.body.map((v: { model: string }) => v.model);

describe('GET /api/vehicles/search', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/api/vehicles/search');
    expect(res.status).toBe(401);
  });

  it('returns every vehicle when no filters are given', async () => {
    const res = await search();
    expect(res.status).toBe(200);
    expect(models(res)).toEqual(['Camry', 'RAV4', 'Civic', 'CR-V', 'F-150']);
  });

  const filterCases: [string, Record<string, string>, string[]][] = [
    ['make, partial and any case', { make: 'toy' }, ['Camry', 'RAV4']],
    ['model, any case', { model: 'CIVIC' }, ['Civic']],
    ['category, any case', { category: 'suv' }, ['RAV4', 'CR-V']],
    ['make and category together', { make: 'honda', category: 'SUV' }, ['CR-V']],
    ['minPrice only, inclusive', { minPrice: '30000' }, ['RAV4', 'CR-V', 'F-150']],
    ['maxPrice only, inclusive', { maxPrice: '25000' }, ['Camry', 'Civic']],
    ['price range', { minPrice: '25000', maxPrice: '30000' }, ['Camry', 'CR-V']],
    ['exact price (min equals max)', { minPrice: '30000', maxPrice: '30000' }, ['CR-V']],
    ['decimal price', { maxPrice: '22000.5' }, ['Civic']],
    ['spaces around text are trimmed', { make: '  toyota ' }, ['Camry', 'RAV4']],
    ['blank filters are ignored', { make: '', model: '  ', minPrice: '' },
      ['Camry', 'RAV4', 'Civic', 'CR-V', 'F-150']],
    ['no matches gives an empty list', { make: 'tesla' }, []],
    ['% is treated as plain text, not a wildcard', { make: '%' }, []],
    ['_ is treated as plain text, not a wildcard', { model: '_' }, []],
    ['SQL injection text is just text', { make: "' OR '1'='1" }, []],
  ];

  it.each(filterCases)('filters by %s', async (_label, query, expected) => {
    const res = await search(query);
    expect(res.status).toBe(200);
    expect(models(res)).toEqual(expected);
  });

  const badQueries: [string, string][] = [
    ['minPrice that is not a number', '?minPrice=abc'],
    ['maxPrice that is not a number', '?maxPrice=abc'],
    ['negative minPrice', '?minPrice=-5'],
    ['scientific notation', '?maxPrice=1e3'],
    ['minPrice greater than maxPrice', '?minPrice=30000&maxPrice=20000'],
    ['a repeated make parameter', '?make=a&make=b'],
    ['a repeated minPrice parameter', '?minPrice=1&minPrice=2'],
  ];

  it.each(badQueries)('rejects %s with 400', async (_label, qs) => {
    const res = await request(app).get(`/api/vehicles/search${qs}`).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
