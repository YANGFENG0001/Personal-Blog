import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ICONS } from '../../lib/icons';

/* ---------------- Icon ---------------- */

export function Icon({ name, size = 16, class: cls = '' }: { name: string; size?: number; class?: string }) {
  return (
    <svg
      class={`ic ${cls}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  );
}

/* ---------------- IconButton ---------------- */

type IBProps = {
  icon: string;
  label: string;
  variant?: 'ghost' | 'subtle' | 'danger' | 'solid';
  size?: 'sm' | 'md';
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  active?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon' | 'size' | 'onClick'>;

export function IconButton({ icon, label, variant = 'ghost', size = 'md', active, class: cls, ...rest }: IBProps) {
  return (
    <button
      type="button"
      class={`ibtn ibtn-${variant} ibtn-${size} ${active ? 'is-active' : ''} ${cls ?? ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}

/* ---------------- Menu ---------------- */

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  onSelect: () => void;
  checked?: boolean;
}

export function Menu({ items, label = '更多操作' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    root.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const onKey = (e: KeyboardEvent) => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { els[(i + 1) % els.length]?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { els[(i - 1 + els.length) % els.length]?.focus(); e.preventDefault(); }
  };
  return (
    <div class="menu" ref={root}>
      <IconButton icon="more" label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} />
      {open && (
        <div class="menu-pop" role="menu" onKeyDown={onKey}>
          {items.map((it) => (
            <button
              type="button"
              role="menuitem"
              class={`menu-item ${it.danger ? 'danger' : ''}`}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.icon ? <Icon name={it.icon} size={15} /> : <span class="menu-sp" />}
              <span>{it.label}</span>
              {it.checked !== undefined && <span class={`menu-check ${it.checked ? 'on' : ''}`}><Icon name="check" size={13} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- ChipToggle ---------------- */

/** "All + multi-select" transition: null = all; deselecting the last chip returns to all. */
export function toggleChip(selected: string[] | null, id: string | null): string[] | null {
  if (id === null) return null;
  const cur = selected ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  return next.length === 0 ? null : next;
}

export function ChipToggle({
  options, value, onChange, allLabel = '全部', label,
}: {
  options: { id: string; label: string }[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  allLabel?: string;
  label: string;
}) {
  return (
    <div class="chips" role="group" aria-label={label}>
      <button type="button" class={`chip ${value === null ? 'on' : ''}`} aria-pressed={value === null} onClick={() => onChange(toggleChip(value, null))}>
        {value === null && <Icon name="check" size={12} />}
        {allLabel}
      </button>
      {options.map((o) => {
        const on = !!value?.includes(o.id);
        return (
          <button type="button" class={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(toggleChip(value, o.id))}>
            {on && <Icon name="check" size={12} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Switch ---------------- */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ComponentChildren; disabled?: boolean }) {
  return (
    <label class={`switch ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="track" />
      {label && <span>{label}</span>}
    </label>
  );
}

/* ---------------- Segmented ---------------- */

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button type="button" role="radio" aria-checked={value === v} class={`seg-item ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Inline editable text ---------------- */

export function InlineEdit({ value, onSave, label, class: cls = '', editing: ext, onDone }: {
  value: string; onSave: (v: string) => void; label: string; class?: string; editing?: boolean; onDone?: () => void;
}) {
  const [own, setOwn] = useState(false);
  const [v, setV] = useState(value);
  const on = ext || own;
  const wasOn = useRef(false);
  // Reset the draft synchronously when entering edit mode (not in an effect, so fast typing isn't overwritten).
  if (on && !wasOn.current) {
    wasOn.current = true;
    if (v !== value) setV(value);
  }
  if (!on) wasOn.current = false;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (on) ref.current?.select();
  }, [on]);
  const finish = (save: boolean) => {
    setOwn(false);
    onDone?.();
    if (save && v.trim() && v.trim() !== value) onSave(v.trim());
  };
  if (!on)
    return (
      <button type="button" class={`inline-edit ${cls}`} onClick={() => setOwn(true)} title={`点击编辑${label}`}>
        {value}
      </button>
    );
  return (
    <input
      ref={ref}
      class={`input inline-edit-input ${cls}`}
      value={v}
      aria-label={label}
      onInput={(e) => setV(e.currentTarget.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}

/* ---------------- Progress ring ---------------- */

export function Ring({ value, total, size = 28 }: { value: number; total: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`完成 ${value}/${total}`}>
      <circle cx={size / 2} cy={size / 2} r={r} class="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} class="ring-fg" stroke-dasharray={c} stroke-dashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}
