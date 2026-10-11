/**
 * "Rich" motion extras: scroll reveal, 3D card tilt with sheen and button
 * ripples. Pure progressive enhancement — everything works without it.
 */
export function startRichMotion(): void {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    document.querySelectorAll<HTMLElement>('.post, .site-card, .side-block, .kcard, .year li').forEach((el, i) => {
      if (el.getBoundingClientRect().top < innerHeight) return; // already on screen
      el.classList.add('rv');
      el.style.setProperty('--rv-delay', `${(i % 6) * 40}ms`);
      io.observe(el);
    });
  }

  if (matchMedia('(pointer: fine)').matches && document.documentElement.dataset.cardMotion !== 'off') {
    document.querySelectorAll<HTMLElement>('.site-card, .posts-cards .post, .kcard').forEach((card) => {
      card.classList.add('tilt');
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(px * 6).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  document.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.btn, .ibtn, .chip, .seg-item');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    Object.assign(s.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
    btn.append(s);
    setTimeout(() => s.remove(), 600);
  });
}
