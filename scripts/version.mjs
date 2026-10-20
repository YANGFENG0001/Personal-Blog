#!/usr/bin/env node
/**
 * 统一版本号：VERSION 文件 + package.json 两处一起改，然后打印发版命令。
 *
 *   npm run version:bump 1.1.0
 *
 * 只改文件、不提交、不打 tag —— 是否发布由你决定。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const next = (process.argv[2] ?? '').trim().replace(/^v/, '');

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error('用法: npm run version:bump <x.y.z>   （例：npm run version:bump 1.1.0）');
  process.exit(1);
}

const versionFile = path.join(root, 'VERSION');
const pkgFile = path.join(root, 'package.json');
const prev = fs.readFileSync(versionFile, 'utf8').trim();
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

fs.writeFileSync(versionFile, `${next}\n`);
pkg.version = next;
fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`版本号：${prev} → ${next}`);
console.log(`
下一步：
  git add VERSION package.json
  git commit -m "release: v${next}"
  git push
  git tag v${next}
  git push origin v${next}
`);
