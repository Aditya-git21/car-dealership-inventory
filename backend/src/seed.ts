import { createDb } from './db';
import { ensureAdmin } from './services/authService';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD, e.g. ADMIN_EMAIL=a@b.com ADMIN_PASSWORD=pass12345 npm run seed');
  process.exit(1);
}

const db = createDb(process.env.DB_FILE || 'dealership.db');
ensureAdmin(db, email, password);
console.log(`Admin ready: ${email}`);
db.close();
