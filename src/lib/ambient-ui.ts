/** Small DOM helpers for encouragement cards and easter eggs (browser only). */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function showEncouragement(
  q: { text: string; author: string; source: string; followUp: string },
  durationSeconds: number,
  animation: 'rise' | 'fade' = 'rise',
): HTMLElement {
  document.querySelector('.enc-card')?.remove();
  const card = el('aside', 'enc-card');
  card.dataset.anim = animation;
  card.setAttribute('role', 'status');
  const src = el('div', 'enc-src', `${q.author}${q.source ? ` · ${q.source}` : ''}`);
  const quote = el('blockquote', 'enc-quote', q.text);
  card.append(src, quote);
  if (q.followUp) card.append(el('p', 'enc-follow', q.followUp));
  const close = el('button', 'icon-btn enc-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭');
  const bar = el('span', 'enc-bar');
  bar.style.animationDuration = `${durationSeconds}s`;
  card.append(close, bar);

  let timer = 0;
  const dismiss = () => {
    window.clearTimeout(timer);
    card.classList.add('leaving');
    card.addEventListener('animationend', () => card.remove(), { once: true });
    setTimeout(() => card.remove(), 600);
  };
  const arm = () => { timer = window.setTimeout(dismiss, durationSeconds * 1000); };
  close.addEventListener('click', dismiss);
  // Hovering pauses auto-dismiss so it can be read at leisure.
  card.addEventListener('mouseenter', () => { window.clearTimeout(timer); bar.style.animationPlayState = 'paused'; });
  card.addEventListener('mouseleave', () => { bar.style.animationPlayState = 'running'; arm(); });
  document.body.append(card);
  arm();
  return card;
}

export function sparks(x: number, y: number, n = 10): void {
  const glyphs = ['✦', '✧', '·', '✶'];
  for (let i = 0; i < n; i++) {
    const s = el('span', 'spark', glyphs[i % glyphs.length]);
    const a = (Math.PI * 2 * i) / n;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * 46}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * 46}px`);
    document.body.append(s);
    setTimeout(() => s.remove(), 1000);
  }
}

export function eggNote(text: string, ms = 4200): void {
  const n = el('div', 'egg-note', text);
  n.setAttribute('role', 'status');
  document.body.append(n);
  setTimeout(() => n.remove(), ms);
}
