import { createApp } from './app';
import { createDb } from './db';

const db = createDb(process.env.DB_FILE || 'dealership.db');
const port = Number(process.env.PORT) || 3000;

createApp(db).listen(port, () => console.log(`API running on port ${port}`));
