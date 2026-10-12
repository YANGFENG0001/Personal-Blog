/**
 * Scene-specific canvas effects drawn above the static scene layers.
 * Each effect is light (≤ 60 particles, DPR ≤ 1.5), pauses on hidden tabs,
 * draws only the region that matters, and renders one still frame when
 * motion is off.
 */

type Ctx = CanvasRenderingContext2D;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

interface Effect {
  init(w: number, h: number): void;
  draw(ctx: Ctx, w: number, h: number, t: number, dark: boolean): void;
}

/** Ocean: sun (or moon) glitter on the water, a soft light path, sparkles that twinkle. */
function glints(n: number): Effect {
  let g: { x: number; y: number; ph: number; s: number }[] = [];
  return {
    init(w, h) {
      const top = h * 0.78;
      g = Array.from({ length: n }, () => {
        const y = rnd(top, h * 0.97);
        const spread = 0.04 + ((y - top) / (h - top)) * 0.12; // the light path widens towards the viewer
        return { x: w * (0.82 + rnd(-spread, spread) * 0.6), y, ph: rnd(0, 6.28), s: rnd(0.6, 1.6) };
      });
    },
    draw(ctx, w, h, t, dark) {
      // A soft, feathered column of light on the water under the sun/moon.
      const top = h * 0.76;
      ctx.save();
      ctx.translate(w * 0.82, top);
      ctx.scale(w * 0.09, h - top);
      const path = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      path.addColorStop(0, dark ? 'rgba(255,244,204,0.22)' : 'rgba(255,255,240,0.45)');
      path.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = path;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI);
      ctx.fill();
      ctx.restore();
      for (const p of g) {
        const a = Math.max(0, Math.sin(t / 22 + p.ph)) ** 3;
        if (a < 0.05) continue;
        ctx.globalAlpha = a * (dark ? 0.8 : 0.95);
        ctx.fillStyle = dark ? '#fff6d0' : '#ffffff';
        const len = 6 * p.s;
        ctx.fillRect(p.x - len, p.y, len * 2, 1.2);
        ctx.fillRect(p.x - 0.6, p.y - len * 0.4, 1.2, len * 0.8);
      }
      ctx.globalAlpha = 1;
    },
  };
}

/** Forest: drifting dust motes in light by day; fireflies at night. */
function motes(n: number): Effect {
  let m: { x: number; y: number; vx: number; vy: number; r: number; ph: number }[] = [];
  return {
    init(w, h) {
      m = Array.from({ length: n }, () => ({ x: rnd(0, w), y: rnd(h * 0.15, h * 0.95), vx: rnd(-0.15, 0.15), vy: rnd(-0.12, 0.05), r: rnd(1, 2.4), ph: rnd(0, 6.28) }));
    },
    draw(ctx, w, h, t, dark) {
      for (const p of m) {
        p.x += p.vx + Math.sin(t / 90 + p.ph) * 0.15;
        p.y += p.vy + Math.cos(t / 110 + p.ph) * 0.1;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < h * 0.1) p.y = h * 0.95;
        if (p.y > h) p.y = h * 0.2;
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t / 50 + p.ph));
        const rr = dark ? p.r * 4.5 : p.r * 2.4;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        grad.addColorStop(0, dark ? `rgba(214,245,128,${0.9 * pulse})` : `rgba(255,252,220,${0.75 * pulse})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

/** Meadow: dandelion seeds floating on the wind. */
function seeds(n: number): Effect {
  let s: { x: number; y: number; vx: number; vy: number; r: number; ph: number; rot: number }[] = [];
  const spawn = (w: number, h: number, anywhere: boolean) => ({ x: anywhere ? rnd(0, w) : -20, y: rnd(h * 0.2, h * 0.8), vx: rnd(0.25, 0.7), vy: rnd(-0.18, 0.05), r: rnd(3, 5.5), ph: rnd(0, 6.28), rot: rnd(0, 6.28) });
  return {
    init(w, h) {
      s = Array.from({ length: n }, () => spawn(w, h, true));
    },
    draw(ctx, w, h, t, dark) {
      ctx.strokeStyle = dark ? 'rgba(230,236,255,0.6)' : 'rgba(255,255,255,0.9)';
      ctx.fillStyle = dark ? 'rgba(230,236,255,0.7)' : 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < s.length; i++) {
        const p = s[i]!;
        p.x += p.vx;
        p.y += p.vy + Math.sin(t / 60 + p.ph) * 0.25;
        p.rot += 0.004;
        if (p.x > w + 30 || p.y < -30) s[i] = spawn(w, h, false);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, p.r * 1.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, p.r * 1.9, 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}

/** Night sky: twinkling stars (denser near the milky way) and an occasional meteor. */
function nightsky(n: number): Effect {
  let stars: { x: number; y: number; r: number; ph: number; sp: number }[] = [];
  let meteor: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  return {
    init(w, h) {
      stars = Array.from({ length: n }, () => {
        const band = Math.random() < 0.45;
        const x = rnd(0, w);
        const y = band ? h * 0.18 + (w - x) * 0.32 * (h / w) + rnd(-h * 0.08, h * 0.08) : rnd(0, h * 0.62);
        return { x, y, r: rnd(0.4, band ? 1.1 : 1.7), ph: rnd(0, 6.28), sp: rnd(30, 90) };
      });
    },
    draw(ctx, w, h, t, dark) {
      for (const s of stars) {
        ctx.globalAlpha = (dark ? 0.95 : 0.75) * (0.35 + 0.65 * Math.abs(Math.sin(t / s.sp + s.ph)));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!meteor && Math.random() < 0.004) meteor = { x: rnd(w * 0.3, w), y: rnd(0, h * 0.25), vx: -rnd(7, 10), vy: rnd(3, 4.5), life: 1 };
      if (meteor) {
        const g = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 12, meteor.y - meteor.vy * 12);
        g.addColorStop(0, `rgba(255,255,255,${meteor.life})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(meteor.x - meteor.vx * 12, meteor.y - meteor.vy * 12);
        ctx.stroke();
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= 0.012;
        if (meteor.life <= 0 || meteor.x < -100) meteor = null;
      }
    },
  };
}

/** Summer: sakura-like petals in daylight; distant fireworks over the sea at night. */
function summer(n: number): Effect {
  let petals: { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number; c: string }[] = [];
  let sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  const cols = ['#ffd1e0', '#ffc2d6', '#fff0f5', '#ffe6a8'];
  const spawn = (w: number, h: number, any: boolean) => ({ x: rnd(-40, w), y: any ? rnd(0, h) : -20, vx: rnd(0.2, 0.7), vy: rnd(0.35, 0.9), r: rnd(3.5, 6.5), a: rnd(0, 6.28), va: rnd(-0.03, 0.03), c: cols[Math.floor(Math.random() * cols.length)]! });
  return {
    init(w, h) {
      petals = Array.from({ length: Math.round(n * 0.6) }, () => spawn(w, h, true));
    },
    draw(ctx, w, h, t, dark) {
      if (dark) {
        if (Math.random() < 0.012 && sparks.length < 260) {
          const cx = rnd(w * 0.2, w * 0.8);
          const cy = rnd(h * 0.18, h * 0.42);
          const c = ['#ffd27a', '#ff9ec7', '#9ed8ff', '#c9a8ff'][Math.floor(Math.random() * 4)]!;
          for (let i = 0; i < 46; i++) {
            const a = (i / 46) * Math.PI * 2;
            const sp = rnd(1.2, 2.2);
            sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c });
          }
        }
        for (const s of sparks) {
          s.x += s.vx;
          s.y += s.vy;
          s.vy += 0.02;
          s.vx *= 0.985;
          s.life -= 0.012;
          ctx.globalAlpha = Math.max(0, s.life);
          ctx.fillStyle = s.c;
          ctx.fillRect(s.x, s.y, 1.8, 1.8);
        }
        sparks = sparks.filter((s) => s.life > 0);
        ctx.globalAlpha = 1;
        return;
      }
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i]!;
        p.x += p.vx + Math.sin(t / 50 + i) * 0.3;
        p.y += p.vy;
        p.a += p.va;
        if (p.y > h + 20) petals[i] = spawn(w, h, false);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.6, 0, p.r);
        ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.6, -p.r * 0.9, -p.r * 0.6, 0, -p.r);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * Sakura: notched cherry petals that tumble in 3D (a flip is faked by scaling
 * one axis with a sine), drifting on a slow gust. Petals in the foreground are
 * larger, faster and slightly blurred for depth. Same at night, a bit dimmer.
 */
function petals(n: number): Effect {
  type P = { x: number; y: number; z: number; vx: number; vy: number; rot: number; vr: number; flip: number; vf: number; c: string };
  let ps: P[] = [];
  const cols = ['#ffd6e4', '#ffc4d8', '#ffe7ef', '#f9b3cb'];
  const spawn = (w: number, h: number, any: boolean): P => {
    const z = Math.random() ** 1.6; // most petals are far away
    return {
      x: rnd(-60, w), y: any ? rnd(-20, h) : rnd(-60, -10), z,
      vx: rnd(0.5, 1.2) * (0.5 + z), vy: rnd(0.4, 0.8) * (0.5 + z),
      rot: rnd(0, 6.28), vr: rnd(-0.02, 0.02), flip: rnd(0, 6.28), vf: rnd(0.02, 0.05), c: cols[Math.floor(Math.random() * cols.length)]!,
    };
  };
  return {
    init(w, h) {
      ps = Array.from({ length: n }, () => spawn(w, h, true));
    },
    draw(ctx, w, h, t, dark) {
      const gust = 0.6 + Math.sin(t / 260) * 0.5 + Math.max(0, Math.sin(t / 97)) ** 6 * 1.6;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]!;
        p.x += p.vx * gust + Math.sin(t / 60 + i) * 0.25;
        p.y += p.vy + Math.cos(t / 80 + i) * 0.12;
        p.rot += p.vr;
        p.flip += p.vf;
        if (p.y > h + 30 || p.x > w + 60) ps[i] = spawn(w, h, false);
        const s = 4 + p.z * 9;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.flip))));
        ctx.globalAlpha = (dark ? 0.6 : 0.9) * (0.55 + p.z * 0.45);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        // a petal with the characteristic notch at the tip
        ctx.moveTo(0, s);
        ctx.bezierCurveTo(-s * 0.95, s * 0.3, -s * 0.7, -s * 0.85, -s * 0.18, -s);
        ctx.lineTo(0, -s * 0.72);
        ctx.lineTo(s * 0.18, -s);
        ctx.bezierCurveTo(s * 0.7, -s * 0.85, s * 0.95, s * 0.3, 0, s);
        ctx.fill();
        ctx.globalAlpha *= 0.5;
        ctx.fillStyle = '#ff9fbf';
        ctx.beginPath();
        ctx.ellipse(0, s * 0.55, s * 0.22, s * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * Rain: thin slanted streaks in three depth layers, with small splash rings on
 * the ground line. It is a sunshower — the light rain keeps falling through the
 * sunbeam. At night drops pick up neon tints from the city.
 */
function rain(n: number): Effect {
  type D = { x: number; y: number; z: number; len: number; v: number };
  type S = { x: number; y: number; life: number };
  let ds: D[] = [];
  let ss: S[] = [];
  const slant = 0.22;
  const spawn = (w: number, h: number, any: boolean): D => {
    const z = Math.random();
    return { x: rnd(-w * 0.2, w), y: any ? rnd(-h, h) : rnd(-h * 0.3, -20), z, len: 10 + z * 22, v: 9 + z * 12 };
  };
  return {
    init(w, h) {
      ds = Array.from({ length: n }, () => spawn(w, h, true));
      ss = [];
    },
    draw(ctx, w, h, _t, dark) {
      const neon = ['#ff7fb8', '#7fe0ff', '#ffd88a'];
      ctx.lineCap = 'round';
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i]!;
        d.y += d.v;
        d.x += d.v * slant;
        const ground = h * (0.86 + d.z * 0.12);
        if (d.y > ground) {
          if (d.z > 0.5 && ss.length < 40) ss.push({ x: d.x, y: ground, life: 1 });
          ds[i] = spawn(w, h, false);
          continue;
        }
        ctx.globalAlpha = (dark ? 0.5 : 0.42) * (0.35 + d.z * 0.65);
        ctx.strokeStyle = dark && i % 7 === 0 ? neon[i % 3]! : dark ? '#c8d4f0' : '#ffffff';
        ctx.lineWidth = 0.7 + d.z * 0.9;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * slant, d.y - d.len);
        ctx.stroke();
      }
      ctx.strokeStyle = dark ? '#c8d4f0' : '#ffffff';
      ctx.lineWidth = 1;
      for (const s of ss) {
        s.life -= 0.06;
        ctx.globalAlpha = Math.max(0, s.life) * 0.5;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, (1 - s.life) * 9 + 1, (1 - s.life) * 2.4 + 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ss = ss.filter((s) => s.life > 0);
      ctx.globalAlpha = 1;
    },
  };
}

const FACTORY: Record<string, (n: number) => Effect> = { glints, motes, seeds, nightsky, summer, petals, rain };
const COUNT: Record<string, number> = { glints: 60, motes: 34, seeds: 18, nightsky: 140, summer: 40, petals: 46, rain: 110 };

export function isSceneEffect(effect: string): boolean {
  return effect in FACTORY;
}

export function startSceneEffect(effect: string, opts: { intensity: 'low' | 'medium' | 'high'; animate: boolean; canvas?: HTMLCanvasElement }) {
  const own = !opts.canvas;
  const canvas = opts.canvas ?? document.createElement('canvas');
  if (own) {
    canvas.className = 'bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const mult = { low: 0.5, medium: 1, high: 1.5 }[opts.intensity];
  const fx = FACTORY[effect]!(Math.round((COUNT[effect] ?? 40) * mult * (own ? 1 : 0.6)));
  let w = 0;
  let h = 0;
  let raf = 0;
  let t = 0;
  const resize = () => {
    const r = own ? { width: innerWidth, height: innerHeight } : canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.init(w, h);
  };
  const frame = () => {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    fx.draw(ctx, w, h, t, isDark());
    if (opts.animate && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const onResize = () => { resize(); if (!opts.animate) frame(); };
  const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && opts.animate) raf = requestAnimationFrame(frame); };
  resize();
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  frame();
  return {
    stop() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      if (own) canvas.remove();
    },
  };
}
