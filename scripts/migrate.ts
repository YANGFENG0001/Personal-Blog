/**
 * Apply pending database migrations (and initial seed data). The app also does
 * this automatically on start; this script is for explicit upgrades/CI.
 *
 *   npm run db:migrate
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from '../src/server/migrations.ts';
import { seed } from '../src/server/seed.ts';

const file = path.join(path.resolve(process.env.DATA_DIR || './data'), 'fieldnotes.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const ran = migrate(db);
const seeded = seed(db);
console.log(`database: ${file}`);
console.log(ran.length ? `applied migrations: ${ran.join(', ')}` : 'no pending migrations');
if (seeded) console.log('seeded initial content');
db.close();
