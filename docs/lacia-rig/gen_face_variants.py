"""
Generate the expression variants the See-through split did not produce.

The layer split gives exactly one bitmap per brow and one closed-mouth bitmap,
so `rig.ts` could only ever *move* them. This script bakes the missing shapes
into real bitmaps, which keeps the rig's rule intact: every part stays a rigid
image, and a "warp" only ever happens here, offline, once.

Two operations:

  bend()   per-column vertical shift of an existing bitmap. The brows are 7-9px
           tall strips, so shifting each column is enough to re-aim the arc —
           and because it reuses the original pixels, the result keeps the
           illustration's own anti-aliasing and colour instead of looking drawn.

  open()   the one shape that cannot be bent out of a closed mouth: a real
           opening. Painted with the mouth's own darkest colour and a pale upper
           lip, then downsampled from 8x so the edges land like the source art.

Every output is padded to the same box (FACE_PAD above and below) so all
variants of one feature are the same size and stack at the same offset. Without
that, the three brow images would have different heights and `transform-origin:
50% 50%` would rotate them about different points, making them drift apart
mid-tilt.

Run:  python docs/lacia-rig/gen_face_variants.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "lacia-rig" / "parts"

# Canvas px of transparent margin added above and below every variant.
PAD = 6
# The mouth is 20x7 in canvas units; drawing it at 8x then downsampling gives
# edges that match the source art's softness.
SS = 8


def load(name: str) -> Image.Image:
    return Image.open(SRC / f"{name}.webp").convert("RGBA")


def save(im: Image.Image, name: str) -> None:
    im.save(SRC / f"{name}.webp", lossless=True, quality=100)
    print(f"  {name}.webp  {im.width}x{im.height}")


def pad(im: Image.Image) -> Image.Image:
    out = Image.new("RGBA", (im.width, im.height + PAD * 2), (0, 0, 0, 0))
    out.paste(im, (0, PAD))
    return out


def bend(im: Image.Image, dy: np.ndarray) -> Image.Image:
    """Shift each column by dy[x] px, sub-pixel.

    Rounding the shift to whole pixels stair-steps the result: over a 45px brow
    a 5px total ramp moves one pixel every nine columns, and the eye reads those
    as a kink. Blending the two neighbouring integer shifts by the fractional
    part removes it — the strip stays one continuous arc.
    """
    src = np.array(im).astype(np.float32)
    h, w = src.shape[:2]
    out = np.zeros_like(src)

    def shifted(col: np.ndarray, k: int) -> np.ndarray:
        z = np.zeros_like(col)
        if k >= 0:
            if k < h:
                z[k:] = col[: h - k]
        else:
            if -k < h:
                z[: h + k] = col[-k:]
        return z

    for x in range(w):
        col = src[:, x, :]
        s = float(dy[x])
        k = int(np.floor(s))
        f = s - k
        out[:, x, :] = shifted(col, k) * (1.0 - f) + shifted(col, k + 1) * f
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def ramp(w: int, a: float, b: float) -> np.ndarray:
    """Linear shift from a at x=0 to b at x=w-1."""
    t = np.linspace(0.0, 1.0, w)
    return a + (b - a) * t


def curve(w: int, peak: float) -> np.ndarray:
    """Parabolic shift: 0 in the middle, `peak` at both ends."""
    t = np.linspace(-1.0, 1.0, w)
    return peak * t**2


def darkest(im: Image.Image) -> tuple[int, int, int]:
    a = np.array(im)
    m = a[:, :, 3] > 96
    if not m.any():
        return (60, 44, 43)
    px = a[:, :, :3][m]
    return tuple(int(v) for v in px[np.argmin(px.sum(axis=1))])


# ── brows ────────────────────────────────────────────────────────────────
#
# Resting shape: both inner ends sit slightly low (that is how the source art
# drew her). `furrow` exaggerates it — inner end down, outer end up, the reading
# for focused / braced. `raise` lifts the whole strip and flattens the slope, the
# reading for open / unguarded. `drop` pushes the whole strip down and lets the
# outer ends sag: relaxed, eyelids heavy, asleep. Note it is *not* a bigger
# `neutral` — a neutral brow is still held up by muscle, a sleeping one is not.
#
# Shift is given as (at x=0, at x=w-1). `-r` paints on the viewer's left so its
# inner end is the last column; `-l` is the mirror, inner end is column 0.

BROWS = {
    "r": ("eyebrow-r", {"furrow": (-1.6, 3.6), "raise": (-1.2, -2.6), "drop": (2.4, 1.2)}),
    "l": ("eyebrow-l", {"furrow": (3.6, -1.6), "raise": (-2.6, -1.2), "drop": (1.2, 2.4)}),
}


def gen_brows() -> None:
    print("brows")
    for side, (src_name, variants) in BROWS.items():
        # Pad first, then shift: the padding is the headroom that keeps a
        # 3.6px drop from clipping the strip.
        base = pad(load(src_name))
        save(base, f"brow-{side}-neutral")
        for name, (at0, at_last) in variants.items():
            save(bend(base, ramp(base.width, at0, at_last)), f"brow-{side}-{name}")


# ── mouth ────────────────────────────────────────────────────────────────


def opening(src: Image.Image, rx: float, ry: float, dy: float, corner: float = -1.1) -> Image.Image:
    """Bend the mouth at the corners, then paint a dark opening in it.

    `corner` is the vertical shift at both ends, in source px: negative lifts
    them (smile / grin / open), positive lets them sag (asleep). `dy` moves the
    opening itself — a sleeping mouth parts low, a surprised one parts centred.

    Drawn at SS× and reduced so the rim is as soft as the surrounding art — a
    hard-edged ellipse at 20px wide reads as a sticker.
    """
    w, h = src.size
    opened = bend(src, curve(w, corner))
    big = opened.resize((w * SS, h * SS), Image.LANCZOS)
    layer = Image.new("RGBA", big.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = w * SS / 2, h * SS / 2 + dy * SS
    # Kept small: at 20px wide the whole mouth is ~9 display px, so an opening
    # much bigger than this reads as a shout rather than a parted mouth.
    d.ellipse((cx - rx * SS, cy - ry * SS, cx + rx * SS, cy + ry * SS), fill=(*darkest(src), 240))
    return Image.alpha_composite(opened, layer.resize((w, h), Image.LANCZOS))


def gen_mouth() -> None:
    print("mouth")
    src = load("mouth")
    w, h = src.size

    neutral = pad(src)
    save(neutral, "mouth-neutral")

    # Smile: corners up, middle held. The corner shadows travel with the ends,
    # which is what actually reads as a smile at 20px wide.
    smile = pad(bend(src, curve(w, -2.6)))
    save(smile, "mouth-smile")

    save(pad(opening(src, 3.6, 2.2, 0.4)), "mouth-open")

    # Grin: wider than `open`, with a tooth band. Teeth are two rows of white
    # in the upper half of the opening — at this size that is all a "smile with
    # teeth" can be, but without it the wide mouth just reads as shouting.
    wide = opening(src, 4.8, 2.9, 0.2)
    big = wide.resize((w * SS, h * SS), Image.LANCZOS)
    layer = Image.new("RGBA", big.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = w * SS / 2, h * SS / 2 + 0.2 * SS
    rx, ry = 4.8 * SS, 2.9 * SS
    # Upper teeth: a pale band hugging the top lip, inset so the dark rim still
    # frames it. `bbox` clipping keeps it inside the opening.
    d.rectangle(
        (cx - rx * 0.82, cy - ry * 0.92, cx + rx * 0.82, cy - ry * 0.18),
        fill=(244, 238, 236, 232),
    )
    # The seam between the two front teeth.
    d.line(
        [(cx, cy - ry * 0.92), (cx, cy - ry * 0.18)],
        fill=(*darkest(src), 150),
        width=max(1, int(0.28 * SS)),
    )
    out = Image.alpha_composite(wide, layer.resize((w, h), Image.LANCZOS))
    save(pad(out), "mouth-grin")

    # Pout: a small round opening, corners barely lifted. This is the startled
    # shape — `open` is a wide ellipse and reads as speaking, `pout` reads as
    # "oh". Being taller than it is wide (4.4 x 4.8 px) is what makes it round;
    # a mouth this size has no other way to say "surprised".
    save(pad(opening(src, 2.2, 2.4, 0.2, corner=-0.3)), "mouth-pout")

    # Asleep: corners sag instead of lifting, and the opening sits low and slack.
    # Reusing `neutral` here was the old behaviour and it looked wrong — a closed
    # mouth with a level line is a *thinking* face, not a sleeping one.
    save(pad(opening(src, 2.4, 1.7, 1.1, corner=1.3)), "mouth-sleep")


def main() -> None:
    gen_brows()
    gen_mouth()
    print("done")


if __name__ == "__main__":
    main()
