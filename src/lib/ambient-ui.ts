/** Encouragement card (browser only). Styles live in styles/themes.css. */

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
  card.append(el('div', 'enc-src', `${q.author}${q.source ? ` · ${q.source}` : ''}`), el('blockquote', 'enc-quote', q.text));
  if (q.followUp) card.append(el('p', 'enc-follow', q.followUp));
  const close = el('button', 'icon-btn enc-close');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭');
  close.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const bar = el('span', 'enc-bar');
  bar.style.animationDuration = `${durationSeconds}s`;
  card.append(close, bar);

  let timer = 0;
  const dismiss = () => {
    window.clearTimeout(timer);
    card.classList.add('leaving');
    setTimeout(() => card.remove(), 420);
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
