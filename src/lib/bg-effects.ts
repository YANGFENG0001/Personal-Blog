/**
 * Animated page backgrounds on a single canvas behind the content.
 * Particle count scales with viewport and intensity, DPR is capped, the loop
 * pauses on hidden tabs, and with motion off a single still frame is drawn.
 * Also used for the small live previews on the appearance page (`canvas` option).
 */

type Intensity = 'low' | 'medium' | 'high';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  va: number;
  c: string;
  life: number;
}

const COLORS: Record<string, string[]> = {
  particles: ['#9fb8ad', '#c9d6cf', '#7a9b8f'],
  sakura: ['#ffc6dc', '#f7a8c8', '#ffe0ec', '#f29ac0'],
  leaves: ['#c2703d', '#b5893c', '#8fae5a', '#d49a4a'],
  bubbles: ['#7cc4dd', '#a8dcec', '#3d9bb8'],
  stars: ['#ffffff', '#ffe9a8', '#cfd6ff'],
  waves: ['#7cc4dd'],
  fireflies: ['#e6f59a', '#fff7b0', '#c8ea7a'],
  snow: ['#ffffff', '#eef4ff'],
};

function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export interface BgHandle {
  stop(): void;
}

export function startBackground(effect: string, opts: { intensity: Intensity; animate: boolean; canvas?: HTMLCanvasElement }): BgHandle {
  const own = !opts.canvas;
  const canvas = opts.canvas ?? document.createElement('canvas');
  if (own) {
    canvas.className = 'bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const palette = COLORS[effect] ?? COLORS.particles!;
  const mult = { low: 0.5, medium: 1, high: 1.6 }[opts.intensity];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  let w = 0;
  let h = 0;
  let parts: P[] = [];
  let raf = 0;
  let t = 0;

  function spawn(anywhere: boolean): P {
    const p: P = { x: rnd(0, w), y: anywhere ? rnd(0, h) : -20, vx: 0, vy: 0, r: 2, a: rnd(0, Math.PI * 2), va: rnd(-0.02, 0.02), c: palette[Math.floor(Math.random() * palette.length)]!, life: rnd(0, 1) };
    switch (effect) {
      case 'sakura': p.r = rnd(4, 8); p.vy = rnd(0.35, 0.9); p.vx = rnd(0.1, 0.5); break;
      case 'leaves': p.r = rnd(5, 9); p.vy = rnd(0.4, 1); p.vx = rnd(-0.3, 0.3); break;
      case 'bubbles': p.r = rnd(3, 11); p.vy = -rnd(0.25, 0.8); if (!anywhere) p.y = h + 20; break;
      case 'stars': p.r = rnd(0.5, 1.8); break;
      case 'fireflies': p.r = rnd(1.5, 3); p.vx = rnd(-0.25, 0.25); p.vy = rnd(-0.25, 0.25); break;
      case 'snow': p.r = rnd(1.2, 3.2); p.vy = rnd(0.3, 1); p.vx = rnd(-0.2, 0.2); break;
      default: p.r = rnd(1, 2.6); p.vx = rnd(-0.2, 0.2); p.vy = rnd(-0.2, 0.2);
    }
    return p;
  }

  function resize() {
    const rect = own ? { width: innerWidth, height: innerHeight } : canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = effect === 'stars' ? 90 : effect === 'waves' ? 0 : effect === 'snow' ? 70 : 40;
    const n = Math.round(Math.min(base * mult, (w * h) / 9000) * (own ? 1 : 0.7));
    parts = Array.from({ length: n }, () => spawn(true));
  }

  function shape(p: P) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    if (effect === 'sakura') {
      ctx.moveTo(0, -p.r);
      ctx.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.6, 0, p.r);
      ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.6, -p.r * 0.9, -p.r * 0.6, 0, -p.r);
      ctx.fill();
    } else {
      ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.15)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-p.r, 0);
      ctx.lineTo(p.r, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame() {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    const dark = isDark();
    const alpha = dark ? 0.75 : 0.5;

    if (effect === 'waves') {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.78 + k * 0.06) + Math.sin(x / (180 + k * 60) + t / (90 - k * 15)) * (14 + k * 6));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = `rgba(124,196,221,${(dark ? 0.1 : 0.08) + k * 0.03})`;
        ctx.fill();
      }
    }

    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      p.life += 0.01;
      if (effect === 'sakura' || effect === 'leaves' || effect === 'snow') p.x += Math.sin(t / 60 + p.life * 6) * 0.35;
      if (effect === 'fireflies' || effect === 'particles') {
        p.vx = Math.max(-0.4, Math.min(0.4, p.vx + rnd(-0.02, 0.02)));
        p.vy = Math.max(-0.4, Math.min(0.4, p.vy + rnd(-0.02, 0.02)));
      }
      if (p.y > h + 30 || p.y < -40 || p.x < -40 || p.x > w + 40) {
        Object.assign(p, spawn(false));
        if (effect === 'fireflies' || effect === 'particles') Object.assign(p, { x: rnd(0, w), y: rnd(0, h) });
      }

      ctx.globalAlpha = alpha;
      if (effect === 'sakura' || effect === 'leaves') shape(p);
      else if (effect === 'bubbles') {
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect === 'stars') {
        ctx.globalAlpha = (dark ? 0.9 : 0.45) * (0.4 + 0.6 * Math.abs(Math.sin(p.life * 2 + p.a)));
        ctx.fillStyle = dark ? p.c : '#4450a8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect === 'fireflies') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, p.c);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(p.life * 1.5 + p.a))) * (dark ? 0.9 : 0.6);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = effect === 'snow' && !dark ? '#c3d2e4' : p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (opts.animate && !document.hidden) raf = requestAnimationFrame(frame);
  }

  resize();
  const onResize = () => {
    resize();
    if (!opts.animate) frame();
  };
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && opts.animate) raf = requestAnimationFrame(frame);
  };
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  frame();

  return {
    stop() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      if (own) canvas.remove();
      else ctx.clearRect(0, 0, w, h);
    },
  };
}
