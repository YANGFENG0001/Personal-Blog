/**
 * Easter-egg particle effects, one "set" per theme. Everything renders into
 * a single fixed, pointer-transparent layer via the Web Animations API, and
 * every particle removes itself when done.
 */
import type { EggSet } from '../themes';

const GLYPH: Record<EggSet, string[]> = {
  ink: ['●', '•', '◦'],
  nature: ['🍃', '🍂', '🌿', '🍁'],
  ocean: ['○', '◯', '∘'],
  anime: ['🌸', '✦', '✧', '★', '♡'],
  starry: ['✦', '✧', '⋆', '✩'],
  paper: ['▪', '▫', '◆'],
  minimal: ['■', '▲', '●'],
  eyecare: ['✺', '•', '∗'],
  summer: ['✦', '❀', '☆', '✿', '♪'],
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

function layer(): HTMLElement {
  let l = document.querySelector<HTMLElement>('.fx-layer');
  if (!l) {
    l = document.createElement('div');
    l.className = 'fx-layer';
    l.setAttribute('aria-hidden', 'true');
    document.body.append(l);
  }
  return l;
}

function particle(text: string, color: string, size: number): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'fx-p';
  s.textContent = text;
  s.style.color = color;
  s.style.fontSize = `${size}px`;
  s.style.lineHeight = '1';
  layer().append(s);
  return s;
}

function inkBloom(x: number, y: number, color: string) {
  const b = document.createElement('span');
  b.className = 'fx-p';
  Object.assign(b.style, { width: '20px', height: '20px', borderRadius: '50%', background: color, filter: 'blur(2px)' });
  layer().append(b);
  b.animate(
    [{ transform: `translate(${x - 10}px, ${y - 10}px) scale(0.2)`, opacity: 0.5 }, { transform: `translate(${x - 10}px, ${y - 10}px) scale(9)`, opacity: 0 }],
    { duration: 1100, easing: 'cubic-bezier(.1,.7,.3,1)' },
  ).onfinish = () => b.remove();
}

/** Radial burst from a point. */
export function burst(set: EggSet, x: number, y: number, colors: string[], n = 16): void {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rnd(-0.2, 0.2);
    const dist = rnd(50, 120);
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    const rot = rnd(-180, 180);
    const p = particle(pick(GLYPH[set]), pick(colors), rnd(10, 20));
    p.animate(
      [
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.4)`, opacity: 1 },
        { transform: `translate(${x + dx * 0.8}px, ${y + dy * 0.8}px) translate(-50%, -50%) scale(1.1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x + dx}px, ${y + dy + 40}px) translate(-50%, -50%) scale(0.7) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: rnd(800, 1200), easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).onfinish = () => p.remove();
  }
  if (set === 'ink') inkBloom(x, y, colors[0] ?? '#315b50');
}

/** Full-screen rain (or rising bubbles / meteors) of the set's glyphs. */
export function rain(set: EggSet, colors: string[], ms = 3000): void {
  const end = performance.now() + ms;
  const up = set === 'ocean' || set === 'eyecare';
  const meteors = set === 'starry';
  const spawn = () => {
    if (performance.now() > end) return;
    const p = particle(meteors ? '✦' : pick(GLYPH[set]), pick(colors), rnd(12, 26));
    if (meteors) {
      const sx = rnd(innerWidth * 0.2, innerWidth * 1.1);
      p.style.textShadow = `0 0 8px ${pick(colors)}`;
      p.animate(
        [{ transform: `translate(${sx}px, -30px)`, opacity: 0 }, { opacity: 1, offset: 0.1 }, { transform: `translate(${sx - innerHeight * 0.7}px, ${innerHeight * 0.7}px)`, opacity: 0 }],
        { duration: rnd(900, 1500), easing: 'cubic-bezier(.3,.1,.6,1)' },
      ).onfinish = () => p.remove();
    } else {
      const x = rnd(0, innerWidth);
      const y0 = up ? innerHeight + 30 : -30;
      const y1 = up ? -40 : innerHeight + 40;
      const sway = rnd(-80, 80);
      p.animate(
        [
          { transform: `translate(${x}px, ${y0}px)`, opacity: 0 },
          { opacity: 1, offset: 0.1 },
          { transform: `translate(${x + sway}px, ${(y0 + y1) / 2}px) rotate(${rnd(-180, 180)}deg)`, offset: 0.5 },
          { transform: `translate(${x - sway / 2}px, ${y1}px) rotate(${rnd(-360, 360)}deg)`, opacity: 0.2 },
        ],
        { duration: rnd(2200, 3600), easing: 'linear' },
      ).onfinish = () => p.remove();
    }
    setTimeout(spawn, meteors ? 140 : 45);
  };
  spawn();
}

/** A small firework rising from the bottom. */
export function firework(set: EggSet, colors: string[]): void {
  const x = innerWidth * rnd(0.3, 0.7);
  const y = innerHeight * rnd(0.25, 0.4);
  const rocket = particle('•', pick(colors), 16);
  rocket.animate([{ transform: `translate(${x}px, ${innerHeight}px)` }, { transform: `translate(${x}px, ${y}px)` }], {
    duration: 650,
    easing: 'cubic-bezier(.2,.6,.4,1)',
  }).onfinish = () => {
    rocket.remove();
    burst(set, x, y, colors, 22);
  };
}

/** Pill-shaped note at the top of the page. */
export function note(text: string, ms = 4200): void {
  document.querySelector('.egg-note')?.remove();
  const n = document.createElement('div');
  n.className = 'egg-note';
  n.setAttribute('role', 'status');
  n.textContent = text;
  document.body.append(n);
  setTimeout(() => n.classList.add('out'), ms);
  setTimeout(() => n.remove(), ms + 400);
}
