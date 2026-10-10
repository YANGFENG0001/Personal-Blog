import crypto from 'node:crypto';
import { getDb, newId, now } from '../db';
import { hashPassword, verifyPassword } from './password';

export const SESSION_COOKIE = 'fn_session';
export const CSRF_HEADER = 'x-csrf-token';

const SHORT_TTL = 12 * 3600_000; // without "remember me"
const LONG_TTL = 30 * 86_400_000; // with "remember me" (rolling)

export interface SessionInfo {
  userId: string;
  username: string;
  csrfToken: string;
  remember: boolean;
  expiresAt: string;
}

/** Only the SHA-256 of the session token is stored, so a DB leak can't hijack sessions. */
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export function ownerExists(): boolean {
  return !!getDb().prepare('SELECT 1 FROM users LIMIT 1').get();
}

export async function upsertOwner(username: string, password: string): Promise<void> {
  const db = getDb();
  const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, existing.id);
    // Changing the password logs out every device.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(newId(), username, hash, now());
  }
}

// Dummy hash so failed lookups take as long as real verifications (no user enumeration by timing).
let dummyHash: Promise<string> | null = null;

export async function checkCredentials(username: string, password: string): Promise<string | null> {
  const row = getDb().prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row) {
    dummyHash ??= hashPassword('dummy-password-for-timing');
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, row.password_hash)) ? row.id : null;
}

export function createSession(userId: string, remember: boolean, meta: { ua?: string; ip?: string } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const ts = Date.now();
  const expires = new Date(ts + (remember ? LONG_TTL : SHORT_TTL));
  const db = getDb();
  db.prepare(
    `INSERT INTO sessions (id_hash, user_id, csrf_token, remember, created_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(hashToken(token), userId, csrf, remember ? 1 : 0, new Date(ts).toISOString(), expires.toISOString(), meta.ua?.slice(0, 300) ?? null, meta.ip ?? null);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date(ts).toISOString());
  return { token, csrf, expires, remember };
}

/**
 * Resolve a session token. Long ("remember me") sessions slide forward when
 * more than a day has passed since they were last extended.
 */
export function readSession(token: string | undefined): (SessionInfo & { renewedUntil?: Date }) | null {
  if (!token || token.length > 100) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id_hash, s.user_id AS userId, u.username, s.csrf_token AS csrfToken, s.remember, s.expires_at AS expiresAt
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`,
    )
    .get(hashToken(token)) as (Omit<SessionInfo, 'remember'> & { id_hash: string; remember: number }) | undefined;
  if (!row) return null;
  const nowMs = Date.now();
  if (Date.parse(row.expiresAt) <= nowMs) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(row.id_hash);
    return null;
  }
  const info: SessionInfo & { renewedUntil?: Date } = {
    userId: row.userId, username: row.username, csrfToken: row.csrfToken, remember: !!row.remember, expiresAt: row.expiresAt,
  };
  if (row.remember && Date.parse(row.expiresAt) - nowMs < LONG_TTL - 86_400_000) {
    const until = new Date(nowMs + LONG_TTL);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?').run(until.toISOString(), row.id_hash);
    info.expiresAt = until.toISOString();
    info.renewedUntil = until;
  }
  return info;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE id_hash = ?').run(hashToken(token));
}

export function destroyAllSessions(): void {
  getDb().prepare('DELETE FROM sessions').run();
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
