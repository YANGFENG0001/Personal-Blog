#!/usr/bin/env node
/**
 * FIELDNOTES 素材工作室 — local web UI.
 *   npm install && npm start   →  http://127.0.0.1:4777
 * Runs only on 127.0.0.1. Nothing is uploaded anywhere; you export a pack and
 * import it on your site (外观与主题 → 看板娘 → 导入角色包).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';
import { matte, finish, applyCorrections, splitSheet } from './lib/pipeline.mjs';
import { status as aiStatus, download as aiDownload } from './lib/ai.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4777);
const MAX = 40 * 1024 * 1024;

/** In-memory working set: id → { original, cleaned:{data,w,h}, info, method } */
const work = new Map();
let seq = 0;

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX) { reject(new Error('文件过大（上限 40MB）')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const pngOf = (img) => sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.w, height: img.h, channels: 4 } }).png({ compressionLevel: 3 }).toBuffer();

const routes = {
  'GET /api/status': async () => ({ ai: await aiStatus() }),

  'POST /api/model': async (req) => {
    const { id } = JSON.parse((await readBody(req)).toString());
    await aiDownload(id, (got, total) => process.stdout.write(`\r下载模型 ${id}: ${(got / 1048576).toFixed(1)}MB${total ? ` / ${(total / 1048576).toFixed(1)}MB` : ''}   `));
    process.stdout.write('\n');
    return { ok: true, ai: await aiStatus() };
  },

  /** Body: raw image. Query: mode, model, tolerance, key (hex). */
  'POST /api/matte': async (req, url) => {
    const buf = await readBody(req);
    const key = url.searchParams.get('key');
    const opt = {
      mode: url.searchParams.get('mode') || 'auto',
      model: url.searchParams.get('model') || 'anime',
      tolerance: url.searchParams.get('tolerance') ? Number(url.searchParams.get('tolerance')) : undefined,
      keyColor: key && /^[0-9a-f]{6}$/i.test(key) ? [0, 2, 4].map((i) => parseInt(key.slice(i, i + 2), 16)) : undefined,
    };
    const t = Date.now();
    const out = await matte(buf, opt);
    const id = String(++seq);
    work.set(id, { original: buf, cleaned: out, info: out.info, method: out.method });
    return { id, width: out.w, height: out.h, info: out.info, method: out.method, warning: out.warning, ms: Date.now() - t };
  },

  'GET /api/image': async (_req, url) => {
    const w = work.get(url.searchParams.get('id'));
    if (!w) throw Object.assign(new Error('not found'), { status: 404 });
    const which = url.searchParams.get('v');
    if (which === 'original') return { __raw: await sharp(w.original).rotate().png().toBuffer(), type: 'image/png' };
    return { __raw: await pngOf(w.cleaned), type: 'image/png' };
  },

  /** Body: { id, edits: base64 of Uint8 mask (0 keep, 1 erase, 2 restore) } */
  'POST /api/edit': async (req) => {
    const { id, edits } = JSON.parse((await readBody(req)).toString());
    const w = work.get(id);
    if (!w) throw new Error('图片已失效，请重新处理');
    const m = Buffer.from(edits, 'base64');
    if (m.length !== w.cleaned.w * w.cleaned.h) throw new Error('修补蒙版尺寸不匹配');
    await applyCorrections(w.cleaned, w.original, m);
    return { ok: true };
  },

  /** Body: { id } → splits a sticker sheet into pieces, returns new ids */
  'POST /api/split': async (req) => {
    const { id } = JSON.parse((await readBody(req)).toString());
    const w = work.get(id);
    if (!w) throw new Error('图片已失效');
    const pieces = await splitSheet(w.cleaned);
    const ids = [];
    for (const p of pieces) {
      const { data, info } = await sharp(p.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const nid = String(++seq);
      work.set(nid, { original: p.png, cleaned: { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height }, info: { kind: 'transparent' }, method: 'split' });
      ids.push({ id: nid, width: info.width, height: info.height });
    }
    return { pieces: ids };
  },

  /**
   * Export a mascot pack. Body: { manifest, states: { idle: id, talk: id, … } }
   * All states are fitted onto the idle frame's canvas (same size, bottom-centred).
   */
  'POST /api/export/mascot': async (req) => {
    const { manifest, states } = JSON.parse((await readBody(req)).toString());
    if (!states?.idle) throw new Error('至少需要 idle 默认状态图');
    const idle = await finish(work.get(states.idle).cleaned, 'mascot');
    const W = idle.width, H = idle.height;
    const files = {};
    const stateFiles = {};
    for (const [state, id] of Object.entries(states)) {
      if (!id) continue;
      const w = work.get(id);
      if (!w) throw new Error(`${state} 图片已失效`);
      let webp;
      if (state === 'idle') webp = idle.webp;
      else {
        const f = await finish(w.cleaned, 'mascot');
        // fit onto the idle canvas so frames swap in place
        const fitted = await sharp(f.png).resize({ width: W, height: H, fit: 'contain', position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        webp = await sharp(fitted).webp({ quality: 86, alphaQuality: 90, effort: 5 }).toBuffer();
      }
      files[`${state}.webp`] = new Uint8Array(webp);
      stateFiles[state] = `${state}.webp`;
    }
    const full = {
      format: 'fieldnotes-mascot@1',
      ...manifest,
      width: W,
      height: H,
      states: stateFiles,
      anchors: { baseline: 1, head: idle.anchors?.head ?? [0.5, 0.12], bubble: idle.anchors?.bubble ?? [0.5, 0.05], ...(manifest.anchors ?? {}) },
    };
    files['mascot.json'] = strToU8(JSON.stringify(full, null, 2));
    const zip = Buffer.from(zipSync(files, { level: 0 }));
    const outDir = path.join(here, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const name = `${(manifest.name || 'mascot').replace(/[^\w一-龥-]+/g, '_')}.mascot.zip`;
    fs.writeFileSync(path.join(outDir, name), zip);
    return { __raw: zip, type: 'application/zip', filename: name };
  },

  /** Export a single processed image. Query: id, kind (sticker|particle|cursor|background|cover|mascot), format (webp|png) */
  'GET /api/export/image': async (_req, url) => {
    const w = work.get(url.searchParams.get('id'));
    if (!w) throw new Error('图片已失效');
    const f = await finish(w.cleaned, url.searchParams.get('kind') || 'sticker');
    const png = url.searchParams.get('format') === 'png';
    return { __raw: png ? f.png : f.webp, type: png ? 'image/png' : 'image/webp', filename: `asset.${png ? 'png' : 'webp'}` };
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Only the local UI may call the API (blocks other sites in your browser from using it).
  if (req.method !== 'GET' && req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.origin)) return send(res, 403, { error: 'forbidden' });
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return send(res, 200, fs.readFileSync(path.join(here, 'ui', 'index.html')), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname.startsWith('/ui/')) {
    const file = path.join(here, 'ui', path.basename(url.pathname));
    if (fs.existsSync(file)) return send(res, 200, fs.readFileSync(file), file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
  }
  const fn = routes[`${req.method} ${url.pathname}`];
  if (!fn) return send(res, 404, { error: 'not found' });
  try {
    const out = await fn(req, url);
    if (out?.__raw) {
      res.writeHead(200, { 'content-type': out.type, 'cache-control': 'no-store', ...(out.filename ? { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}` } : {}) });
      return res.end(out.__raw);
    }
    send(res, 200, out);
  } catch (e) {
    send(res, e.status || 400, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nFIELDNOTES 素材工作室已启动：http://127.0.0.1:${PORT}\n（只在本机运行，关闭此窗口即停止）\n`);
});
