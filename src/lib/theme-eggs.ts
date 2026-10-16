/**
 * Easter-egg theme switches. The owner lists triggers → themes; when a
 * visitor triggers one, a short-lived cookie asks the server to render that
 * theme (only themes on the owner's list are honoured server-side), and the
 * page reloads. A small chip lets the visitor go back.
 */
interface Rule {
  trigger: 'konami' | 'logo-7' | 'typed-word' | 'idle-night' | 'read-3';
  word?: string;
  theme: string;
  minutes: number;
}

const COOKIE = 'fn_egg_theme';

function apply(rule: Rule): void {
  const age = rule.minutes > 0 ? `; max-age=${rule.minutes * 60}` : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(rule.theme)}; path=/; samesite=lax${age}`;
  document.documentElement.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(() => location.reload());
}

function clear(): void {
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
  location.reload();
}

export function startThemeEggs(): void {
  const el = document.getElementById('fn-theme-eggs');
  if (!el) return;
  const { rules, active } = JSON.parse(el.textContent || '{}') as { rules: Rule[]; active: string | null };

  if (active) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'egg-theme-chip';
    chip.textContent = '✦ 你发现了隐藏主题 · 点此恢复';
    chip.addEventListener('click', clear);
    document.body.append(chip);
  }
  const fire = (t: Rule['trigger'], match?: (r: Rule) => boolean) => {
    const r = rules.find((x) => x.trigger === t && x.theme !== active && (!match || match(x)));
    if (r) apply(r);
  };

  // Konami code and typed words
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let k = 0;
  let typed = '';
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
    k = e.key === konami[k] ? k + 1 : e.key === konami[0] ? 1 : 0;
    if (k === konami.length) { k = 0; fire('konami'); }
    if (e.key.length === 1) {
      typed = (typed + e.key.toLowerCase()).slice(-20);
      fire('typed-word', (r) => !!r.word && typed.endsWith(r.word.toLowerCase()));
    }
  });

  // Seven quick clicks on the brand mark
  let clicks = 0;
  let timer = 0;
  document.querySelector('[data-brandmark]')?.addEventListener('click', () => {
    clicks++;
    clearTimeout(timer);
    timer = window.setTimeout(() => (clicks = 0), 1500);
    if (clicks >= 7) { clicks = 0; fire('logo-7'); }
  });

  // Late at night, after two idle minutes
  if (rules.some((r) => r.trigger === 'idle-night')) {
    let idle = 0;
    const reset = () => {
      clearTimeout(idle);
      const h = new Date().getHours();
      if (h >= 23 || h < 5) idle = window.setTimeout(() => fire('idle-night'), 120_000);
    };
    ['pointermove', 'keydown', 'scroll'].forEach((e) => addEventListener(e, reset, { passive: true }));
    reset();
  }

  // Third article finished in this browser
  addEventListener('fn:read-end', () => {
    const n = Number(localStorage.getItem('fn-read-count') || 0) + 1;
    localStorage.setItem('fn-read-count', String(n));
    if (n === 3) fire('read-3');
  });
}
