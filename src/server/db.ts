import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from './migrations';
import { seed } from './seed';

export type Db = Database.Database;

let instance: Db | null = null;

export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  seed(db);
  return db;
}

export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR || './data');
}

export function getDb(): Db {
  if (!instance) instance = openDb(path.join(dataDir(), 'fieldnotes.db'));
  return instance;
}

/** Test hook: swap the process-wide database (e.g. for an in-memory one). */
export function setDb(db: Db | null): void {
  instance = db;
}

export function now(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
