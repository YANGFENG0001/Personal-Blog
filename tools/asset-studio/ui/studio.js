// FIELDNOTES asset studio — browser side (no build step, no dependencies).
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const STATES = [
  ['idle', '默认', '必需'],
  ['talk', '说话', '点击 / 冒气泡时'],
  ['happy', '开心', '彩蛋、读完文章'],
  ['held', '被拎起', '拖动中'],
  ['sleep', '睡觉', '深夜久未操作'],
  ['blink', '闭眼', '用于眨眼'],
];
const GROUPS = [
  ['click', '点击（通用）', '今天也一起读一点吧。\n慢慢读就好。'],
  ['morning', '早上', '早上好，今天想读点什么？'],
  ['noon', '中午', ''],
  ['evening', '傍晚', ''],
  ['night', '深夜', '夜深了，记得早点休息。'],
  ['home', '首页', ''],
  ['article', '文章页', ''],
  ['notFound', '404 页', '这里好像什么都没有……'],
  ['readEnd', '读完文章', '读完啦！辛苦了。'],
  ['drag', '被拖起来', '哇——'],
  ['drop', '被放下', '放好啦。'],
  ['reset', '回到角落', '回到老位置啦。'],
];

const toast = (msg, err = false) => {
  const t = document.createElement('div');
  t.className = `toast ${err ? 'err' : ''}`;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), err ? 5000 : 2400);
};
async function api(path, opt = {}) {
  const res = await fetch(path, opt);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res;
}

/* ---------------- tabs ---------------- */
$$('.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }),
);

/* ---------------- AI status ---------------- */
async function refreshAI() {
  const { ai } = await (await api('/api/status')).json();
  const el = $('#ai-status');
  if (!ai.runtime) {
    el.innerHTML = 'AI 抠图：未安装（在本目录运行 <code>npm install</code> 启用），算法抠图可用';
    return;
  }
  el.textContent = 'AI 抠图：';
  for (const [id, m] of Object.entries(ai.models)) {
    const s = document.createElement('span');
    s.textContent = `${id === 'anime' ? '二次元' : '通用'}${m.ready ? ' ✓' : ''} `;
    el.append(s);
    if (!m.ready) {
      const b = document.createElement('button');
      b.textContent = '下载';
      b.onclick = async () => {
        b.disabled = true;
        b.textContent = '下载中…（看终端进度）';
        try { await api('/api/model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); toast('模型已就绪'); } catch (e) { toast(e.message, true); }
        refreshAI();
      };
      el.append(b);
    }
  }
}
refreshAI();

/* ---------------- mascot state slots ---------------- */
const slots = {}; // state → { id, file, w, h }
let current = null;
function renderSlots() {
  const box = $('#slots');
  box.innerHTML = '';
  for (const [key, name, note] of STATES) {
    const s = slots[key];
    const el = document.createElement('div');
    el.className = `slot ${current === key ? 'on' : ''}`;
    el.innerHTML = `<div class="thumb">${s ? `<img src="/api/image?id=${s.id}&v=result&t=${s.t}" alt="">` : ''}</div>
      <div><b>${name}</b>${key === 'idle' ? ' *' : ''}<small>${note}</small>
      <button class="pick">${s ? '替换图片' : '选择图片'}</button></div>`;
    el.addEventListener('click', (e) => {
      current = key;
      renderSlots();
      if (e.target.closest('.pick') || !s) pickFile(key);
      else show(key);
    });
    box.append(el);
  }
}
function pickFile(key) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => inp.files[0] && processFile(key, inp.files[0]);
  inp.click();
}
const params = () => {
  const p = new URLSearchParams({ mode: $('#mode').value, model: $('#model').value });
  if (+$('#tol').value > 0) p.set('tolerance', $('#tol').value);
  if ($('#use-key').checked) p.set('key', $('#key').value.slice(1));
  return p;
};
$('#tol').addEventListener('input', () => ($('#tol-out').textContent = +$('#tol').value ? $('#tol').value : '自动'));
for (const id of ['#mode', '#model', '#tol', '#use-key', '#key']) $(id).addEventListener('change', () => current && slots[current] && processFile(current, slots[current].file));

const KIND_NAMES = { transparent: '已是透明图', checker: '假棋盘格（已去除）', solid: '纯色背景（已去除）', complex: '复杂背景' };
async function processFile(key, file) {
  document.body.classList.add('busy');
  $('#stat').textContent = '处理中…';
  try {
    const r = await (await api(`/api/matte?${params()}`, { method: 'POST', body: file })).json();
    slots[key] = { id: r.id, file, w: r.width, h: r.height, t: Date.now() };
    current = key;
    renderSlots();
    await show(key);
    const kind = KIND_NAMES[r.info.kind] ?? r.info.kind;
    $('#stat').textContent = `${r.width}×${r.height} · ${kind} · ${r.method} · ${r.ms}ms`;
    $('#stat').classList.toggle('warn', !!r.warning || r.info.kind === 'complex');
    if (r.warning) toast(r.warning, true);
    else if (r.info.kind === 'complex' && r.method === 'none') toast('背景比较复杂，算法无法处理。请安装并下载 AI 模型，或改用纯色背景重新生成。', true);
  } catch (e) {
    toast(e.message, true);
    $('#stat').textContent = '';
  } finally {
    document.body.classList.remove('busy');
  }
}

/* ---------------- canvas preview + correction brush ---------------- */
const cv = $('#cv');
const ctx = cv.getContext('2d');
let imgResult = null, imgOriginal = null, edits = null, history = [];
let view = 'result', brush = 'off';
const load = (src) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; });
async function show(key) {
  const s = slots[key];
  if (!s) return;
  $('#drop').classList.add('hidden');
  $('#stage-title').textContent = `${STATES.find((x) => x[0] === key)[1]} 状态`;
  [imgResult, imgOriginal] = await Promise.all([load(`/api/image?id=${s.id}&v=result&t=${s.t}`), load(`/api/image?id=${s.id}&v=original`)]);
  cv.width = s.w;
  cv.height = s.h;
  edits = new Uint8Array(s.w * s.h);
  history = [];
  draw();
}
function draw() {
  if (!imgResult) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (view === 'original') ctx.drawImage(imgOriginal, 0, 0);
  else if (view === 'split') {
    ctx.drawImage(imgOriginal, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cv.width / 2, 0, cv.width / 2, cv.height);
    ctx.clip();
    ctx.clearRect(cv.width / 2, 0, cv.width / 2, cv.height);
    ctx.drawImage(imgResult, 0, 0);
    ctx.restore();
    ctx.fillStyle = '#2f6fb8';
    ctx.fillRect(cv.width / 2 - 1, 0, 2, cv.height);
  } else ctx.drawImage(imgResult, 0, 0);
  if (edits && view === 'result') {
    // overlay of pending edits: red = erase, green = restore
    const ov = ctx.getImageData(0, 0, cv.width, cv.height);
    for (let p = 0; p < edits.length; p++) {
      if (!edits[p]) continue;
      const i = p * 4;
      if (edits[p] === 1) { ov.data[i] = 230; ov.data[i + 1] = 60; ov.data[i + 2] = 60; ov.data[i + 3] = 150; }
      else { ov.data[i] = 60; ov.data[i + 1] = 190; ov.data[i + 2] = 90; ov.data[i + 3] = 150; }
    }
    ctx.putImageData(ov, 0, 0);
  }
}
$$('#view-seg button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; $$('#view-seg button').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
$$('#bg-seg button').forEach((b) => b.addEventListener('click', () => {
  $$('#bg-seg button').forEach((x) => x.classList.toggle('on', x === b));
  const v = b.dataset.bg;
  $('#wrap').dataset.bg = v.startsWith('#') ? '' : v;
  $('#wrap').style.background = v.startsWith('#') ? v : '';
}));
$('#wrap').dataset.bg = 'checker';
$$('#brush-seg button').forEach((b) => b.addEventListener('click', () => { brush = b.dataset.brush; $$('#brush-seg button').forEach((x) => x.classList.toggle('on', x === b)); cv.style.cursor = brush === 'off' ? '' : 'crosshair'; }));

let painting = false;
function paintAt(e) {
  const r = cv.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * cv.width;
  const y = ((e.clientY - r.top) / r.height) * cv.height;
  const rad = (+$('#bsize').value * cv.width) / r.width / 2;
  const v = brush === 'erase' ? 1 : 2;
  for (let yy = Math.max(0, Math.floor(y - rad)); yy < Math.min(cv.height, Math.ceil(y + rad)); yy++) {
    for (let xx = Math.max(0, Math.floor(x - rad)); xx < Math.min(cv.width, Math.ceil(x + rad)); xx++) {
      if ((xx - x) ** 2 + (yy - y) ** 2 <= rad * rad) edits[yy * cv.width + xx] = v;
    }
  }
  draw();
}
cv.addEventListener('pointerdown', (e) => { if (brush === 'off' || !edits) return; painting = true; history.push(edits.slice()); cv.setPointerCapture(e.pointerId); if (view !== 'result') { view = 'result'; $$('#view-seg button').forEach((x) => x.classList.toggle('on', x.dataset.view === 'result')); } paintAt(e); });
cv.addEventListener('pointermove', (e) => painting && paintAt(e));
cv.addEventListener('pointerup', () => (painting = false));
$('#undo').addEventListener('click', () => { if (history.length) { edits = history.pop(); draw(); } });
$('#apply').addEventListener('click', async () => {
  if (!current || !slots[current] || !edits?.some((v) => v)) return toast('还没有画任何修补');
  let bin = '';
  for (let i = 0; i < edits.length; i += 0x8000) bin += String.fromCharCode(...edits.subarray(i, i + 0x8000));
  try {
    await api('/api/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: slots[current].id, edits: btoa(bin) }) });
    slots[current].t = Date.now();
    renderSlots();
    await show(current);
    toast('修补已应用');
  } catch (e) { toast(e.message, true); }
});

/* drag & drop onto the stage → current (or idle) slot */
$('#wrap').addEventListener('dragover', (e) => e.preventDefault());
$('#wrap').addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f) processFile(current || 'idle', f);
});

/* ---------------- lines ---------------- */
const linesBox = $('#lines');
for (const [key, name, def] of GROUPS) {
  const l = document.createElement('label');
  l.innerHTML = `${name}<textarea data-line="${key}" rows="2"></textarea>`;
  l.querySelector('textarea').value = def;
  linesBox.append(l);
}

/* ---------------- export ---------------- */
$('#export').addEventListener('click', async () => {
  if (!slots.idle) return toast('至少需要 idle 默认状态图', true);
  const lines = {};
  for (const t of $$('[data-line]')) {
    const arr = t.value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 60)).slice(0, 40);
    if (arr.length) lines[t.dataset.line] = arr;
  }
  const manifest = {
    name: $('#m-name').value.trim() || '我的看板娘',
    author: $('#m-author').value.trim(),
    license: $('#m-license').value.trim(),
    display: { mode: $('#m-mode').value, height: +$('#m-height').value || 240, flip: $('#m-flip').checked, shadow: $('#m-shadow').checked, outline: $('#m-outline').value },
    motion: { breathe: $('#m-breathe').checked, sway: $('#m-sway').checked, swing: $('#m-swing').checked, blinkEvery: 5 },
    lines,
  };
  const states = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.id]));
  $('#export').disabled = true;
  try {
    const res = await api('/api/export/mascot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ manifest, states }) });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${manifest.name}.mascot.zip`;
    a.click();
    toast(`已导出（${(blob.size / 1024).toFixed(0)}KB），也保存在 tools/asset-studio/out/`);
  } catch (e) { toast(e.message, true); }
  $('#export').disabled = false;
});

/* ---------------- single asset tab ---------------- */
let assetId = null;
$('#a-file').addEventListener('change', async () => {
  const f = $('#a-file').files[0];
  if (!f) return;
  const kind = $('#a-kind').value;
  const mode = kind === 'background' || kind === 'cover' ? 'none' : $('#mode').value;
  try {
    const r = await (await api(`/api/matte?mode=${mode}&model=${$('#model').value}`, { method: 'POST', body: f })).json();
    assetId = r.id;
    $('#a-img').src = `/api/image?id=${r.id}&v=result&t=${Date.now()}`;
    $('#a-stat').textContent = `${r.width}×${r.height} · ${KIND_NAMES[r.info.kind] ?? r.info.kind}`;
    $('#a-pieces').innerHTML = '';
  } catch (e) { toast(e.message, true); }
});
$('#a-split').addEventListener('click', async () => {
  if (!assetId) return toast('先选择一张合集图');
  try {
    const { pieces } = await (await api('/api/split', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: assetId }) })).json();
    const box = $('#a-pieces');
    box.innerHTML = '';
    for (const p of pieces) {
      const b = document.createElement('button');
      b.innerHTML = `<img src="/api/image?id=${p.id}&v=result" alt="">`;
      b.title = `${p.width}×${p.height}，点击查看 / 导出`;
      b.onclick = () => { assetId = p.id; $('#a-img').src = `/api/image?id=${p.id}&v=result`; $('#a-stat').textContent = `${p.width}×${p.height}`; };
      box.append(b);
    }
    toast(`切分出 ${pieces.length} 个元素`);
  } catch (e) { toast(e.message, true); }
});
const exportAsset = (fmt) => {
  if (!assetId) return toast('先选择图片');
  location.href = `/api/export/image?id=${assetId}&kind=${$('#a-kind').value}&format=${fmt}`;
};
$('#a-webp').addEventListener('click', () => exportAsset('webp'));
$('#a-png').addEventListener('click', () => exportAsset('png'));

renderSlots();
