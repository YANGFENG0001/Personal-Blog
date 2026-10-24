/**
 * Import a `.mascot.zip` straight into the database.
 *
 * The HTTP endpoint needs an owner session, and resetting the owner password to
 * get one would sign the real owner out of every device — not worth it just to
 * import art. This mirrors `importPack()` in src/server/services/mascot-packs.ts
 * (same table columns, same 24-hex upload filenames, same pack_id link) so the
 * result is indistinguishable from an upload through 后台.
 *
 * Usage: node skills/mascot-studio/scripts/import-pack.mjs <pack.zip> [<pack.zip> ...]
 */
import Database from 'better-sqlite3';
import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STATES = ['idle', 'talk', 'happy', 'held', 'sleep', 'blink'];
const DATA = process.env.DATA_DIR || './data';
const UPLOADS = path.join(DATA, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const now = () => new Date().toISOString();

const sniff = (b) =>
  b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
    ? { mime: 'image/webp', ext: 'webp' }
    : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ? { mime: 'image/png', ext: 'png' }
      : null;

const db = new Database(path.join(DATA, 'fieldnotes.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

for (const zipPath of process.argv.slice(2)) {
  const files = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  const names = Object.keys(files).filter((n) => !n.endsWith('/'));
  const prefix = names.length && names.every((n) => n.includes('/')) ? names[0].split('/')[0] + '/' : '';
  const get = (n) => files[prefix + n];

  const manifest = JSON.parse(strFromU8(get('mascot.json')));
  const id = newId();
  const ts = now();

  const images = [];
  for (const state of STATES) {
    const file = manifest.states[state];
    if (!file) continue;
    const buf = Buffer.from(get(file));
    const type = sniff(buf);
    if (!type) throw new Error(`${file} 不是 PNG/WebP`);
    images.push([state, `${state}.${type.ext}`, buf, type]);
  }

  db.transaction(() => {
    db.prepare('INSERT INTO mascot_packs (id, name, manifest, created_at, updated_at) VALUES (?,?,?,?,?)').run(
      id, manifest.name, JSON.stringify(manifest), ts, ts,
    );
    for (const [, name, buf, type] of images) {
      const filename = `${crypto.randomBytes(12).toString('hex')}.${type.ext}`;
      fs.writeFileSync(path.join(UPLOADS, filename), buf, { flag: 'wx' });
      db.prepare('INSERT INTO uploads (id, filename, original_name, mime, size, created_at, pack_id) VALUES (?,?,?,?,?,?,?)').run(
        newId(), filename, name, type.mime, buf.length, ts, id,
      );
    }
  })();

  console.log(`✓ ${manifest.name.padEnd(5)} ${id}  ${images.map((i) => i[0]).join('/')}  ${manifest.width}x${manifest.height}`);
}
db.close();
