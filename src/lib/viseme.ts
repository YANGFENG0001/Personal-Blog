/**
 * Per-glyph mouth targets — the closest thing to lip sync this site can do.
 *
 * There is no audio anywhere on the site: the "voice" is text, and the mouth is
 * driven off the **glyph that is being revealed**, not off a blind sine.
 *
 * Two hosts use this, and they differ only in how the schedule is produced:
 *
 *   lacia rig   the text is a CSS per-glyph animation, so glyph *i* appears at
 *               `delay + i * speed` and the schedule is exact. See `rig.ts`.
 *   svg mascots the bubble text appears all at once, so `mascot.ts` derives a
 *               schedule from the text length at a speaking rate.
 *
 * Neither is phoneme-accurate and this file does not pretend otherwise. It is
 * syllable-accurate for Japanese, because kana are mora-timed: one character is
 * one beat, and the vowel of that beat decides how far the mouth opens. Kanji
 * and Chinese have no reading available here, so each glyph gets a *stable*
 * pseudo-vowel derived from its code point: the same sentence always animates
 * the same way, and different sentences do not look identical — which a flat
 * "neutral mid value" for every CJK glyph did.
 *
 * The five vowels map to `(open, wide)`. `wide` multiplies the mouth's scaleX,
 * so it is the difference between a spread "i" and a rounded "u" — with a single
 * mouth shape that difference can only be a squash, not a different drawing.
 */

export interface Viseme {
  /** Extra scaleY on top of the resting mouth, 0 = closed. */
  open: number;
  /** scaleX multiplier, 1 = as drawn. */
  wide: number;
}

const CLOSED: Viseme = { open: 0, wide: 1 };

/** a i u e o — the mouth shape of each vowel, measured by eye against the
 *  drawings: "a" is the widest opening, "u" the most pursed. */
const VOWEL: readonly Viseme[] = [
  { open: 0.95, wide: 1.06 },
  { open: 0.5, wide: 1.14 },
  { open: 0.38, wide: 0.78 },
  { open: 0.62, wide: 1.02 },
  { open: 0.78, wide: 0.86 },
];

/**
 * Every gojūon row, in vowel order. Katakana is folded onto hiragana by code
 * point (offset 0x60) before lookup, so each row only has to be written once.
 */
const ROWS = [
  'あいうえお',
  'かきくけこ',
  'がぎぐげご',
  'さしすせそ',
  'ざじずぜぞ',
  'たちつてと',
  'だぢづでど',
  'なにぬねの',
  'はひふへほ',
  'ばびぶべぼ',
  'ぱぴぷぺぽ',
  'まみむめも',
  'らりるれろ',
];

/** Characters that are not a full row: mapped to a vowel index explicitly. */
const SOLO: Record<string, number> = {
  や: 0, ゆ: 2, よ: 4, ゃ: 0, ゅ: 2, ょ: 4,
  わ: 0, を: 4, ゎ: 0,
  ゐ: 1, ゑ: 3,
  あ: 0, い: 1, う: 2, え: 3, お: 4,
  ぁ: 0, ぃ: 1, ぅ: 2, ぇ: 3, ぉ: 4,
  ゔ: 2,
};

const VOWEL_OF = new Map<string, number>();
for (const row of ROWS) [...row].forEach((ch, i) => VOWEL_OF.set(ch, i));
for (const [ch, i] of Object.entries(SOLO)) VOWEL_OF.set(ch, i);

/** ん closes, っ holds the previous shape, ー lengthens it. */
const SPECIAL: Record<string, Viseme> = {
  ん: { open: 0.08, wide: 1 },
  ン: { open: 0.08, wide: 1 },
  っ: { open: 0, wide: 1 },
  ッ: { open: 0, wide: 1 },
  ー: { open: 0.3, wide: 0.92 },
  '・': CLOSED,
};

const PUNCT = new Set([...'。、，．,.!！?？…‥「」『』（）()—―-~〜:：;；"\'` ']);

const toHiragana = (ch: string): string => {
  const c = ch.codePointAt(0) ?? 0;
  // Katakana block ァ..ヶ is the hiragana block ぁ..ゖ shifted by 0x60.
  return c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
};

/**
 * A stable "vowel" for a glyph whose reading is unknown.
 *
 * The obvious choice — one neutral value for every CJK glyph — makes a whole
 * Chinese sentence a flat line of identical cues, which looks *worse* than the
 * sine it replaced because it is not even alive. Hashing the code point keeps
 * the sequence deterministic (same sentence, same animation, every time) while
 * giving the mouth somewhere to travel.
 */
function pseudoVowel(cp: number): Viseme {
  // xorshift-style scramble; any cheap mixing works, it only has to spread.
  let h = cp * 2654435761;
  h ^= h >>> 15;
  h = (h * 2246822519) >>> 0;
  h ^= h >>> 13;
  const t = (h % 1000) / 1000;
  return { open: 0.42 + t * 0.36, wide: 0.92 + (1 - t) * 0.14 };
}

/** How far the mouth opens for one glyph. */
export function visemeFor(raw: string): Viseme {
  const ch = toHiragana(raw);
  const special = SPECIAL[ch] ?? SPECIAL[raw];
  if (special) return special;
  if (PUNCT.has(ch) || PUNCT.has(raw)) return CLOSED;

  const v = VOWEL_OF.get(ch);
  if (v !== undefined) return VOWEL[v];

  const cp = raw.codePointAt(0) ?? 0;
  // CJK ideographs and kana already covered above: no reading available.
  if (cp >= 0x4e00 && cp <= 0x9fff) return pseudoVowel(cp);
  // Latin / digits: a generic mid vowel, still varied per glyph.
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return pseudoVowel(cp);
  if (cp >= 0x30 && cp <= 0x39) return { open: 0.4, wide: 1 };
  return CLOSED;
}

export interface SayLine {
  text: string;
  /** ms before the first glyph of this line appears. */
  delay: number;
  /** ms between glyphs — must match the CSS `animationDelay` step. */
  speed: number;
}

export interface VisemeCue {
  at: number;
  open: number;
  wide: number;
}

/**
 * Flatten lines into one absolute-time cue list.
 *
 * `at` is when the glyph appears, so a cue holds until the next one — that is
 * exactly how a typewriter behaves, and the spring smooths the steps.
 */
export function buildScript(lines: readonly SayLine[]): VisemeCue[] {
  const cues: VisemeCue[] = [];
  for (const line of lines) {
    let i = 0;
    for (const ch of line.text) {
      const v = visemeFor(ch);
      cues.push({ at: line.delay + i * line.speed, open: v.open, wide: v.wide });
      i++;
    }
  }
  cues.sort((a, b) => a.at - b.at);
  return cues;
}

/**
 * Build a schedule for text that appears **all at once** (the SVG mascots'
 * speech bubble) rather than glyph by glyph.
 *
 * There is no reveal schedule to follow, so one is invented at a plausible
 * speaking rate. Chinese is roughly 4–5 characters per second in casual speech,
 * hence the default 210ms step; the last cue is padded so the mouth does not
 * snap shut on the final syllable.
 */
export function scheduleForText(text: string, step = 210): VisemeCue[] {
  const cues: VisemeCue[] = [];
  let i = 0;
  for (const ch of text) {
    const v = visemeFor(ch);
    cues.push({ at: i * step, open: v.open, wide: v.wide });
    i++;
  }
  return cues;
}
