/**
 * Optional AI background removal (ONNX), used by the local asset studio only.
 *
 * Requires the optional dependency `onnxruntime-node`. Models are downloaded on
 * first use into ~/.fieldnotes-studio/models (several mirrors are tried).
 *
 *  - anime:   skytnt/anime-seg ISNet (≈170 MB) — best for illustrated characters.
 *  - general: rembg u2netp (≈4.6 MB) — small, fast, OK for simple subjects.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MODELS = {
  anime: {
    name: '二次元角色（ISNet anime-seg，约 170MB，效果最好）',
    file: 'isnetis.onnx',
    size: 1024,
    mean: [0, 0, 0],
    std: [1, 1, 1],
    urls: [
      'https://hf-mirror.com/skytnt/anime-seg/resolve/main/isnetis.onnx',
      'https://huggingface.co/skytnt/anime-seg/resolve/main/isnetis.onnx',
    ],
  },
  general: {
    name: '通用小模型（U²-Net-p，约 4.6MB，速度快）',
    file: 'u2netp.onnx',
    size: 320,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    urls: [
      'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
      'https://hf-mirror.com/tomjackson2023/rembg/resolve/main/u2netp.onnx',
    ],
  },
};

export const modelDir = () => path.join(os.homedir(), '.fieldnotes-studio', 'models');
export const modelPath = (id) => path.join(modelDir(), MODELS[id].file);

let ort;
async function runtime() {
  if (ort !== undefined) return ort;
  try {
    ort = await import('onnxruntime-node');
  } catch {
    ort = null;
  }
  return ort;
}

export async function status() {
  const rt = await runtime();
  return {
    runtime: !!rt,
    models: Object.fromEntries(
      Object.entries(MODELS).map(([id, m]) => [id, { name: m.name, ready: fs.existsSync(modelPath(id)) }]),
    ),
  };
}

/** Download a model, trying each mirror in turn. onProgress(received, total). */
export async function download(id, onProgress) {
  const m = MODELS[id];
  if (!m) throw new Error(`未知模型：${id}`);
  fs.mkdirSync(modelDir(), { recursive: true });
  const dest = modelPath(id);
  const errors = [];
  for (const url of m.urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length') ?? 0);
      const tmp = `${dest}.part`;
      const out = fs.createWriteStream(tmp);
      let got = 0;
      for await (const chunk of res.body) {
        out.write(chunk);
        got += chunk.length;
        onProgress?.(got, total);
      }
      await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
      if (got < 100_000) throw new Error('文件过小，可能是错误页面');
      fs.renameSync(tmp, dest);
      return dest;
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  throw new Error(`模型下载失败，可手动下载后放到 ${dest}\n${errors.join('\n')}`);
}

const sessions = new Map();
async function session(id) {
  const rt = await runtime();
  if (!rt) throw new Error('未安装 onnxruntime-node：在 tools/asset-studio 目录运行 npm install 即可启用 AI 抠图');
  if (!fs.existsSync(modelPath(id))) throw new Error('模型尚未下载');
  if (!sessions.has(id)) sessions.set(id, await rt.InferenceSession.create(modelPath(id)));
  return { rt, s: sessions.get(id) };
}

/**
 * Predict an alpha mask (Uint8Array, w*h) for an RGBA image.
 * The image is letterboxed into the model's square input so its aspect ratio is kept.
 * @param {import('sharp')} sharp
 */
export async function predictAlpha(sharp, rgba, w, h, id = 'anime') {
  const m = MODELS[id];
  const { rt, s } = await session(id);
  const S = m.size;
  const scale = S / Math.max(w, h);
  const iw = Math.max(1, Math.round(w * scale));
  const ih = Math.max(1, Math.round(h * scale));
  const ox = Math.floor((S - iw) / 2);
  const oy = Math.floor((S - ih) / 2);
  const small = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width: w, height: h, channels: 4 } })
    .removeAlpha()
    .resize(iw, ih, { fit: 'fill' })
    .raw()
    .toBuffer();
  const input = new Float32Array(3 * S * S);
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const si = (y * iw + x) * 3;
      const di = (y + oy) * S + (x + ox);
      for (let c = 0; c < 3; c++) input[c * S * S + di] = (small[si + c] / 255 - m.mean[c]) / m.std[c];
    }
  }
  const feeds = { [s.inputNames[0]]: new rt.Tensor('float32', input, [1, 3, S, S]) };
  const out = await s.run(feeds);
  const pred = out[s.outputNames[0]].data;
  // Normalise: apply sigmoid if the output is logits, then min-max.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < S * S; i++) { if (pred[i] < lo) lo = pred[i]; if (pred[i] > hi) hi = pred[i]; }
  const logits = lo < -0.01 || hi > 1.01;
  const norm = new Uint8Array(iw * ih);
  const f = (v) => (logits ? 1 / (1 + Math.exp(-v)) : v);
  const flo = f(lo), fhi = f(hi), span = Math.max(1e-6, fhi - flo);
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) norm[y * iw + x] = Math.round(((f(pred[(y + oy) * S + (x + ox)]) - flo) / span) * 255);
  }
  return new Uint8Array(await sharp(Buffer.from(norm), { raw: { width: iw, height: ih, channels: 1 } }).resize(w, h, { fit: 'fill', kernel: 'cubic' }).extractChannel(0).raw().toBuffer());
}
