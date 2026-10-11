/**
 * Easter-egg triggers. Loaded lazily (Ambient.astro) only when eggs are on.
 * Each trigger can be switched off in the workspace; with motion off the
 * visual effects degrade to a short text note.
 */
import { getPreset, type EggSet } from '../themes';
import { burst, firework, note, rain } from './effects';

export interface EggConfig {
  enabled: boolean;
  set: string;
  triggers: Record<string, boolean>;
}

export function resolveSet(set: string): EggSet {
  if (set !== 'follow-theme') return set as EggSet;
  return getPreset(document.documentElement.dataset.preset ?? 'ink').eggSet;
}

function colors(): string[] {
  const fx = (document.body.dataset.fx ?? '').split(',').filter(Boolean);
  return fx.length ? fx : [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#315b50'];
}

function animOK(): boolean {
  return document.documentElement.dataset.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Run an effect directly (also used by the workspace preview buttons). */
export function play(kind: 'burst' | 'rain' | 'firework', set: EggSet, at?: { x: number; y: number }): void {
  if (!animOK()) return note('✦');
  const c = colors();
  if (kind === 'burst') burst(set, at?.x ?? innerWidth / 2, at?.y ?? innerHeight / 3, c);
  if (kind === 'rain') rain(set, c);
  if (kind === 'firework') firework(set, c);
}

const GREETINGS = ['你好呀 👋', 'Hello，旅行者。', '嗨，欢迎来到这里。', '今天也辛苦了。'];

export const FESTIVALS: Record<string, string> = {
  '1-1': '新年快乐。愿新的一年，问题都有好答案。',
  '2-14': '情人节快乐 ♡',
  '3-14': 'π 日快乐 · 3.14159…',
  '4-1': '今天说的话，不一定都是真的。',
  '6-1': '儿童节快乐，保持好奇。',
  '10-1': '国庆快乐。',
  '12-25': '圣诞快乐 🎄',
  '12-31': '一年的最后一天，谢谢你来过。',
};

export function startEggs(cfg: EggConfig, ctx: { isArticle: boolean; is404: boolean }): void {
  if (!cfg.enabled) return;
  const t = cfg.triggers;
  const set = () => resolveSet(cfg.set);

  // 1. Triple-click the brand mark → themed burst.
  if (t.logo) {
    let clicks = 0;
    let timer = 0;
    document.querySelector('[data-brandmark]')?.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      clicks++;
      clearTimeout(timer);
      timer = window.setTimeout(() => (clicks = 0), 900);
      if (clicks >= 3) {
        clicks = 0;
        const r = el.getBoundingClientRect();
        play('burst', set(), { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } else if (clicks === 1 && animOK()) {
        el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 220 });
      }
    });
  }

  // 2. Konami code → themed rain. 3. Typing "hello" → greeting + avatar wave.
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kpos = 0;
  let typed = '';
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable) return;
    if (t.konami) {
      kpos = e.key === konami[kpos] ? kpos + 1 : e.key === konami[0] ? 1 : 0;
      if (kpos === konami.length) {
        kpos = 0;
        note('↑↑↓↓←→←→BA · 你发现了一个隐藏的角落。');
        play('rain', set());
      }
    }
    if (t.hello && e.key.length === 1) {
      typed = (typed + e.key.toLowerCase()).slice(-5);
      if (typed === 'hello') {
        typed = '';
        note(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!);
        if (animOK())
          document.querySelector('[data-avatar-btn]')?.animate(
            [{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(0)' }],
            { duration: 900, easing: 'ease-in-out' },
          );
      }
    }
  });

  // 4. Late-night visit (once per night).
  if (t.lateNight) {
    const h = new Date().getHours();
    const key = `fn-egg-night-${new Date().toDateString()}`;
    if ((h >= 23 || h < 5) && !localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      setTimeout(() => note('夜深了。读完这一段，记得早点休息 🌙', 5200), 2500);
    }
  }

  // 5. Finished reading an article → small firework.
  if (t.readEnd && ctx.isArticle) {
    const end = document.querySelector('.adjacent');
    if (end && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting) && scrollY > 400) {
          io.disconnect();
          note('读完啦，谢谢你认真看到这里。');
          play('firework', set());
        }
      }, { threshold: 0.6 });
      io.observe(end);
    }
  }

  // 6. Click the avatar 5× quickly → it flips around.
  if (t.avatar) {
    const btn = document.querySelector<HTMLElement>('[data-avatar-btn]');
    let n = 0;
    let timer = 0;
    btn?.addEventListener('click', () => {
      n++;
      clearTimeout(timer);
      timer = window.setTimeout(() => (n = 0), 900);
      if (n < 5) return;
      n = 0;
      btn.classList.add('avatar-flip');
      setTimeout(() => btn.classList.remove('avatar-flip'), 2400);
      const r = btn.getBoundingClientRect();
      play('burst', set(), { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
  }

  // 7. Festivals (once per day).
  if (t.festival) {
    const d = new Date();
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
    const msg = dayOfYear === 256 ? '程序员节快乐 · 第 256 天。' : FESTIVALS[`${d.getMonth() + 1}-${d.getDate()}`];
    const key = `fn-egg-${d.toDateString()}`;
    if (msg && !localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      setTimeout(() => {
        note(msg, 5000);
        play('rain', set());
      }, 1800);
    }
  }

  // 8. Console signature for curious developers.
  if (t.console) {
    console.log(
      `%c ${document.title.split(' · ').pop()} %c 你好，愿意打开控制台的人 ✦`,
      `background:${colors()[0]};color:#fff;padding:3px 8px;border-radius:3px;font-weight:700`,
      'padding:3px 6px',
    );
  }

  // 9. 404: click the digits to scatter and reassemble them.
  if (t.notFound && ctx.is404) {
    const code = document.querySelector<HTMLElement>('[data-nf-code]');
    code?.addEventListener('click', () => {
      if (!animOK()) return;
      code.querySelectorAll<HTMLElement>('span').forEach((s) => {
        const dx = (Math.random() - 0.5) * 300;
        const dy = (Math.random() - 0.5) * 200;
        const r = (Math.random() - 0.5) * 360;
        s.animate(
          [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) rotate(${r}deg)`, offset: 0.4 }, { transform: `translate(${dx}px, ${dy}px) rotate(${r}deg)`, offset: 0.6 }, { transform: 'none' }],
          { duration: 1600, easing: 'cubic-bezier(.5,0,.2,1)' },
        );
      });
      const r = code.getBoundingClientRect();
      burst(set(), r.left + r.width / 2, r.top + r.height / 2, colors(), 10);
    });
  }
}
