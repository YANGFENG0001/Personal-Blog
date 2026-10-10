/**
 * Create or reset the single owner account.
 *
 *   npm run owner:create -- <username>            (prompts for password)
 *   OWNER_PASSWORD=... npm run owner:create -- <username>
 *
 * In Docker:  docker compose exec app node scripts/create-owner.ts <username>
 */
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { migrate } from '../src/server/migrations.ts';
import { seed } from '../src/server/seed.ts';
import { hashPassword, passwordProblems } from '../src/server/auth/password.ts';

function ask(question: string, hidden: boolean): Promise<string> {
  const muted = new Writable({ write: (_c, _e, cb) => cb() });
  const rl = readline.createInterface({ input: process.stdin, output: hidden ? muted : process.stdout, terminal: true });
  process.stdout.write(question);
  return new Promise((resolve) =>
    rl.question('', (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    }),
  );
}

const username = (process.argv[2] || process.env.OWNER_USERNAME || '').trim();
if (!username) {
  console.error('用法: npm run owner:create -- <用户名>');
  process.exit(1);
}

let password = process.env.OWNER_PASSWORD ?? '';
if (!password) {
  password = await ask('请输入密码（至少 10 位）: ', true);
  const again = await ask('再次输入密码: ', true);
  if (password !== again) {
    console.error('两次输入不一致');
    process.exit(1);
  }
}
const problem = passwordProblems(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const file = path.join(path.resolve(process.env.DATA_DIR || './data'), 'fieldnotes.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
migrate(db);
seed(db);

const hash = await hashPassword(password);
const existing = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
if (existing) {
  db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, existing.id);
  db.prepare('DELETE FROM sessions').run();
  console.log(`✓ 已重置站主账号「${username}」，所有已登录设备需要重新登录。`);
} else {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username, hash, new Date().toISOString());
  console.log(`✓ 已创建站主账号「${username}」。`);
}
db.close();
console.log('  登录地址：/owner/login');
