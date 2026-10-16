import { describe, expect, it } from 'vitest';
import { analyze, removeBackground, measure } from '../../tools/asset-studio/lib/matte.mjs';
import { mascotPackSchema, pickLines } from '../../src/lib/mascot-pack';

/** Build an RGBA image: a checkerboard (or solid colour) with a coloured rectangle "character". */
function image(w: number, h: number, bg: 'checker' | [number, number, number], fig = { x: 20, y: 10, w: 24, h: 50 }) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = bg === 'checker' ? ((((x / 8) | 0) + ((y / 8) | 0)) % 2 ? 204 : 255) : null;
      const c = bg === 'checker' ? [v!, v!, v!] : bg;
      const inside = x >= fig.x && x < fig.x + fig.w && y >= fig.y && y < fig.y + fig.h;
      const col = inside ? [180, 60, 90] : c;
      d[i] = col[0]!; d[i + 1] = col[1]!; d[i + 2] = col[2]!; d[i + 3] = 255;
    }
  }
  return d;
}
const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('asset studio matte', () => {
  it('detects a painted checkerboard and removes it, keeping the figure', () => {
    const w = 64, h = 64;
    const src = image(w, h, 'checker');
    expect(analyze(src, w, h).kind).toBe('checker');
    const r = removeBackground(src, w, h);
    expect(alphaAt(r.data, w, 2, 2)).toBe(0);
    expect(alphaAt(r.data, w, 60, 60)).toBe(0);
    expect(alphaAt(r.data, w, 30, 30)).toBe(255);
  });

  it('removes checkerboard holes enclosed by the figure', () => {
    const w = 80, h = 80;
    const src = image(w, h, 'checker', { x: 10, y: 10, w: 60, h: 60 });
    // punch a 24×24 checkerboard hole in the middle of the figure
    for (let y = 28; y < 52; y++) for (let x = 28; x < 52; x++) {
      const i = (y * w + x) * 4;
      const v = (((x / 8) | 0) + ((y / 8) | 0)) % 2 ? 204 : 255;
      src[i] = src[i + 1] = src[i + 2] = v;
    }
    const r = removeBackground(src, w, h);
    expect(alphaAt(r.data, w, 40, 40)).toBe(0);
    expect(alphaAt(r.data, w, 15, 15)).toBe(255);
  });

  it('keeps plain white areas inside the figure (not a checkerboard)', () => {
    const w = 80, h = 80;
    const src = image(w, h, 'checker', { x: 10, y: 10, w: 60, h: 60 });
    for (let y = 30; y < 50; y++) for (let x = 30; x < 50; x++) { const i = (y * w + x) * 4; src[i] = src[i + 1] = src[i + 2] = 255; }
    const r = removeBackground(src, w, h);
    expect(alphaAt(r.data, w, 40, 40)).toBe(255);
  });

  it('keys out a green screen', () => {
    const w = 64, h = 64;
    const src = image(w, h, [0, 255, 0]);
    expect(analyze(src, w, h).kind).toBe('solid');
    const r = removeBackground(src, w, h);
    expect(alphaAt(r.data, w, 1, 1)).toBe(0);
    expect(alphaAt(r.data, w, 30, 30)).toBe(255);
  });

  it('measures the visible box', () => {
    const w = 64, h = 64;
    const r = removeBackground(image(w, h, 'checker'), w, h);
    const m = measure(r.data, w, h)!;
    expect(m.box.x).toBeGreaterThanOrEqual(18);
    expect(m.box.x).toBeLessThanOrEqual(20);
    expect(m.box.width).toBeGreaterThanOrEqual(24);
    expect(m.box.width).toBeLessThanOrEqual(28);
  });
});

describe('mascot pack manifest', () => {
  const base = { format: 'fieldnotes-mascot@1', name: '测试', width: 300, height: 600, states: { idle: 'idle.webp' } };

  it('fills defaults', () => {
    const m = mascotPackSchema.parse(base);
    expect(m.display.mode).toBe('full');
    expect(m.anchors.baseline).toBe(1);
    expect(m.motion.swing).toBe(true);
  });

  it('requires idle and rejects paths in file names', () => {
    expect(() => mascotPackSchema.parse({ ...base, states: { talk: 'talk.webp' } })).toThrow();
    expect(() => mascotPackSchema.parse({ ...base, states: { idle: '../x.webp' } })).toThrow();
    expect(() => mascotPackSchema.parse({ ...base, format: 'other' })).toThrow();
  });

  it('falls back to click lines', () => {
    const m = mascotPackSchema.parse({ ...base, lines: { click: ['你好'] } });
    expect(pickLines(m, 'night')).toEqual(['你好']);
    expect(pickLines(mascotPackSchema.parse({ ...base, lines: { click: ['a'], night: ['b'] } }), 'night')).toEqual(['b']);
  });
});
