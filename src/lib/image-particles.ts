/**
 * Particles drawn from images uploaded with a custom theme (petals, leaves,
 * snowflakes…). Same budget as the built-in effects: ≤ 80 sprites, DPR ≤ 1.5,
 * paused on hidden tabs, one still frame when motion is off.
 */
export interface ImageParticles {
  images: string[];
  motion: 'fall' | 'rise' | 'drift' | 'twinkle';
  count: number;
  speed: number;
  size: number;
  darkOnly: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function startImageParticles(cfg: ImageParticles, animate: boolean): { stop(): void } {
  const dark = () => {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const canvas = document.createElement('canvas');
  canvas.className = 'bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const imgs = cfg.images.map((src) => Object.assign(new Image(), { src, decoding: 'async' }));
  let w = 0, h = 0, raf = 0;
  type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; img: number; ph: number; flip: number };
  let ps: P[] = [];
  const spawn = (any: boolean): P => {
    const s = cfg.size * rnd(0.6, 1.2);
    const v = cfg.speed;
    const base = { x: rnd(0, w), y: rnd(0, h), r: rnd(0, 6.28), vr: rnd(-0.015, 0.015) * v, s, img: Math.floor(Math.random() * imgs.length), ph: rnd(0, 6.28), flip: rnd(0, 6.28) };
    if (cfg.motion === 'fall') return { ...base, y: any ? base.y : -s, vx: rnd(-0.3, 0.6) * v, vy: rnd(0.4, 1.1) * v };
    if (cfg.motion === 'rise') return { ...base, y: any ? base.y : h + s, vx: rnd(-0.3, 0.3) * v, vy: -rnd(0.3, 0.9) * v };
    if (cfg.motion === 'drift') return { ...base, x: any ? base.x : -s, vx: rnd(0.3, 0.9) * v, vy: rnd(-0.15, 0.15) * v };
    return { ...base, vx: 0, vy: 0 };
  };
  const resize = () => {
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ps = Array.from({ length: Math.min(80, cfg.count) }, () => spawn(true));
  };
  let t = 0;
  const frame = () => {
    t++;
    ctx.clearRect(0, 0, w, h);
    if (!cfg.darkOnly || dark()) {
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]!;
        p.x += p.vx + (cfg.motion === 'fall' ? Math.sin(t / 60 + p.ph) * 0.3 : 0);
        p.y += p.vy;
        p.r += p.vr;
        p.flip += 0.03;
        if (p.y > h + p.s * 2 || p.y < -p.s * 2 || p.x > w + p.s * 2) ps[i] = spawn(false);
        const img = imgs[p.img];
        if (!img?.complete || !img.naturalWidth) continue;
        const a = cfg.motion === 'twinkle' ? 0.25 + 0.75 * Math.abs(Math.sin(t / 50 + p.ph)) : 0.9;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        if (cfg.motion === 'fall') ctx.scale(1, Math.max(0.2, Math.abs(Math.cos(p.flip))));
        const ratio = img.naturalHeight / img.naturalWidth;
        ctx.drawImage(img, -p.s / 2, (-p.s * ratio) / 2, p.s, p.s * ratio);
        ctx.restore();
      }
    }
    if (animate && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && animate) raf = requestAnimationFrame(frame); };
  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  // first frame after the images load, so a still page (motion off) still shows them
  Promise.all(imgs.map((i) => i.decode().catch(() => undefined))).then(() => { if (!animate) frame(); });
  if (animate) raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      canvas.remove();
    },
  };
}
