"""Align an already-cut-out (transparent PNG) character onto the rig canvas.

`prep_source.py` handles raw generations: pure black background, flood fill from
the four borders. The three extra Lacia outfits were saved as transparent WebP
from the start, so there is no background to remove -- the alpha channel *is* the
mask. What they still need is the second half of that script: crop to the figure,
scale uniformly into the shared box, centre. Without it the pivots (which are
derived from layer bounding boxes) land in the wrong place and the figure renders
at the wrong size on every skin but its own.

Edge bleed matters here for a different reason than in `prep_source.py`. The
semi-transparent rim of a cutout still holds whatever the art was flattened onto
(usually black or white). Left alone it reads as a dark halo at 320px, so every
translucent pixel borrows the colour of its nearest solid neighbour.

Usage: python docs/lacia-rig/pipeline/prep_alpha.py <in> <out.png> [--fill-height]

`--fill-height` scales to the box *height* instead of the smaller of the two
sides, and lets the sides overflow (cropped by the canvas). The gown needs it:
its skirt is wider than the figure is tall, so fitting the width left the
character 12% shorter than every other skin -- the same person, visibly smaller.
A gown's hem running past the frame edge is unremarkable; a shrunken character is
not.
"""

import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CANVAS = (585, 1504)
BOX = (4, 4, 580, 1499)  # inclusive, matches lacia_idle.png


def main():
    src = Image.open(sys.argv[1]).convert("RGBA")
    rgba = np.array(src).astype(np.float32)
    a = rgba[:, :, 3]

    if a.min() > 250:
        sys.exit(f"{sys.argv[1]}: no transparency -- use prep_source.py instead")

    alpha = a / 255.0
    # A hard cutout has a 1-2px antialiased rim; smoothing by 0.6 keeps the
    # silhouette from reading as a saw edge after the 1.6x upscale below.
    alpha = ndimage.gaussian_filter(alpha, 0.6)

    opaque = alpha > 0.92
    if not opaque.any():
        sys.exit("empty alpha channel")
    idx = ndimage.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    rgb = rgba[:, :, :3][idx[0], idx[1]]

    fig = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
    bb = fig.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    print("figure bbox", bb)
    fig = fig.crop(bb)

    bw, bh = BOX[2] - BOX[0], BOX[3] - BOX[1]
    if "--fill-height" in sys.argv:
        s = bh / fig.height
    else:
        s = min(bw / fig.width, bh / fig.height)
    nw, nh = round(fig.width * s), round(fig.height * s)
    print(f"source {fig.width}x{fig.height} -> {nw}x{nh} (scale {s:.3f})")
    fig = fig.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    # Bottom-aligned, not centred: every skin has to stand on the same floor line
    # or the shadow and the contact points stop agreeing between outfits.
    x = BOX[0] + (bw - nw) // 2
    y = BOX[3] - nh + 1
    canvas.paste(fig, (x, y), fig)
    canvas.save(sys.argv[2])

    out = np.array(canvas.getchannel("A"))
    ys, xs = np.where(out > 16)
    print("aligned", canvas.size, "bbox", xs.min(), ys.min(), xs.max(), ys.max())


main()
