/** Soft trail that follows the pointer (fine pointers only, opt-in). */
export function startTrail(): void {
  const N = 8;
  const dots = Array.from({ length: N }, (_, i) => {
    const d = document.createElement('span');
    d.className = 'trail-dot';
    d.style.setProperty('--i', String(i));
    d.setAttribute('aria-hidden', 'true');
    document.body.append(d);
    return d;
  });
  const pos = Array.from({ length: N }, () => ({ x: -100, y: -100 }));
  let mx = -100;
  let my = -100;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  const loop = () => {
    pos[0]!.x += (mx - pos[0]!.x) * 0.45;
    pos[0]!.y += (my - pos[0]!.y) * 0.45;
    for (let i = 1; i < N; i++) {
      pos[i]!.x += (pos[i - 1]!.x - pos[i]!.x) * 0.45;
      pos[i]!.y += (pos[i - 1]!.y - pos[i]!.y) * 0.45;
    }
    dots.forEach((d, i) => (d.style.transform = `translate(${pos[i]!.x}px, ${pos[i]!.y}px)`));
    if (!document.hidden) requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(loop); });
  requestAnimationFrame(loop);
}
