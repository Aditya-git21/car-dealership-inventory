import { Db } from '../db';
import { HttpError } from '../errors';

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

export const MAX_PRICE = 100_000_000;
export const MAX_QUANTITY = 1_000_000;
const COLUMNS = 'id, make, model, category, price, quantity';

// Ids from the URL are text. Accept only whole numbers 1, 2, 3...
// Ids from the URL are untrusted. Accept only whole numbers 1, 2, 3...
export function parseId(raw: unknown): number {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) {
    throw new HttpError(400, 'Invalid vehicle id');
  }
  return Number(raw);
}

function cleanText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${field} must be non-empty text`);
  }
  return value.trim();
}

function cleanPrice(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
    throw new HttpError(400, `price must be a number between 0 and ${MAX_PRICE}`);
  }
  return value;
}

function cleanQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_QUANTITY) {
    throw new HttpError(400, `quantity must be a whole number between 0 and ${MAX_QUANTITY}`);
  }
  return value;
}

export function getVehicle(db: Db, id: number): Vehicle {
  const row = db.prepare(`SELECT ${COLUMNS} FROM vehicles WHERE id = ?`).get(id) as
    | Vehicle
    | undefined;
  if (!row) throw new HttpError(404, 'Vehicle not found');
  return row;
}

export function listVehicles(db: Db): Vehicle[] {
  return db.prepare(`SELECT ${COLUMNS} FROM vehicles ORDER BY id`).all() as Vehicle[];
}

export function createVehicle(db: Db, input: Record<string, unknown> | undefined): Vehicle {
  const body = input ?? {};
  const make = cleanText(body.make, 'make');
  const model = cleanText(body.model, 'model');
  const category = cleanText(body.category, 'category');
  const price = cleanPrice(body.price);
  const quantity = cleanQuantity(body.quantity);

  const info = db
    .prepare('INSERT INTO vehicles (make, model, category, price, quantity) VALUES (?, ?, ?, ?, ?)')
    .run(make, model, category, price, quantity);
  return getVehicle(db, Number(info.lastInsertRowid));
}

// Partial update: only the fields that were sent are validated and changed
export function updateVehicle(
  db: Db,
  id: number,
  input: Record<string, unknown> | undefined
): Vehicle {
  const body = input ?? {};
  const changes: Record<string, string | number> = {};
  if (body.make !== undefined) changes.make = cleanText(body.make, 'make');
  if (body.model !== undefined) changes.model = cleanText(body.model, 'model');
  if (body.category !== undefined) changes.category = cleanText(body.category, 'category');
  if (body.price !== undefined) changes.price = cleanPrice(body.price);
  if (body.quantity !== undefined) changes.quantity = cleanQuantity(body.quantity);

  const fields = Object.keys(changes);
  if (fields.length === 0) throw new HttpError(400, 'Provide at least one field to update');

  getVehicle(db, id); // 404 if it doesn't exist

  // Column names come from the fixed list above, never from the client, so this is safe
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  db.prepare(`UPDATE vehicles SET ${setClause} WHERE id = ?`).run(...Object.values(changes), id);
  return getVehicle(db, id);
}

export function deleteVehicle(db: Db, id: number): void {
  getVehicle(db, id); // 404 if it doesn't exist
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
}
