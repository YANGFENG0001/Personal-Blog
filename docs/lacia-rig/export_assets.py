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
from PIL import Image, ImageChops, ImageDraw, ImageFilter
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
_ap.add_argument(
    "--source",
    default="",
    help="the aligned full figure (e.g. docs/seethrough-x/source.png); enables orphan recovery",
)
_ap.add_argument(
    "--punch-leg",
    action="store_true",
    help=(
        "clear topwear's alpha wherever the depth maps put the legs in front of it; "
        "for an open coat or a slit gown, not for a garment that really covers the thighs"
    ),
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


# 1. load every layer, then fix up the ones the split got the depth of
loaded = {}
for layer in meta["layers"]:
    loaded[layer["name"]] = Image.open(os.path.join(SRC, layer["filename"])).convert("RGBA")

# 1a. A garment can hide a limb that the artwork draws *in front of it*.
#
# See-through hands back one closed surface per semantic layer, so the evening
# gown's `topwear` is opaque straight across the slit and the techwear coat's is
# opaque across its open front: the interior shadow is real pixels in that
# layer. A garment belongs in front of the legs, so painted there that shadow
# covers the very thing the opening exists to show, and she reads as having no
# legs -- a grey panel where a thigh should be.
#
# The split does carry the answer, per pixel, in the depth maps it already
# writes: `*_depth.png` is 0 = nearest. Where the leg's depth is nearer than the
# top's, the illustration had the leg in front of the fabric, so the fabric has
# to be transparent there. Nothing is invented and nothing is redrawn -- the
# hole is punched in the alpha and the leg, which the rig paints over the
# skirt's lining, shows through it.
#
# **Opt-in, not automatic.** On the battle suit the same test reports the legs
# as nearer across the whole pelvis (rows 543-700 of a bodice that ends at 701),
# where the hip armour is genuinely in front and must stay. A per-pixel depth
# comparison cannot tell "armour over thigh" from "thigh over lining" when the
# two surfaces are nearly coplanar, so the call is made per skin.
def _punch_under(lower, upper, margin=8, solid=200):
    """Clear `upper`'s alpha wherever `lower` is solid and nearer than it.

    Both sides are compared in full-canvas space: the depth maps are cropped to
    their own layer's box (the leg's is 178x612, the top's 499x1044), so they are
    not even the same shape and cannot be compared directly.

    `margin` is half a depth quantum -- the maps are uint8 in steps of about 16,
    so without it a soft edge would punch a ragged hole along its own contour.
    `solid` keeps the punch off the limb's feathered rim, which is where the
    fabric behind it is still the correct thing to see.
    """
    by_name = {L["name"]: L for L in meta["layers"]}
    if lower not in loaded or upper not in loaded:
        return
    if not (by_name[lower].get("depth_filename") and by_name[upper].get("depth_filename")):
        return
    lo_im, up_im = loaded[lower], loaded[upper]

    def full(name, arr, fill):
        canvas = np.full((H, W), fill, dtype=arr.dtype)
        l, t = by_name[name]["left"], by_name[name]["top"]
        h, w = arr.shape[:2]
        canvas[t:t + h, l:l + w] = arr
        return canvas

    d_lo = np.array(Image.open(os.path.join(SRC, by_name[lower]["depth_filename"])).convert("L"), dtype=np.int16)
    d_up = np.array(Image.open(os.path.join(SRC, by_name[upper]["depth_filename"])).convert("L"), dtype=np.int16)
    a_lo = np.array(lo_im)[:, :, 3]
    if d_lo.shape != a_lo.shape or d_up.shape != (up_im.height, up_im.width):
        print(f"  ! depth map does not match its own layer for {lower}/{upper}, not punching")
        return

    mask = (full(lower, a_lo, 0) > solid) & (
        full(lower, d_lo, 255) < full(upper, d_up, 255) - margin
    )
    # back to the upper layer's own box
    l, t = by_name[upper]["left"], by_name[upper]["top"]
    mask = mask[t:t + up_im.height, l:l + up_im.width]
    if not mask.any():
        print(f"  {upper}: nothing to punch, {lower} is behind it everywhere")
        return
    # One pixel of feather so the hole's rim does not keep a hairline of the old
    # shadow, which would read as a drawn outline around the leg.
    keep = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    out = np.array(up_im).copy()
    out[:, :, 3] = (out[:, :, 3].astype(np.float32) * (np.array(keep).astype(np.float32) / 255.0)).astype(np.uint8)
    loaded[upper] = Image.fromarray(out)
    print(f"  {upper}: punched {int(mask.sum())} px where {lower} is in front")


if _args.punch_leg:
    _punch_under("legwear", "topwear")

# 2. build the full canvas once to find the character bbox
full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
for layer in meta["layers"]:
    full.alpha_composite(loaded[layer["name"]], (layer["left"], layer["top"]))

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


def big_components(img, share=0.05):
    """How many *substantial* connected blobs a layer's alpha contains.

    Erosion first so anti-aliasing does not bridge two limbs into one blob, and
    a 5% size floor so a speck of stray paint does not count as an arm.
    """
    a = np.array(img)[:, :, 3]
    mask = a > 24
    mask = ndimage.binary_erosion(mask, iterations=2)
    if not mask.any():
        return 0
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return sum(1 for s in sizes if s > mask.sum() * share)


def split_by_column(name, img, ox, oy, z, knee=False):
    """Separate two legs that are joined at the crotch, by the narrowest column.

    A one-piece bodysuit or a pair of tights is a single connected region from
    waist to ankle: no amount of erosion splits it, because the fabric really is
    continuous. But the silhouette still pinches between the thighs, so the
    narrowest column in the middle third is where the two legs meet. Cutting
    there leaves a sliver of overlap at the crotch, which is invisible (it is
    the same dark tone on both sides) and far better than a lower body with no
    knee at all.
    """
    arr = np.array(img)
    a = arr[:, :, 3] > 24
    h, w = a.shape
    col = a.sum(axis=0)
    lo, hi = int(w * 0.30), int(w * 0.70)
    cut = lo + int(np.argmin(col[lo:hi]))
    # The dip has to be a real gap. A gown covers one leg completely, so its
    # `legwear` is a single limb: the "narrowest column" is then just the edge of
    # that limb, and cutting there produces one leg plus a sliver of nothing --
    # which is how the gown ended up with a knee at y=871 and the other at y=536.
    # A genuine crotch dip is a fraction of the peak; an edge is most of it.
    if col[cut] > col.max() * 0.35:
        print(f"  {name}: no gap between the legs (min {int(col[cut])} of {int(col.max())}), keeping whole")
        return False
    print(f"  {name}: joined at the crotch, cutting at column {cut}/{w}")
    for nm, sl in ((f"{name}-r", slice(0, cut)), (f"{name}-l", slice(cut, w))):
        out = arr.copy()
        keep = np.zeros(w, bool)
        keep[sl] = True
        out[:, ~keep] = 0
        if knee:
            split_joint(nm, out, ox, oy, z, "knee")
        else:
            add(nm, Image.fromarray(out), ox, oy, z)
    return True


def split_lr(name, img, ox, oy, z, knee=False, arm=False):
    """Split a merged two-limb layer into left / right halves by connected components."""
    a = np.array(img)[:, :, 3]
    mask = a > 24
    # erode a touch so the two legs are not bridged by anti-aliasing
    mask = ndimage.binary_erosion(mask, iterations=2)
    lab, n = ndimage.label(mask)
    if n < 2:
        # A one-piece lower body (tights, a bodysuit) is genuinely continuous,
        # so connected components cannot help. A short fused shape -- the chibi
        # -- is left whole on purpose: there is no knee to find in a 200px leg
        # and cutting it in half would only add a seam.
        if knee and a.shape[0] > 400 and split_by_column(name, img, ox, oy, z, knee=True):
            return
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
    if len(boxes) < 2:
        # Several components but only one substantial one: the other half is
        # noise, so there is no pair to split. Same fallback as above.
        if knee and a.shape[0] > 400 and split_by_column(name, img, ox, oy, z, knee=True):
            return
        print(f"  !! {name}: {len(boxes)} substantial component, keeping whole")
        add(name, img, ox, oy, z)
        return
    # left in image space = smaller x; the figure faces us, so image-left is her right
    names = [f"{name}-r", f"{name}-l"]
    arr = np.array(img)
    for nm, b in zip(names, boxes):
        cx, bx0, by0, bx1, by1, k = b
        m = ndimage.binary_dilation(lab == k, iterations=2)
        out = arr.copy()
        out[~m] = 0
        if knee:
            split_joint(nm, out, ox, oy, z, "knee")
        elif arm:
            split_arm(nm, out, ox, oy, z)
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
    # A layer with a handful of opaque pixels is the empty half of a pair the
    # split failed to merge — measuring a joint in it finds no silhouette and
    # crashes on an empty row list. Skipping is the honest reading: there is no
    # limb in there to rig.
    if np.array(img)[:, :, 3].astype(bool).sum() < 64:
        print(f"  -- {name}: effectively empty, skipped")
        continue
    Z += 1
    if name in ("legwear", "footwear"):
        split_lr(name, img, ox, oy, Z, knee=(name == "legwear"))
    elif name in ("handwear-l", "handwear-r"):
        # Which arm the *name* claims is not evidence. See-through groups by
        # semantic part, and on the 小晴 run it put both sleeves into one layer
        # called `handwear-l` — a 476x666 crop spanning the whole figure — while
        # `handwear-r` came back as a two-pixel sliver. Splitting on the count
        # of connected blobs instead handles both shapes of the data: two blobs
        # means two arms and they have to be separated first, one blob means
        # this layer already is one arm and only needs the two cuts.
        if big_components(img) >= 2:
            split_lr("handwear", img, ox, oy, Z, arm=True)
        else:
            split_arm(name, np.array(img), ox, oy, Z)
    else:
        add(name, img, ox, oy, Z)

# 2a. the face plate.
#
# Some splits hand back the features (nose, mouth, eyewhite, eyelash) with no
# skin behind them. The figure then renders as eyes and a mouth floating on
# hair: every part is present, the face is not. The splitter did not get
# anything wrong -- it simply has no slot called "skin".
#
# Recovering it is subtraction, not drawing: those pixels exist in the
# illustration and in no layer. An ellipse rather than the raw rectangle,
# because a hard crop of the face box carries a rim of fringe on all four
# sides, and a feather so the plate can sit under the fringe without a seam.
_by_id = {p["id"]: p for p in parts}

FACE_FEATURE_IDS = {
    "eyebrow-r", "eyebrow-l", "eyewhite-r", "eyewhite-l",
    "eyelash-r", "eyelash-l", "irides-r", "irides-l", "nose", "mouth",
}


def _face_box():
    """The face rectangle: measured if the split produced a plate, else derived.

    The features span brow-to-mouth. A face needs the forehead above and the
    chin below; both are a fraction of that span again. This is the same box the
    head pivot is derived from, so the two cannot disagree about where her chin
    is.
    """
    fc = _by_id.get("face")
    if fc is not None:
        return fc
    feats = [p for p in parts if p["id"] in FACE_FEATURE_IDS]
    if not feats:
        raise SystemExit("face: no 'face' layer and no facial features to derive one from")
    top = min(p["y"] for p in feats)
    bot = max(p["y"] + p["h"] for p in feats)
    left = min(p["x"] for p in feats)
    right = max(p["x"] + p["w"] for p in feats)
    span = bot - top
    cx = (left + right) / 2.0
    fw = max(right - left, span) * 1.12
    fh = span * 1.55
    return {"x": cx - fw / 2.0, "y": top - span * 0.28, "w": fw, "h": fh}


if "face" not in _by_id and _args.source:
    _fb = _face_box()
    _src = Image.open(_args.source).convert("RGBA")
    _sb = _src.getbbox()
    if not _sb:
        raise SystemExit(f"face: {_args.source} is empty")
    _ref = _src.crop(_sb).resize((CW, CH), Image.LANCZOS)
    _box = (
        max(0, int(_fb["x"])),
        max(0, int(_fb["y"])),
        min(CW, int(_fb["x"] + _fb["w"])),
        min(CH, int(_fb["y"] + _fb["h"])),
    )
    _plate = _ref.crop(_box)
    _pw, _ph = _plate.size
    _mask = Image.new("L", (_pw, _ph), 0)
    # Inset by a few px so the ellipse stays inside the skin at every side.
    _inset = max(2, int(min(_pw, _ph) * 0.04))
    ImageDraw.Draw(_mask).ellipse((_inset, _inset, _pw - 1 - _inset, _ph - 1 - _inset), fill=255)
    _mask = _mask.filter(ImageFilter.GaussianBlur(max(2, _inset)))
    _plate.putalpha(ImageChops.multiply(_plate.getchannel("A"), _mask))
    _fn = "face.webp"
    _plate.save(os.path.join(OUT, _fn), "WEBP", quality=92, method=6)
    # Above the clothes, below the features. The fringe is painted last of all
    # (`front hair` has the highest z in every split), so the forehead stays
    # covered by hair and the plate never shows a straight edge there.
    _z = (_by_id.get("topwear", {}).get("z", 1)) + 0.5
    parts.append(
        {"id": "face", "file": _fn, "x": _box[0], "y": _box[1], "w": _pw, "h": _ph, "z": _z}
    )
    _by_id["face"] = parts[-1]
    print(f"  face (recovered) {_pw}x{_ph} at ({_box[0]},{_box[1]}) z={_z}")

# 2b. orphans — the thin things the split dropped.
#
# The splitter assigns *semantic parts*, so it has no slot for a loose braid, a
# dangling strap, a single strand of hair. Those come back in no layer at all
# and the figure is quietly missing a piece of its own design: 小晴's side braid
# was a 178x66 strand that vanished, leaving a plain bob.
#
# Guessing it back would be inventing art. Subtracting does not: whatever is in
# the source and in no layer is, by definition, the part that was lost. So the
# recovered pixels become one extra layer with its own id, painted last. That
# ordering is the one assumption here — a dropped element that belonged *behind*
# something would come back in front — but a dropped element is thin and mostly
# at the silhouette edge, where nothing covers it anyway.
if _args.source:
    _src = Image.open(_args.source).convert("RGBA")
    _sb = _src.getbbox()
    if not _sb:
        raise SystemExit(f"orphans: {_args.source} is empty")
    _ref = _src.crop(_sb).resize((CW, CH), Image.LANCZOS)
    _covered = np.zeros((CH, CW), np.float32)
    for _p in parts:
        _a = np.array(Image.open(os.path.join(OUT, _p["file"])).convert("RGBA"))[:, :, 3] / 255.0
        _win = _covered[_p["y"] : _p["y"] + _p["h"], _p["x"] : _p["x"] + _p["w"]]
        np.maximum(_win, _a[: _win.shape[0], : _win.shape[1]], out=_win)
    _ink = np.array(_ref)[:, :, 3] / 255.0
    _lost = (_ink > 0.35) & (_covered < 0.35)
    # A real dropped element has an interior; a contour stroke does not. Two
    # erosions, not one: a 1-px registration difference between the source and
    # the layer composite traces the whole silhouette as an "orphan", and the
    # chibi's lineart is 5 px thick, so two passes still left a contour standing.
    # 小晴's braid is 12–18 px and survives three comfortably. Without this the
    # chibi "recovered" a 207x788 frame of edge slivers.
    _core = ndimage.binary_erosion(_lost, iterations=3)
    _lab, _n = ndimage.label(_core)
    if _n:
        _sizes = ndimage.sum(_core, _lab, range(1, _n + 1))
        # The floor applies to the *eroded* core, so it is smaller than the
        # 200 px above: two erosions take a 3-px-wide line to nothing and a real
        # object down to its middle.
        _keep = [i + 1 for i, s in enumerate(_sizes) if s > 100]
        if _keep:
            _core_keep = np.isin(_lab, _keep)
            _m = _lost & ndimage.binary_dilation(_core_keep, iterations=3)
            _out = np.array(_ref)
            _out[~ndimage.binary_dilation(_m, iterations=1)] = 0
            _ys, _xs = np.where(_m)
            _box = (
                max(0, int(_xs.min()) - 2),
                max(0, int(_ys.min()) - 2),
                min(CW, int(_xs.max()) + 3),
                min(CH, int(_ys.max()) + 3),
            )
            _fn = "orphan.webp"
            Image.fromarray(_out).crop(_box).save(os.path.join(OUT, _fn), "WEBP", quality=92, method=6)
            parts.append(
                {
                    "id": "orphan",
                    "file": _fn,
                    "x": _box[0],
                    "y": _box[1],
                    "w": _box[2] - _box[0],
                    "h": _box[3] - _box[1],
                    "z": max(p["z"] for p in parts) + 1,
                }
            )
            print(f"  orphan           {_box[2]-_box[0]}x{_box[3]-_box[1]} at ({_box[0]},{_box[1]}) — recovered {int(_m.sum())} px")
        else:
            print("  orphan           none (only outline slivers were uncovered)")
    else:
        print("  orphan           none (split lost nothing significant)")

# 2c. ankles without a footwear layer.
#
# The ankle bone exists so the sole can stay level while the shin swings. It is
# measured at the boot cuff, which needs the shoes to be their own layer. On a
# chibi they are a few pixels at the bottom of each leg, so the splitter keeps
# them inside `legwear-*-lo` and there is no cuff to find.
#
# The honest pivot then is the sole: the bottom centre of the lower leg. It is
# not a compromise — a boot welded into the shin cannot tilt, so the ankle bone
# has nothing to hold level, and putting its pivot at the sole makes it a no-op
# instead of a joint that swings the foot about mid-shin.
if not ANKLES:
    _tmp = {p["id"]: p for p in parts}
    for _side in ("r", "l"):
        # `legwear` alone means the legs were never separated (see `_frame`);
        # both ankles then come off the same fused shape.
        _p = _tmp.get(f"legwear-{_side}-lo") or _tmp.get("legwear")
        if _p is None:
            raise SystemExit(f"ankle: no footwear layer and no leg layer for {_side}")
        ANKLES[_side] = (round(_p["x"] + _p["w"] / 2.0, 1), _p["y"] + _p["h"] - 1)
        print(f"  ankle {_side}: no footwear layer, sole pivot {ANKLES[_side]}")

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
    # Offsets are canvas units, and they were read off the battle suit's 1276-px
    # canvas. A chibi's canvas is 960 and her whole head is half of it, so the
    # same "40 px above the hip" would put her chest inside her chin. Scaling by
    # the canvas height keeps the ratios and leaves Lacia's numbers untouched.
    k = CH / 1276.0
    tw = _need("topwear")
    nk = _by_id.get("neck")
    fc = _face_box()
    ar = _need("handwear-r-up")
    al = _need("handwear-l-up")
    lr_ = _by_id.get("legwear-r-up")
    ll = _by_id.get("legwear-l-up")
    if lr_ is None or ll is None:
        # The legs were never separated: on a chibi the thighs touch, so no
        # amount of erosion finds two blobs. The hip is then the centre of the
        # leg mass, which is where a fused lower body actually pivots.
        merged = _by_id.get("legwear")
        if merged is None:
            raise SystemExit("frame: no leg layers at all")
        lr_ = ll = merged

    bw = _by_id.get("bottomwear")
    if bw is not None:
        # A skirt or trousers layer starts at the waist, and that edge is the
        # best measurement of the pelvis: it does not move when the top happens
        # to be long. The battle suit has no such layer, so it falls through.
        hip_y = bw["y"]
    else:
        hip_y = tw["y"] + tw["h"]
        if lr_ is not None and hip_y > lr_["y"] + 0.06 * CH:
            # No lower-body layer and the top reaches well past the top of the
            # legs: that is a coat, not a shirt. Its hem is down at her calves,
            # and a root there bends the whole figure at the shin -- the techwear
            # split put `topwear` from the shoulder to y=1079 on a 1266 canvas.
            hip_y = lr_["y"]
    hip_x = (_cx(lr_) + _cx(ll)) / 2.0
    face_bottom = fc["y"] + fc["h"]
    # The neck sits under the chin, so its x is the chin's x. Some art has no
    # separate neck layer at all — a chibi's collar swallows it — and inventing
    # a horizontal offset from a layer that does not exist is not an option.
    neck_x = _cx(nk) if nk else _cx(fc)

    # The bust pivot, i.e. where the `torso` spring hangs the topwear layer.
    #
    # `topwear`'s bbox centre is only a proxy for the ribcage while the top ends
    # at the hip. On a bodice it lands there; on a floor-length gown it lands at
    # her knees (y=729 against a pelvis at 536), and on the techwear coat at
    # y=620 against 471. A pivot *inside* the skirt is not a cosmetic error: the
    # `torsoR` spring then rotates the bodice one way and the hem the other, so
    # the whole figure reads as rocking on a hidden hinge -- measured head/hem
    # correlation -0.96 where a standing figure should be positive. The clamp
    # puts the pivot back on the ribcage: between a fifth and a little over half
    # of the way up from the pelvis to the chin.
    span = max(1.0, hip_y - face_bottom)
    torso_y = tw["y"] + tw["h"] / 2.0
    torso_y = min(torso_y, hip_y - 0.20 * span)
    torso_y = max(torso_y, hip_y - 0.55 * span)
    return {
        "root": (hip_x, hip_y),
        "hips": (hip_x, hip_y),
        "spine": (hip_x, hip_y),
        "chest": (hip_x, hip_y - 40 * k),
        "torso": (_cx(tw), torso_y),
        "neck": (neck_x, face_bottom + 24 * k),
        "head": (_cx(fc), face_bottom - 4 * k),
        "hairFront": (_cx(fc), face_bottom - 30 * k),
        "hairBack": (_cx(fc), face_bottom),
        "armR": (ar["x"] + ar["w"] * 0.75, ar["y"] + ar["h"] * 0.11),
        "armL": (al["x"] + al["w"] * 0.25, al["y"] + al["h"] * 0.11),
        # The thigh bone starts at the hip, not at the top of whatever the split
        # called `legwear`. On the battle suit those are the same row; on a
        # pleated skirt the layer starts below the hem, and on a slit gown one
        # leg is covered to the knee while the other is bare from the thigh --
        # so the two `legwear` tops sat 335px apart and the legs would have
        # swung about two different heights.
        "legR": (_cx(lr_), hip_y + 16 * k),
        "legL": (_cx(ll), hip_y + 16 * k),
    }


FRAME = _frame()

# A fused lower body has no knee to measure either. Pinning the knee to the hip
# makes the shin rotate about the hip alongside the thigh — which is precisely
# what "this leg does not bend" looks like — while every downstream consumer
# still gets a number. The alternative, guessing a knee at 45% of a shape that
# has no pinch, is the broken-doll rig the bands above exist to prevent.
if not KNEES:
    KNEES["r"], KNEES["l"] = FRAME["legR"], FRAME["legL"]
    print("  knee: legs never separated — knee pinned to the hip (rigid lower body)")

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
