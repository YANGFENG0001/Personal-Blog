"""Turn a raw character generation into the See-through input.

The rig's canvas is fixed (585x1504 with the figure bbox at 4,4-580,1499, which
`export_assets.py` maps onto the 493x1275 layer canvas). Every skin has to be
aligned to that box or the pivots and the display size stop agreeing -- the
blue-dress README spells out why the 1px difference was worth chasing.

Background: these generations come back on pure black, which is the easiest
possible case -- one connected region touching all four borders. A flood fill
from the border removes 65% of the frame and leaves 0.8% of near-black pixels
inside the figure (eyes, shadow under the skirt) untouched. Keying on darkness
alone would eat the hair; keying on connectivity cannot.

Usage: python docs/lacia-rig/pipeline/prep_source.py <in.png> <out.png>
"""

import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CANVAS = (585, 1504)
BOX = (4, 4, 580, 1499)  # inclusive, matches lacia_idle.png


def main():
    src = Image.open(sys.argv[1]).convert("RGB")
    rgb = np.array(src).astype(np.float32)
    dark = rgb.max(axis=2) < 14

    lab, _ = ndimage.label(dark)
    edge = np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])
    bg_ids = [i for i in np.unique(edge) if i != 0]
    bg = np.isin(lab, bg_ids)
    print(f"background {bg.mean() * 100:.1f}%")

    alpha = np.where(bg, 0.0, 1.0)
    # One-pixel feather so the cutout does not read as a saw edge at 124px.
    alpha = ndimage.gaussian_filter(alpha, 0.8)
    alpha[bg & (alpha < 0.35)] = 0.0

    # Edge bleed: a semi-transparent pixel still holds the black it was composited
    # over, so every one of them borrows the colour of the nearest solid pixel.
    opaque = alpha > 0.92
    idx = ndimage.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    rgb = rgb[idx[0], idx[1]]

    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    fig = Image.fromarray(out, "RGBA")
    bb = fig.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    print("figure bbox", bb)
    fig = fig.crop(bb)

    # Uniform scale into the shared box, centred -- never stretched, because a
    # stretched figure puts the knee where the shin used to be.
    bw, bh = BOX[2] - BOX[0], BOX[3] - BOX[1]
    s = min(bw / fig.width, bh / fig.height)
    nw, nh = round(fig.width * s), round(fig.height * s)
    fig = fig.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.paste(fig, (BOX[0] + (bw - nw) // 2, BOX[1] + (bh - nh) // 2), fig)
    canvas.save(sys.argv[2])
    a = np.array(canvas.getchannel("A"))
    ys, xs = np.where(a > 16)
    print("aligned", canvas.size, "bbox", xs.min(), ys.min(), xs.max(), ys.max())


main()
