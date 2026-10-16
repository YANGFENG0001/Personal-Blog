#!/usr/bin/env node
/**
 * FIELDNOTES 素材工作室 — command line.
 *
 *   node cli.mjs matte  <in.png> [out.webp] [--mode auto|algo|ai|both] [--model anime|general] [--tolerance N] [--key 00ff00] [--kind mascot|sticker|...]
 *   node cli.mjs split  <sheet.png> <outDir>          split a sticker sheet into pieces
 *   node cli.mjs mascot <dir> [out.zip] [--name 名字]  build a pack from idle.png, talk.png, … in <dir>
 *   node cli.mjs model  anime|general                  download an AI model
 *   node cli.mjs check  <pack.zip>                     validate a pack before importing
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { matte, finish, splitSheet } from './lib/pipeline.mjs';
import { download } from './lib/ai.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? true : rest[++i];
  else args.push(rest[i]);
}
const STATES = ['idle', 'talk', 'happy', 'held', 'sleep', 'blink'];
const opts = () => ({
  mode: flags.mode || 'auto',
  model: flags.model || 'anime',
  tolerance: flags.tolerance ? Number(flags.tolerance) : undefined,
  keyColor: typeof flags.key === 'string' ? [0, 2, 4].map((i) => parseInt(flags.key.replace('#', '').slice(i, i + 2), 16)) : undefined,
});
const report = (file, r) => console.log(`${path.basename(file)}: ${r.info.kind} → ${r.method}${r.warning ? `（${r.warning}）` : ''}`);

async function main() {
  if (cmd === 'matte') {
    const [input, output = input.replace(/\.\w+$/, '.cut.webp')] = args;
    const r = await matte(fs.readFileSync(input), opts());
    report(input, r);
    const f = await finish(r, flags.kind || 'mascot');
    fs.writeFileSync(output, output.endsWith('.png') ? f.png : f.webp);
    console.log(`→ ${output}  ${f.width}×${f.height}`);
  } else if (cmd === 'split') {
    const [input, outDir = 'pieces'] = args;
    const r = await matte(fs.readFileSync(input), opts());
    report(input, r);
    const pieces = await splitSheet(r);
    fs.mkdirSync(outDir, { recursive: true });
    for (const [i, p] of pieces.entries()) {
      const f = await finish({ ...(await toRaw(p.png)) }, flags.kind || 'sticker');
      const out = path.join(outDir, `${String(i + 1).padStart(2, '0')}.webp`);
      fs.writeFileSync(out, f.webp);
      console.log(`→ ${out}  ${f.width}×${f.height}`);
    }
  } else if (cmd === 'mascot') {
    const [dir, output] = args;
    const find = (s) => ['png', 'webp', 'jpg', 'jpeg'].map((e) => path.join(dir, `${s}.${e}`)).find((f) => fs.existsSync(f));
    if (!find('idle')) throw new Error(`${dir} 里没有 idle.png（必需）`);
    const done = {};
    for (const s of STATES) {
      const f = find(s);
      if (!f) continue;
      const r = await matte(fs.readFileSync(f), opts());
      report(f, r);
      done[s] = await finish(r, 'mascot');
    }
    const W = done.idle.width, H = done.idle.height;
    const files = {};
    const states = {};
    for (const [s, f] of Object.entries(done)) {
      const webp = s === 'idle' ? f.webp : await sharp(await sharp(f.png).resize({ width: W, height: H, fit: 'contain', position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()).webp({ quality: 86, alphaQuality: 90 }).toBuffer();
      files[`${s}.webp`] = new Uint8Array(webp);
      states[s] = `${s}.webp`;
    }
    const linesFile = path.join(dir, 'lines.json');
    const manifest = {
      format: 'fieldnotes-mascot@1',
      name: flags.name || path.basename(path.resolve(dir)),
      author: flags.author || '',
      license: flags.license || '',
      width: W,
      height: H,
      states,
      anchors: { baseline: 1, head: done.idle.anchors?.head ?? [0.5, 0.12], bubble: done.idle.anchors?.bubble ?? [0.5, 0.05] },
      display: { mode: flags.display || 'full', height: Number(flags.height || 240), flip: false, shadow: true, outline: 'soft' },
      motion: { breathe: true, sway: true, swing: true, blinkEvery: 5 },
      lines: fs.existsSync(linesFile) ? JSON.parse(fs.readFileSync(linesFile, 'utf8')) : {},
    };
    files['mascot.json'] = strToU8(JSON.stringify(manifest, null, 2));
    const out = output || `${manifest.name}.mascot.zip`;
    fs.writeFileSync(out, zipSync(files, { level: 0 }));
    console.log(`→ ${out}  (${Object.keys(states).join(', ')}, ${W}×${H})`);
  } else if (cmd === 'model') {
    const id = args[0] || 'anime';
    const dest = await download(id, (g, t) => process.stdout.write(`\r${(g / 1048576).toFixed(1)}MB${t ? ` / ${(t / 1048576).toFixed(1)}MB` : ''}   `));
    console.log(`\n→ ${dest}`);
  } else if (cmd === 'check') {
    const files = unzipSync(new Uint8Array(fs.readFileSync(args[0])));
    const names = Object.keys(files);
    const prefix = names.every((n) => n.includes('/')) ? names[0].split('/')[0] + '/' : '';
    const m = JSON.parse(strFromU8(files[prefix + 'mascot.json'] ?? strToU8('null')));
    const problems = [];
    if (!m) problems.push('缺少 mascot.json');
    else {
      if (m.format !== 'fieldnotes-mascot@1') problems.push('format 必须是 "fieldnotes-mascot@1"');
      if (!m.states?.idle) problems.push('states.idle 必需');
      for (const [s, f] of Object.entries(m.states ?? {})) {
        if (!STATES.includes(s)) problems.push(`未知状态 ${s}`);
        const data = files[prefix + f];
        if (!data) { problems.push(`缺少文件 ${f}`); continue; }
        const meta = await sharp(Buffer.from(data)).metadata();
        if (!meta.hasAlpha) problems.push(`${f} 没有透明通道`);
        if (meta.width !== m.width || meta.height !== m.height) problems.push(`${f} 尺寸 ${meta.width}×${meta.height} 与 mascot.json 的 ${m.width}×${m.height} 不一致`);
        if (data.length > 8 * 1024 * 1024) problems.push(`${f} 超过 8MB`);
      }
    }
    if (problems.length) { console.log('✗ 有问题：\n  - ' + problems.join('\n  - ')); process.exitCode = 1; }
    else console.log(`✓ ${m.name}：${Object.keys(m.states).join(', ')}，${m.width}×${m.height}，可以导入`);
  } else {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n').replace(/^ \*\s?/gm, ''));
  }
}

async function toRaw(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height };
}

main().catch((e) => { console.error('✗', e.message); process.exitCode = 1; });
