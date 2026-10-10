/**
 * Consistent online backup of the SQLite database + uploads.
 *
 *   npm run backup                 → ./data/backups/fieldnotes-YYYYMMDD-HHMMSS.tar.gz (via tar if available) or a folder
 *   BACKUP_DIR=/mnt/backups npm run backup
 *
 * In Docker:  docker compose exec app node scripts/backup.ts
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
const outRoot = path.resolve(process.env.BACKUP_DIR || path.join(dataDir, 'backups'));
const keep = Number(process.env.BACKUP_KEEP || 14);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const dir = path.join(outRoot, `fieldnotes-${stamp}`);
fs.mkdirSync(dir, { recursive: true });

const db = new Database(path.join(dataDir, 'fieldnotes.db'), { readonly: true });
await db.backup(path.join(dir, 'fieldnotes.db'));
db.close();

const uploads = path.join(dataDir, 'uploads');
if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(dir, 'uploads'), { recursive: true });

let result = dir;
try {
  execFileSync('tar', ['-czf', `${dir}.tar.gz`, '-C', outRoot, path.basename(dir)]);
  fs.rmSync(dir, { recursive: true, force: true });
  result = `${dir}.tar.gz`;
} catch {
  // tar unavailable: keep the folder.
}

// Rotate old backups.
const all = fs.readdirSync(outRoot).filter((f) => f.startsWith('fieldnotes-')).sort();
for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(outRoot, old), { recursive: true, force: true });

console.log(`backup written: ${result}`);
