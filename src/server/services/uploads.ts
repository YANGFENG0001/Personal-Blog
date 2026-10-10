import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDir, getDb, newId, now } from '../db';
import { badRequest, notFound } from '../errors';

export const MAX_UPLOAD = 8 * 1024 * 1024;

/** Allowed types, verified by magic bytes — the client-sent MIME is not trusted. */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 6).toString('ascii').startsWith('GIF8') },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'image/avif', ext: 'avif', test: (b) => b.subarray(4, 12).toString('ascii') === 'ftypavif' },
];

export function uploadsDir(): string {
  const dir = path.join(dataDir(), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function sniff(buf: Buffer): { mime: string; ext: string } | null {
  const hit = SIGNATURES.find((s) => buf.length >= 12 && s.test(buf));
  return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

export function saveUpload(buf: Buffer, originalName: string) {
  if (buf.length === 0) throw badRequest('文件为空');
  if (buf.length > MAX_UPLOAD) throw badRequest(`文件不能超过 ${MAX_UPLOAD / 1024 / 1024}MB`);
  const type = sniff(buf);
  if (!type) throw badRequest('只支持 PNG / JPEG / GIF / WebP / AVIF 图片');
  // Random, server-chosen filename: no path traversal, no user-controlled extension.
  const filename = `${crypto.randomBytes(12).toString('hex')}.${type.ext}`;
  fs.writeFileSync(path.join(uploadsDir(), filename), buf, { flag: 'wx' });
  const id = newId();
  getDb()
    .prepare('INSERT INTO uploads (id, filename, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, filename, originalName.slice(0, 200), type.mime, buf.length, now());
  return { id, url: `/uploads/${filename}`, mime: type.mime, size: buf.length };
}

export function readUpload(filename: string): { buf: Buffer; mime: string } {
  if (!/^[a-f0-9]{24}\.(png|jpg|gif|webp|avif)$/.test(filename)) throw notFound('文件');
  const row = getDb().prepare('SELECT mime FROM uploads WHERE filename = ?').get(filename) as { mime: string } | undefined;
  if (!row) throw notFound('文件');
  const file = path.join(uploadsDir(), filename);
  if (!fs.existsSync(file)) throw notFound('文件');
  return { buf: fs.readFileSync(file), mime: row.mime };
}

export function listUploads() {
  return getDb()
    .prepare('SELECT id, filename, original_name AS originalName, mime, size, created_at AS createdAt FROM uploads ORDER BY created_at DESC LIMIT 200')
    .all() as { id: string; filename: string; originalName: string; mime: string; size: number; createdAt: string }[];
}

export function deleteUpload(id: string): void {
  const row = getDb().prepare('SELECT filename FROM uploads WHERE id = ?').get(id) as { filename: string } | undefined;
  if (!row) throw notFound('文件');
  fs.rmSync(path.join(uploadsDir(), row.filename), { force: true });
  getDb().prepare('DELETE FROM uploads WHERE id = ?').run(id);
}
