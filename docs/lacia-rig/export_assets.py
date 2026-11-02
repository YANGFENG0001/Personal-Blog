"""Turn the See-through layer dump into rig-ready web assets.

- split the merged leg / shoe layers into left and right by connected components
- crop every part to its own alpha bbox
- emit public/lacia-rig/parts/*.webp and the typed manifest src/lib/lacia/parts.ts

Run with the ComfyUI venv (it has scipy + Pillow):

    D:\\Comfy-Desktop\\ComfyUI-Installs\\ComfyUI\\ComfyUI\\.venv\\Scripts\\python.exe \\
        docs/lacia-rig/export_assets.py
"""

import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "docs", "seethrough", "layers")
META = os.path.join(ROOT, "docs", "seethrough", "layers.json")
OUT = os.path.join(ROOT, "public", "lacia-rig", "parts")
TS = os.path.join(ROOT, "src", "lib", "lacia", "parts.ts")

os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.dirname(TS), exist_ok=True)

meta = json.load(open(META, encoding="utf-8"))
W, H = meta["width"], meta["height"]


def slug(name):
    return name.replace(" ", "-")


# 1. build the full canvas once to find the character bbox
full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
loaded = {}
for layer in meta["layers"]:
    im = Image.open(os.path.join(SRC, layer["filename"])).convert("RGBA")
    loaded[layer["name"]] = im
    full.alpha_composite(im, (layer["left"], layer["top"]))

x0, y0, x1, y1 = full.getbbox()
CW, CH = x1 - x0, y1 - y0
print(f"character canvas {CW}x{CH} (offset {x0},{y0})")

parts = []


def add(name, img, ox, oy, z):
    """img is a full-canvas-sized RGBA already positioned at (ox, oy) offset."""
    bbox = img.getbbox()
    if bbox is None:
        return
    px0, py0, px1, py1 = bbox
    crop = img.crop(bbox)
    fn = f"{slug(name)}.webp"
    crop.save(os.path.join(OUT, fn), "WEBP", quality=92, method=6)
    parts.append(
        {
            "id": name,
            "file": fn,
            "x": px0 + ox - x0,
            "y": py0 + oy - y0,
            "w": px1 - px0,
            "h": py1 - py0,
            "z": z,
        }
    )
    print(f"  {name:16s} {px1-px0:4d}x{py1-py0:<4d} at ({px0+ox-x0},{py0+oy-y0})")


# How much the two knee crops overlap, in canvas px. The shin rotates a few
# degrees about the knee; without an overlap that rotation opens a wedge-shaped
# gap straight through the leg. 16 is enough for ~8° at this leg's thickness and
# small enough that the doubled band never reads as a seam — the surface there is
# a single dark tone, so the overlap has nothing to disagree about.
KNEE_OVERLAP = 16

# side -> (pivot x, pivot y) in canvas coords, filled in by split_joint()
KNEES = {}
ELBOWS = {}

# Which band of a limb's height the joint is searched in, as (low, high).
#
# These are not interchangeable and that is the whole point. The knee sits at
# 40–60% of a leg; an arm's narrowest point at 40–60% is the **wrist**, not the
# elbow (measured: 28px fill at 64% of the arm, versus 36px at 33%). Cutting at
# the wrist gives a hand that swivels — which looks like a broken toy, not like
# an elbow.
JOINT_BANDS = {"knee": (0.40, 0.60), "elbow": (0.25, 0.50)}


def split_joint(nm, out, ox, oy, z, joint):
    """Cut a limb into two segments at `joint`.

    The joint row is the **narrowest row inside that joint's band**. On a
    standing figure the silhouette pinches just above the joint; picking it by
    measurement rather than by a hardcoded fraction is what makes this survive a
    re-split with different crops. (The first knee guess — 45% — landed 80px low
    on this art, on the calf, which reads as a broken doll because the shin then
    swings from mid-calf.)
    """
    lo_f, hi_f = JOINT_BANDS[joint]
    a = out[:, :, 3] > 40
    ys = np.where(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    lo, hi = top + int((bot - top) * lo_f), top + int((bot - top) * hi_f)
    row = min((int(a[y].sum()), y) for y in range(lo, hi))[1]
    xs = np.where(a[row])[0]
    # `out` is sized to the *layer's own crop*, so its coordinates are local to
    # (ox, oy); parts.ts stores everything relative to the character bbox. Both
    # offsets have to be undone or the pivot lands outside the figure.
    pivot = (round(float(xs.mean()) + ox - x0, 1), float(row + oy - y0))
    (KNEES if joint == "knee" else ELBOWS)[nm[-1]] = pivot

    up = out.copy()
    up[row + KNEE_OVERLAP:] = 0
    dn = out.copy()
    dn[:row - KNEE_OVERLAP] = 0
    add(f"{nm}-up", Image.fromarray(up), ox, oy, z)
    add(f"{nm}-lo", Image.fromarray(dn), ox, oy, z)
    print(f"    {joint} pivot {pivot} in canvas coords")


def split_lr(name, img, ox, oy, z, knee=False):
    """Split a merged two-leg layer into left / right halves by connected components."""
    a = np.array(img)[:, :, 3]
    mask = a > 24
    # erode a touch so the two legs are not bridged by anti-aliasing
    mask = ndimage.binary_erosion(mask, iterations=2)
    lab, n = ndimage.label(mask)
    if n < 2:
        print(f"  !! {name}: only {n} component, keeping whole")
        add(name, img, ox, oy, z)
        return
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s > mask.sum() * 0.05]
    boxes = []
    for k in keep:
        ys, xs = np.where(lab == k)
        boxes.append((xs.mean(), xs.min(), ys.min(), xs.max(), ys.max(), k))
    boxes.sort(key=lambda b: b[0])
    # left in image space = smaller x; the figure faces us, so image-left is her right
    names = [f"{name}-r", f"{name}-l"] if len(boxes) == 2 else [f"{name}-{i}" for i in range(len(boxes))]
    arr = np.array(img)
    for nm, b in zip(names, boxes):
        cx, bx0, by0, bx1, by1, k = b
        m = ndimage.binary_dilation(lab == k, iterations=2)
        out = arr.copy()
        out[~m] = 0
        if knee:
            split_joint(nm, out, ox, oy, z, "knee")
        else:
            add(nm, Image.fromarray(out), ox, oy, z)


Z = 0
for layer in meta["layers"]:
    name = layer["name"]
    img = loaded[name]
    ox, oy = layer["left"], layer["top"]
    Z += 1
    if name in ("legwear", "footwear"):
        split_lr(name, img, ox, oy, Z, knee=(name == "legwear"))
    elif name in ("handwear-l", "handwear-r"):
        # Already one layer per arm, so no L/R split — just the elbow cut.
        split_joint(name, np.array(img), ox, oy, Z, "elbow")
    else:
        add(name, img, ox, oy, Z)

parts.sort(key=lambda p: p["z"])

# 2. typed manifest
lines = [
    "/**",
    " * Lacia rig geometry — generated by docs/lacia-rig/export_assets.py.",
    " *",
    " * Every part is a cropped RGBA bitmap from the See-through layer split,",
    f" * positioned in the {CW}x{CH} canvas of the original illustration. `z` is the",
    " * paint order inside its bone, not the bone order (see LACIA_PIVOT).",
    " *",
    " * Do not hand-edit: re-run the export script after re-splitting the layers.",
    " */",
    "",
    "export interface LaciaPart {",
    "  id: string;",
    "  file: string;",
    "  x: number;",
    "  y: number;",
    "  w: number;",
    "  h: number;",
    "  z: number;",
    "}",
    "",
    f"export const LACIA_CANVAS = {{ w: {CW}, h: {CH} }} as const;",
    "",
    "/** Knee pivots, measured as the narrowest row of each leg's silhouette.",
    " *  The shin bone rotates here, so this number decides whether a bend reads",
    " *  as a knee or as a leg snapping in half. */",
    "export const LACIA_KNEE = {",
    f"  r: [{KNEES['r'][0]}, {KNEES['r'][1]}],",
    f"  l: [{KNEES['l'][0]}, {KNEES['l'][1]}],",
    "} as const;",
    "",
    "/** Elbow pivots, same measurement on a narrower band — an arm's narrowest",
    " *  point overall is the wrist, so the elbow needs its own search window. */",
    "export const LACIA_ELBOW = {",
    f"  r: [{ELBOWS['r'][0]}, {ELBOWS['r'][1]}],",
    f"  l: [{ELBOWS['l'][0]}, {ELBOWS['l'][1]}],",
    "} as const;",
    "",
    "export const LACIA_PARTS: readonly LaciaPart[] = [",
]
for p in parts:
    lines.append(
        "  { id: %s, file: %s, x: %d, y: %d, w: %d, h: %d, z: %d },"
        % (json.dumps(p["id"]), json.dumps(p["file"]), p["x"], p["y"], p["w"], p["h"], p["z"])
    )
lines += ["];", ""]
with open(TS, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines))

total = sum(os.path.getsize(os.path.join(OUT, p["file"])) for p in parts)
print(f"\n{len(parts)} parts, {total/1e6:.2f} MB")
print(f"-> {OUT}")
print(f"-> {TS}")
