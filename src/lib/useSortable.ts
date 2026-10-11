import { useRef } from 'preact/hooks';

/**
 * Pointer-based drag-to-reorder for any list (vertical or grid).
 * Items need `data-sort-id`; the drag handle needs `data-sort-handle`.
 * Keyboard: focus the handle, Alt+Arrow keys move the item.
 */
export function useSortable(ids: string[], onReorder: (ids: string[]) => void, opts: { axis?: 'y' | 'xy' } = {}) {
  const ref = useRef<HTMLElement>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const items = () => [...(ref.current?.querySelectorAll<HTMLElement>(':scope > [data-sort-id]') ?? [])];

  function flip(before: Map<string, DOMRect>) {
    for (const el of items()) {
      const prev = before.get(el.dataset.sortId!);
      if (!prev) continue;
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (!dx && !dy) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }

  function onPointerDown(e: PointerEvent) {
    const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
    if (!handle || !ref.current?.contains(handle) || e.button !== 0) return;
    const dragged = handle.closest<HTMLElement>('[data-sort-id]');
    if (!dragged || dragged.parentElement !== ref.current) return;
    e.preventDefault();
    const list = ref.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = dragged.getBoundingClientRect();
    const ghost = dragged.cloneNode(true) as HTMLElement;
    ghost.classList.add('sort-ghost');
    Object.assign(ghost.style, {
      position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
      pointerEvents: 'none', zIndex: '500', margin: '0',
    });
    document.body.append(ghost);
    dragged.classList.add('sort-placeholder');
    let order = idsRef.current.slice();

    const move = (ev: PointerEvent) => {
      ghost.style.transform = `translate(${ev.clientX - startX}px, ${ev.clientY - startY}px) rotate(${opts.axis === 'xy' ? 1.2 : 0.4}deg)`;
      let target: HTMLElement | null = null;
      let after = false;
      for (const o of items()) {
        if (o === dragged) continue;
        const r = o.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          target = o;
          after = opts.axis === 'xy' ? ev.clientX > r.left + r.width / 2 : ev.clientY > r.top + r.height / 2;
          break;
        }
      }
      if (!target) return;
      const before = new Map(items().map((x) => [x.dataset.sortId!, x.getBoundingClientRect()]));
      list.insertBefore(dragged, after ? target.nextSibling : target);
      flip(before);
      order = items().map((x) => x.dataset.sortId!);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      const r = dragged.getBoundingClientRect();
      ghost.animate([{ transform: ghost.style.transform || 'none' }, { transform: `translate(${r.left - rect.left}px, ${r.top - rect.top}px)` }], {
        duration: 160, easing: 'ease-out',
      }).onfinish = () => ghost.remove();
      dragged.classList.remove('sort-placeholder');
      if (order.join() !== idsRef.current.join()) onReorder(order);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  function onKeyDown(e: KeyboardEvent) {
    const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
    if (!handle || !e.altKey) return;
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    if (!back && !fwd) return;
    const id = handle.closest<HTMLElement>('[data-sort-id]')?.dataset.sortId;
    const cur = idsRef.current;
    const i = cur.indexOf(id ?? '');
    const j = i + (fwd ? 1 : -1);
    if (i < 0 || j < 0 || j >= cur.length) return;
    e.preventDefault();
    e.stopPropagation();
    const next = cur.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    onReorder(next);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-sort-id="${id}"] [data-sort-handle]`)?.focus());
  }

  return { ref, onPointerDown, onKeyDown };
}

/** Reorder a list of objects to match an id order. */
export function byIds<T extends { id: string }>(list: T[], ids: string[]): T[] {
  const m = new Map(list.map((x) => [x.id, x]));
  return ids.map((id) => m.get(id)).filter((x): x is T => !!x);
}
