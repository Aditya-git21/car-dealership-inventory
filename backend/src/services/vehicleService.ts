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

// ---------- Search ----------

// Query params arrive as text, or arrays if repeated (?make=a&make=b)
function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a single value`);
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed; // blank filter = no filter
}

function optionalPrice(value: unknown, field: string): number | undefined {
  const text = optionalText(value, field);
  if (text === undefined) return undefined;
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new HttpError(400, `${field} must be a non-negative number`);
  }
  return Number(text);
}

// In LIKE, % and _ are wildcards. Escape them so the user's text is matched literally.
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

export function searchVehicles(db: Db, query: Record<string, unknown>): Vehicle[] {
  const make = optionalText(query.make, 'make');
  const model = optionalText(query.model, 'model');
  const category = optionalText(query.category, 'category');
  const minPrice = optionalPrice(query.minPrice, 'minPrice');
  const maxPrice = optionalPrice(query.maxPrice, 'maxPrice');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(400, 'minPrice cannot be greater than maxPrice');
  }

  // Build the WHERE clause only from the filters that were provided.
  // Values always go through ? placeholders, never into the SQL text.
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (make) {
    conditions.push(`make LIKE ? ESCAPE '\\'`);
    params.push(likePattern(make));
  }
  if (model) {
    conditions.push(`model LIKE ? ESCAPE '\\'`);
    params.push(likePattern(model));
  }
  if (category) {
    conditions.push(`category LIKE ? ESCAPE '\\'`);
    params.push(likePattern(category));
  }
  if (minPrice !== undefined) {
    conditions.push('price >= ?');
    params.push(minPrice);
  }
  if (maxPrice !== undefined) {
    conditions.push('price <= ?');
    params.push(maxPrice);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT ${COLUMNS} FROM vehicles ${where} ORDER BY id`).all(...params) as Vehicle[];
}

// ---------- Inventory ----------

// The stock check and the decrement happen in ONE statement, so two buyers
// can never both take the last car. "changes = 0" means no row matched.
export function purchaseVehicle(db: Db, id: number): Vehicle {
  const info = db
    .prepare('UPDATE vehicles SET quantity = quantity - 1 WHERE id = ? AND quantity > 0')
    .run(id);

  if (info.changes === 0) {
    getVehicle(db, id); // throws 404 if the vehicle doesn't exist
    throw new HttpError(409, 'Vehicle is out of stock');
  }
  return getVehicle(db, id);
}

export function restockVehicle(db: Db, id: number, amount: unknown): Vehicle {
  if (
    typeof amount !== 'number' ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > MAX_QUANTITY
  ) {
    throw new HttpError(400, `amount must be a whole number between 1 and ${MAX_QUANTITY}`);
  }

  // Same idea: add stock only if the new total stays within the limit
  const info = db
    .prepare('UPDATE vehicles SET quantity = quantity + ? WHERE id = ? AND quantity + ? <= ?')
    .run(amount, id, amount, MAX_QUANTITY);

  if (info.changes === 0) {
    getVehicle(db, id); // throws 404 if the vehicle doesn't exist
    throw new HttpError(400, `Stock cannot exceed ${MAX_QUANTITY}`);
  }
  return getVehicle(db, id);
}
