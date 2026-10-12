/**
 * Site switcher ("dial") markup, shared by the public layout (SiteDial.astro)
 * and the live preview on /owner/appearance, so both are always identical.
 *
 * The shape decides the structure, not just the corner radius:
 *  - card / leaf / glass : a panel with orbit, arc, list or icon-rail layout
 *  - capsule             : a floating vertical pill; monogram in the top dome,
 *                          site rows as nested pills, decoration in the bottom dome
 *  - half                : a true semicircle on the screen edge; sites fan out
 *                          along the arc around a hub that names the hovered site
 */
import { iconSvg } from './icons';

export interface DialConfig {
  layout: 'orbit' | 'arc' | 'list' | 'rail';
  shape: 'card' | 'capsule' | 'half' | 'leaf' | 'glass';
  handle: 'tab' | 'dot' | 'line';
  showTitle: boolean;
  showEnglish: boolean;
  showHint: boolean;
  showOrbit: boolean;
  showList: boolean;
  offsetY: number;
}

export interface DialSite {
  id: string;
  slug: string;
  name: string;
  enName: string;
  icon: string;
}

export type EffectiveLayout = 'orbit' | 'arc' | 'list' | 'rail' | 'capsule' | 'fan';

/** Layouts that a shape supports; the first is used when the stored one doesn't fit. */
export const SHAPE_LAYOUTS: Record<DialConfig['shape'], DialConfig['layout'][]> = {
  card: ['orbit', 'arc', 'list', 'rail'],
  leaf: ['orbit', 'list', 'rail', 'arc'],
  glass: ['orbit', 'arc', 'list', 'rail'],
  capsule: [],
  half: [],
};

export function effectiveLayout(c: Pick<DialConfig, 'shape' | 'layout'>): EffectiveLayout {
  if (c.shape === 'capsule') return 'capsule';
  if (c.shape === 'half') return 'fan';
  return SHAPE_LAYOUTS[c.shape].includes(c.layout) ? c.layout : SHAPE_LAYOUTS[c.shape][0]!;
}

/** Handle style that matches the shape (capsule and half have their own). */
export function effectiveHandle(c: Pick<DialConfig, 'shape' | 'handle'>): string {
  if (c.shape === 'capsule') return 'pill';
  if (c.shape === 'half') return 'moon';
  return c.handle;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** Geometry of the fan (half shape): panel radius and node ring radius in px. */
export const FAN = { R: 172, ring: 124, hub: 50 };

export function dialHtml(c: DialConfig, sites: DialSite[], currentId: string | null | undefined, monogram: string, opts: { preview?: 'open' | 'closed' } = {}): string {
  const layout = effectiveLayout(c);
  const handle = effectiveHandle(c);
  const n = Math.max(sites.length, 1);
  const current = sites.find((s) => s.id === currentId);
  const mono = esc(monogram);
  const isCur = (s: DialSite) => s.id === currentId;
  const cur = (s: DialSite) => (isCur(s) ? ' aria-current="page"' : '');
  const act = (s: DialSite) => (isCur(s) ? ' active' : '');
  const graphic = (layout === 'orbit' || layout === 'arc') && c.showOrbit;
  // The text list is used by list/orbit/arc layouts on desktop, and by every layout in the mobile sheet.
  const listOnDesktop = layout === 'list' || ((layout === 'orbit' || layout === 'arc') && (c.showList || !c.showOrbit));
  const parts: string[] = [];

  const handleInner =
    handle === 'tab'
      ? `<span class="dial-handle-mark" aria-hidden="true">${esc(current ? current.name.slice(0, 1) : monogram)}</span>${iconSvg('chevron-right', 'dial-handle-chev')}`
      : handle === 'moon'
        ? `<span class="dial-handle-mark" aria-hidden="true">${esc(current ? current.name.slice(0, 1) : monogram)}</span>`
        : '<span class="dial-handle-glyph" aria-hidden="true"></span>';

  parts.push(
    `<button class="dial-handle" type="button" aria-expanded="false" aria-controls="dial-panel" data-dial-toggle title="切换分站 (Alt+S)"><span class="sr-only">展开分站切换器</span>${handleInner}</button>`,
  );
  parts.push('<div class="dial-panel" id="dial-panel"><span class="dial-grab" aria-hidden="true"></span>');

  if (layout === 'capsule') {
    parts.push(`<a class="cap-home" href="/" aria-label="首页" title="首页" data-dial-item>${mono}</a>`);
    parts.push('<ul class="cap-list" role="list">');
    sites.forEach((s, i) => {
      parts.push(
        `<li style="--i:${i}"><a href="/${esc(s.slug)}" class="cap-row anim-icon${act(s)}"${cur(s)} data-dial-item aria-label="${esc(s.name)}"><span class="cap-icon">${iconSvg(s.icon)}</span>${
          c.showTitle ? `<span class="cap-name">${esc(s.name)}${c.showEnglish ? `<small>${esc(s.enName)}</small>` : ''}</span>` : `<span class="dial-tip" aria-hidden="true">${esc(s.name)}</span>`
        }</a></li>`,
      );
    });
    parts.push('</ul><span class="cap-foot" aria-hidden="true"><i></i><i></i><i></i></span>');
  } else if (layout === 'fan') {
    const span = Math.min(150, 34 * (n - 1));
    parts.push('<div class="fan" aria-hidden="false"><span class="fan-ring fan-ring-1" aria-hidden="true"></span><span class="fan-ring fan-ring-2" aria-hidden="true"></span>');
    sites.forEach((s, i) => {
      const deg = n === 1 ? 0 : -span / 2 + (span / (n - 1)) * i;
      const a = (deg * Math.PI) / 180;
      const x = Math.cos(a) * FAN.ring;
      const y = FAN.R + Math.sin(a) * FAN.ring;
      parts.push(
        `<a href="/${esc(s.slug)}" class="fan-node anim-icon${act(s)}"${cur(s)} style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;--i:${i}" data-dial-item data-name="${esc(s.name)}" aria-label="${esc(s.name)}">${iconSvg(s.icon)}</a>`,
      );
    });
    parts.push(
      `<a class="fan-hub" href="/" data-dial-item data-name="首页" aria-label="首页"><span class="fan-mono">${mono}</span><span class="fan-label" data-fan-label>${esc(current?.name ?? (c.showTitle ? '分站' : ''))}</span></a></div>`,
    );
  } else {
    if (c.showTitle && layout !== 'rail') parts.push('<div class="dial-label">SITES · 分站</div>');
    if (graphic) {
      parts.push('<div class="dial-orbit"><span class="dial-ring" aria-hidden="true"></span>');
      parts.push(`<a class="dial-center" href="/" aria-label="首页" title="首页"${listOnDesktop ? ' tabindex="-1"' : ' data-dial-item'}>${mono}</a>`);
      sites.forEach((s, i) => {
        let x: number;
        let y: number;
        if (layout === 'arc') {
          const span = Math.min(140, 30 * (n - 1));
          const a = ((n === 1 ? 0 : -span / 2 + (span / (n - 1)) * i) * Math.PI) / 180;
          x = 6 + Math.cos(a) * 78;
          y = 50 + Math.sin(a) * 42;
        } else {
          const a = (-90 + (360 / n) * i) * (Math.PI / 180);
          x = 50 + Math.cos(a) * 39;
          y = 50 + Math.sin(a) * 39;
        }
        parts.push(
          `<a class="dial-node anim-icon${act(s)}" href="/${esc(s.slug)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--i:${i}"${cur(s)} aria-label="${esc(s.name)}"${listOnDesktop ? ' tabindex="-1"' : ' data-dial-item'}>${iconSvg(s.icon)}<span class="dial-tip" aria-hidden="true">${esc(s.name)}</span></a>`,
        );
      });
      parts.push('</div>');
    }
    if (layout === 'rail') {
      parts.push(`<ul class="dial-rail" role="list"><li style="--i:0"><a class="dial-rail-item" href="/" data-dial-item aria-label="首页"><span class="dial-rail-icon">${mono}</span>${c.showTitle ? '<span class="dial-rail-name">首页</span>' : '<span class="dial-tip" aria-hidden="true">首页</span>'}</a></li>`);
      sites.forEach((s, i) => {
        parts.push(
          `<li style="--i:${i + 1}"><a href="/${esc(s.slug)}" class="dial-rail-item anim-icon${act(s)}"${cur(s)} data-dial-item aria-label="${esc(s.name)}"><span class="dial-rail-icon">${iconSvg(s.icon)}</span>${
            c.showTitle ? `<span class="dial-rail-name">${esc(s.name)}</span>` : `<span class="dial-tip" aria-hidden="true">${esc(s.name)}</span>`
          }</a></li>`,
        );
      });
      parts.push('</ul>');
    }
  }

  // Text list: desktop for list-type layouts, and always the mobile bottom-sheet content.
  parts.push(`<ul class="dial-list${listOnDesktop ? '' : ' dial-list--sheet'}" role="list">`);
  sites.forEach((s, i) => {
    parts.push(
      `<li style="--i:${i}"><a href="/${esc(s.slug)}" class="anim-icon${act(s)}"${cur(s)} ${listOnDesktop ? 'data-dial-item' : 'data-dial-sheet'}><span class="dial-list-icon">${iconSvg(s.icon)}</span><span class="dial-list-name">${esc(s.name)}</span>${
        c.showEnglish ? `<small>${esc(s.enName)}</small>` : ''
      }</a></li>`,
    );
  });
  parts.push('</ul>');
  if (c.showHint && (layout === 'orbit' || layout === 'arc' || layout === 'list')) parts.push('<div class="dial-foot">Alt+S 打开 · ↑↓ 选择 · Esc 收起</div>');
  parts.push('</div>');

  const attrs = [
    'class="dial' + (opts.preview ? ` is-preview is-${opts.preview}` : '') + '"',
    opts.preview ? 'aria-hidden="true" inert' : 'data-dial aria-label="分站切换"',
    `data-layout="${layout}"`,
    `data-shape="${c.shape}"`,
    `data-handle="${handle}"`,
    `data-list="${listOnDesktop ? 'on' : 'off'}"`,
    `style="--dial-y:${Math.round(c.offsetY)}%;--fan-r:${FAN.R}px;--fan-hub:${FAN.hub}px"`,
  ];
  return `<nav ${attrs.join(' ')}>${parts.join('')}</nav>`;
}
