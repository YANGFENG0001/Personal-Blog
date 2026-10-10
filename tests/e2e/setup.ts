/** Fresh data dir + owner account for E2E. Run before the server starts. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const dir = process.env.DATA_DIR || './.e2e-data';
fs.rmSync(dir, { recursive: true, force: true });
execFileSync(process.execPath, ['--no-warnings', 'scripts/create-owner.ts', 'owner'], {
  env: { ...process.env, DATA_DIR: dir },
  stdio: 'inherit',
});
