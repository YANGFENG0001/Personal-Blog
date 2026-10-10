import crypto from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing. Uses Node's built-in argon2id (Node >= 24.7) and falls
 * back to scrypt on older runtimes. The algorithm is stored in the hash so
 * either can be verified later.
 *
 * Format:  argon2id$<memKiB>$<passes>$<parallelism>$<saltB64>$<hashB64>
 *          scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>
 */

type Argon2Fn = (
  algorithm: 'argon2id',
  params: { message: string; nonce: Buffer; parallelism: number; tagLength: number; memory: number; passes: number },
  cb: (err: Error | null, key: Buffer) => void,
) => void;

const argon2 = (crypto as unknown as { argon2?: Argon2Fn }).argon2;
const argon2Async = argon2 ? promisify(argon2) : null;
const scryptAsync = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

const ARGON = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 }; // OWASP baseline
const SCRYPT = { N: 1 << 15, r: 8, p: 1, len: 32 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  if (argon2Async) {
    const key = await argon2Async('argon2id', { message: password, nonce: salt, ...ARGON });
    return ['argon2id', ARGON.memory, ARGON.passes, ARGON.parallelism, salt.toString('base64'), key.toString('base64')].join('$');
  }
  const key = await scryptAsync(password, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, a, b, c, saltB64, hashB64] = stored.split('$');
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  let actual: Buffer;
  if (alg === 'argon2id') {
    if (!argon2Async) throw new Error('This password hash needs Node >= 24.7 (argon2 support)');
    actual = await argon2Async('argon2id', {
      message: password, nonce: salt, memory: Number(a), passes: Number(b), parallelism: Number(c), tagLength: expected.length,
    });
  } else if (alg === 'scrypt') {
    actual = await scryptAsync(password, salt, expected.length, { N: Number(a), r: Number(b), p: Number(c), maxmem: 64 * 1024 * 1024 });
  } else {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return '密码至少需要 10 个字符';
  if (pw.length > 256) return '密码过长';
  return null;
}
