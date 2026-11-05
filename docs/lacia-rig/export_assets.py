"""Turn the See-through layer dump into rig-ready web assets.

- split the merged leg / shoe layers into left and right by connected components
- crop every part to its own alpha bbox
- emit public/lacia-rig/parts/*.webp and the typed manifest src/lib/lacia/parts.ts

Run with the ComfyUI venv (it has scipy + Pillow):

    D:\\Comfy-Desktop\\ComfyUI-Installs\\ComfyUI\\ComfyUI\\.venv\\Scripts\\python.exe \\
        docs/lacia-rig/export_assets.py
"""

import argparse
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Every path is overridable, because a skin is not a special case: the battle
# suit and the blue dress are the same 30 parts cut out of different artwork.
# Writing to fixed locations means the second skin silently overwrites the
# first, which is the one thing you cannot recover from — the pivot tables go
# with it.
_ap = argparse.ArgumentParser()
_ap.add_argument("--src", default=os.path.join(ROOT, "docs", "seethrough", "layers"))
_ap.add_argument("--meta", default=os.path.join(ROOT, "docs", "seethrough", "layers.json"))
_ap.add_argument("--out", default=os.path.join(ROOT, "public", "lacia-rig", "parts"))
_ap.add_argument("--ts", default=os.path.join(ROOT, "src", "lib", "lacia", "parts.ts"))
_ap.add_argument("--name", default="LACIA", help="prefix for the emitted consts")
_ap.add_argument(
    "--title",
    default="Lacia rig geometry",
    help="one-line description used in the generated header",
)
_ap.add_argument(
    "--reuse-pivots",
    default="",
    help="read joint pivots from an existing parts.ts instead of measuring them",
)
_args = _ap.parse_args()

SRC, META, OUT, TS = _args.src, _args.meta, _args.out, _args.ts
NAME = _args.name

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


# How much two segments of one limb overlap, in canvas px. A segment rotates a
# few degrees about its joint; without an overlap that rotation opens a
# wedge-shaped gap straight through the limb. 16 is enough for ~8° at these
# thicknesses and small enough that the doubled band never reads as a seam — the
# surface there is a single dark tone, so the overlap has nothing to disagree
# about. The wrist is thinner than the knee, so it needs less.
KNEE_OVERLAP = 16
WRIST_OVERLAP = 9

# side -> (pivot x, pivot y) in canvas coords, filled in by cut_at()
KNEES = {}
ELBOWS = {}
WRISTS = {}
ANKLES = {}

# Which band of a limb's height the joint is searched in, as (low, high).
#
# These are not interchangeable and that is the whole point. Measured on this
# art, as a fraction of the limb layer's height:
#
#   knee   ~45%   (40–60% band; the silhouette pinches just above the joint)
#   elbow  ~33%   (25–50% band)
#   wrist  ~70%   (60–78% band) — and note this one is *below* the elbow, so it
#                  is searched inside the forearm crop, not the whole arm
#   ankle  ~10%   (02–30% band) — the boot cuff, i.e. the narrowest row of the
#                  footwear layer, which is where a boot grips the ankle
#
# Sharing one band between joints is what produces the classic broken-doll rig:
# searching 40–60% of an arm for "the elbow" finds the wrist, and the hand then
# swivels like a prop instead of hanging off a forearm.
JOINT_BANDS = {
    "knee": (0.40, 0.60),
    "elbow": (0.25, 0.50),
    "wrist": (0.60, 0.78),
    "ankle": (0.02, 0.30),
}


def cut_at(arr, joint):
    """Find the joint row in `arr` and return (row, pivot in canvas coords).

    The row is the **narrowest row inside that joint's band**. On a standing
    figure the silhouette pinches at every real joint; picking it by measurement
    rather than by a hardcoded fraction is what makes this survive a re-split
    with different crops. (The first knee guess — 45% — landed 80px low on this
    art, on the calf, which reads as a broken doll because the shin then swings
    from mid-calf.)
    """
    lo_f, hi_f = JOINT_BANDS[joint]
    a = arr[:, :, 3] > 40
    ys = np.where(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    lo, hi = top + int((bot - top) * lo_f), top + int((bot - top) * hi_f)
    row = min((int(a[y].sum()), y) for y in range(lo, hi))[1]
    xs = np.where(a[row])[0]
    return row, xs.mean()


def pivot_of(row, cx, ox, oy):
    """Layer-local (row, cx) -> canvas coords, relative to the character bbox.

    `arr` is sized to the *layer's own crop*, so its coordinates are local to
    (ox, oy); parts.ts stores everything relative to the character bbox. Both
    offsets have to be undone or the pivot lands outside the figure — the first
    version of this returned y = -354.
    """
    return (round(float(cx) + ox - x0, 1), float(row + oy - y0))


def split_joint(nm, out, ox, oy, z, joint):
    """Cut a limb into two segments at `joint` (knee / ankle)."""
    row, cx = cut_at(out, joint)
    pivot = pivot_of(row, cx, ox, oy)
    {"knee": KNEES, "ankle": ANKLES}[joint][nm[-1]] = pivot
    up = out.copy()
    up[row + KNEE_OVERLAP:] = 0
    dn = out.copy()
    dn[:row - KNEE_OVERLAP] = 0
    add(f"{nm}-up", Image.fromarray(up), ox, oy, z)
    add(f"{nm}-lo", Image.fromarray(dn), ox, oy, z)
    print(f"    {joint} pivot {pivot} in canvas coords")


def split_arm(nm, out, ox, oy, z):
    """Cut an arm into three segments: upper arm, forearm, hand.

    Three, not two, because the elbow alone cannot express a hand. With a single
    forearm+hand layer the wrist is welded shut: the hand always points the way
    the forearm happens to point, which is the difference between "her arm is
    bent" and "she is holding something". The hand also needs its own pivot to
    hang — a hand that rotates with the forearm at the same instant reads as a
    paddle.
    """
    e_row, e_cx = cut_at(out, "elbow")
    ELBOWS[nm[-1]] = pivot_of(e_row, e_cx, ox, oy)
    up = out.copy()
    up[e_row + KNEE_OVERLAP:] = 0
    fore_hand = out.copy()
    fore_hand[:e_row - KNEE_OVERLAP] = 0

    w_row, w_cx = cut_at(fore_hand, "wrist")
    WRISTS[nm[-1]] = pivot_of(w_row, w_cx, ox, oy)
    fore = fore_hand.copy()
    fore[w_row + WRIST_OVERLAP:] = 0
    hand = fore_hand.copy()
    hand[:w_row - WRIST_OVERLAP] = 0

    add(f"{nm}-up", Image.fromarray(up), ox, oy, z)
    add(f"{nm}-lo", Image.fromarray(fore), ox, oy, z)
    add(f"{nm}-hand", Image.fromarray(hand), ox, oy, z)
    print(f"    elbow {ELBOWS[nm[-1]]} / wrist {WRISTS[nm[-1]]}")


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
        elif name == "footwear":
            # Boots stay whole — an ankle is not a place you cut a boot in half.
            # What the split is for here is the *pivot*: the boot becomes its own
            # bone so the sole can stay level while the shin swings.
            row, acx = cut_at(out, "ankle")
            ANKLES[nm[-1]] = pivot_of(row, acx, ox, oy)
            add(nm, Image.fromarray(out), ox, oy, z)
            print(f"    ankle pivot {ANKLES[nm[-1]]} in canvas coords")
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
        # Already one layer per arm, so no L/R split — just the two cuts.
        split_arm(name, np.array(img), ox, oy, Z)
    else:
        add(name, img, ox, oy, Z)

parts.sort(key=lambda p: p["z"])

# 3. the body frame.
#
# The four joints above are measured; the other thirteen pivots (hips, chest,
# shoulders, neck, head, hair) used to be hand-placed constants for one figure.
# That works only while every skin is the same character: a second character is
# narrower and has her shoulders somewhere else, so `rig.ts` would swing the
# arms about a point in mid-air.
#
# The rules below are ratios read off the battle suit, expressed against the
# layers that actually define each landmark -- the shoulder pivot sits at 11% of
# the upper arm's height, the hips sit on the bottom edge of the top, and so on.
# Same rules, any figure.
_by_id = {p["id"]: p for p in parts}


def _need(pid):
    p = _by_id.get(pid)
    if p is None:
        raise SystemExit(f"frame: layer {pid!r} missing — the split did not produce it")
    return p


def _cx(p):
    return p["x"] + p["w"] / 2.0


def _frame():
    bw = _need("bottomwear")
    tw = _need("topwear")
    nk = _need("neck")
    fc = _need("face")
    bh = _need("back hair")
    ar = _need("handwear-r-up")
    al = _need("handwear-l-up")
    lr_ = _need("legwear-r-up")
    ll = _need("legwear-l-up")

    hip_y = tw["y"] + tw["h"]
    hip_x = (_cx(lr_) + _cx(ll)) / 2.0
    face_bottom = fc["y"] + fc["h"]
    return {
        "root": (hip_x, hip_y),
        "hips": (hip_x, hip_y),
        "spine": (hip_x, hip_y),
        "chest": (hip_x, hip_y - 40),
        "torso": (_cx(tw), tw["y"] + tw["h"] / 2.0),
        "neck": (_cx(nk), face_bottom + 24),
        "head": (_cx(fc), face_bottom - 4),
        "hairFront": (_cx(fc), face_bottom - 30),
        "hairBack": (_cx(fc), face_bottom),
        "armR": (ar["x"] + ar["w"] * 0.75, ar["y"] + ar["h"] * 0.11),
        "armL": (al["x"] + al["w"] * 0.25, al["y"] + al["h"] * 0.11),
        "legR": (_cx(lr_), lr_["y"] + 16),
        "legL": (_cx(ll), ll["y"] + 16),
    }


FRAME = _frame()
print("\nframe:")
for k, v in FRAME.items():
    print(f"  {k:10s} ({v[0]:.1f}, {v[1]:.1f})")

# Reuse another skin's pivots.
#
# A joint is a property of the *body*, not of the clothes, and `cut_at` only
# finds it because a standing figure pinches at the joint. That assumption
# breaks the moment a garment covers the pinch point: on the blue-dress skin the
# skirt hides the thigh, so the narrowest row of the leg layer is the calf and
# the knee comes out 175 px low — a shin that swings from mid-calf. When the new
# skin shares the canvas and the pose of an existing one, the honest answer is
# to take its pivots rather than to measure a silhouette that is no longer a
# body.
if _args.reuse_pivots:
    import re

    _src = open(_args.reuse_pivots, encoding="utf-8").read()

    def _grab(const):
        m = re.search(
            const + r"\s*=\s*\{\s*r:\s*\[([-\d.]+),\s*([-\d.]+)\],\s*l:\s*\[([-\d.]+),\s*([-\d.]+)\]",
            _src,
        )
        if not m:
            raise SystemExit(f"could not read {const} from {_args.reuse_pivots}")
        return (float(m.group(1)), float(m.group(2))), (float(m.group(3)), float(m.group(4)))

    for _const, _store in (
        ("LACIA_KNEE", KNEES),
        ("LACIA_ELBOW", ELBOWS),
        ("LACIA_WRIST", WRISTS),
        ("LACIA_ANKLE", ANKLES),
    ):
        r, l = _grab(_const)
        _store["r"], _store["l"] = r, l
        print(f"  pivot {_const:12} reused -> r{r} l{l}")

# 2. typed manifest
lines = [
    "/**",
    f" * {_args.title} — generated by docs/lacia-rig/export_assets.py.",
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
    f"export const {NAME}_CANVAS = {{ w: {CW}, h: {CH} }} as const;",
    "",
    "/** Knee pivots, measured as the narrowest row of each leg's silhouette.",
    " *  The shin bone rotates here, so this number decides whether a bend reads",
    " *  as a knee or as a leg snapping in half. */",
    f"export const {NAME}_KNEE = {{",
    f"  r: [{KNEES['r'][0]}, {KNEES['r'][1]}],",
    f"  l: [{KNEES['l'][0]}, {KNEES['l'][1]}],",
    "} as const;",
    "",
    "/** Elbow pivots, same measurement on a narrower band — an arm's narrowest",
    " *  point overall is the wrist, so the elbow needs its own search window. */",
    f"export const {NAME}_ELBOW = {{",
    f"  r: [{ELBOWS['r'][0]}, {ELBOWS['r'][1]}],",
    f"  l: [{ELBOWS['l'][0]}, {ELBOWS['l'][1]}],",
    "} as const;",
    "/** Wrist pivots — measured inside each forearm crop, not the whole arm. */",
    f"export const {NAME}_WRIST = {{",
    f"  r: [{WRISTS['r'][0]}, {WRISTS['r'][1]}],",
    f"  l: [{WRISTS['l'][0]}, {WRISTS['l'][1]}],",
    "} as const;",
    "/** Ankle pivots — the boot cuff, i.e. the narrowest row of each boot. */",
    f"export const {NAME}_ANKLE = {{",
    f"  r: [{ANKLES['r'][0]}, {ANKLES['r'][1]}],",
    f"  l: [{ANKLES['l'][0]}, {ANKLES['l'][1]}],",
    "} as const;",
    "",
    "/** The rest of the skeleton, derived from the layers rather than hand-placed:",
    " *  a second character is a different width and her shoulders are somewhere",
    " *  else, so one global table would swing her arms about thin air. */",
    f"export const {NAME}_FRAME: Record<string, readonly [number, number]> = {{",
]
for _k, _v in FRAME.items():
    lines.append(f"  {_k}: [{_v[0]:.1f}, {_v[1]:.1f}],")
lines += ["};", ""]
lines.append(f"export const {NAME}_PARTS: readonly LaciaPart[] = [")
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
