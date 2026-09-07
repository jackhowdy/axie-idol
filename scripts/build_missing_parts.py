"""
Best-effort build of the part variants the public mixer pack does not ship.

The public pack covers 576 of the 606 part/stage/skin variants. The 30 missing ones are:
  - 24 "nas-N" parts (skin 13, stage 2): the shiny versions of the Nightmare (skin 12) parts.
    Shiny keeps the mesh and repaints the colours. We learn each part's colour mapping from
    Sky Mavis's own marketplace part icons (normal vs shiny, downloaded into scripts/.cache/parts/):
    the coloured pixels of each icon are clustered, clusters are paired by shading rank, and the
    per-cluster hue/saturation/value change is applied to the S12 texture. That carries the accent
    colours (a yellow drip, a teal ribbon) instead of one global hue shift.
  - 6 "agamo" parts (skin 2): no Agamo art is reachable, so we reuse the normal-skin (S00) mesh and
    shift its palette to a teal/violet treatment. This is an approximation, not the real art.

Run after scripts/copy-mixer-assets.mjs (which overwrites the manifest):
  <python> scripts/build_missing_parts.py [--sheet out.png]

Writes: public/assets/axie/textures/derived/<sha256>.png, updates manifest.json in place,
and records what was derived in public/assets/axie/provenance/derived-parts.json.
"""
from __future__ import annotations

import copy
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "public" / "assets" / "axie"
MANIFEST = PACK / "manifest.json"
DERIVED_DIR = PACK / "textures" / "derived"
PROVENANCE = PACK / "provenance" / "derived-parts.json"
ICON_CACHE = ROOT / "scripts" / ".cache" / "parts"
ICON_URL = "https://cdn.axieinfinity.com/marketplace-website/asset-icon/parts/{id}.png"

TYPE_ID = {"eyes": "Eye", "ears": "Ear", "mouth": "Mouth", "horn": "Horn", "back": "Back", "tail": "Tail"}

# Pack part id -> marketplace part id (stage 2). Verified by decoding the genes of real Nightmare
# Axies and pairing each slot with the marketplace's part list (7 Sep 2026).
NIGHTMARE_ICON = {
    "S12_Aquatic04_L2_Eye": "eyes-hazy-2",
    "S12_Aquatic04_L2_Mouth": "mouth-bottom-dweller-2",
    "S12_Aquatic04_L2_Tail": "tail-bloodfin-2",
    "S12_Aquatic06_L2_Back": "back-tendrils-2",
    "S12_Beast04_L2_Eye": "eyes-molten-peas-2",
    "S12_Beast04_L2_Mouth": "mouth-dark-kiss-2",
    "S12_Beast04_L2_Tail": "tail-angry-grain-2",
    "S12_Beast06_L2_Back": "back-shrunken-skulls-2",
    "S12_Bird04_L2_Ear": "ears-forever-late-2",
    "S12_Bird04_L2_Mouth": "mouth-doombringer-2",
    "S12_Bird06_L2_Horn": "horn-unholy-terror-2",
    "S12_Bird06_L2_Tail": "tail-evil-eye-2",
    "S12_Bug04_L2_Horn": "horn-dark-antenna-2",
    "S12_Bug04_L2_Mouth": "mouth-poisonous-pincer-2",
    "S12_Bug04_L2_Tail": "tail-earwig-2",
    "S12_Bug06_L2_Ear": "ears-blood-sucker-2",
    "S12_Plant04_L2_Ear": "ears-possessed-lotus-2",
    "S12_Plant04_L2_Eye": "eyes-hypnotized-2",
    "S12_Plant06_L2_Back": "back-petalworts-2",
    "S12_Plant06_L2_Horn": "horn-piranhaplant-2",
    "S12_Reptile04_L2_Ear": "ears-dragon-ears-2",
    "S12_Reptile04_L2_Eye": "eyes-fiery-gaze-2",
    "S12_Reptile06_L2_Back": "back-nightmare-wings-2",
    "S12_Reptile06_L2_Horn": "horn-killah-clamp-2",
}

AGAMO_PRIMARY_DEG = 175  # teal
AGAMO_SECONDARY_SHIFT_DEG = 120
CLUSTERS = 4
SAT_COLOURED = 0.16


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_json(obj) -> str:
    return sha256_bytes(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def part_id(cls: str, value: int, level: int, part_type: str, skin: int) -> str:
    return f"S{skin:02d}_{cls.capitalize()}{value:02d}_L{level}_{TYPE_ID[part_type]}"


def expected_ids(manifest) -> list[tuple[str, str]]:
    """All (id, legacy skin label) pairs the creator rows describe."""
    out = []
    for row in manifest["creator"]["legacyPartRows"]:
        for level, arr in ((1, row["skins"]), (2, row["skinsLv2"])):
            for skin, label in enumerate(arr):
                if label:
                    out.append((part_id(row["class"], row["partValue"], level, row["partType"], skin), label))
    return out


# ---------------------------------------------------------------- colour maths

def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    d = mx - mn
    nz = d > 1e-6
    safe = np.where(nz, d, 1)
    rc = (mx - r) / safe
    gc = (mx - g) / safe
    bc = (mx - b) / safe
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2.0 + rc - bc, 4.0 + gc - rc))
    h = np.where(nz, (h / 6.0) % 1.0, 0.0)
    s = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0.0)
    return h, s, mx


def hsv_to_rgb(h: np.ndarray, s: np.ndarray, v: np.ndarray) -> np.ndarray:
    i = np.floor(h * 6.0).astype(int) % 6
    f = h * 6.0 - np.floor(h * 6.0)
    p = v * (1 - s)
    q = v * (1 - s * f)
    t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=-1)


def hue_dist(h: np.ndarray, center: float) -> np.ndarray:
    d = np.abs(h - center)
    return np.minimum(d, 1.0 - d)


def circ_mean(h: np.ndarray) -> float:
    ang = h * 2 * np.pi
    return float((np.arctan2(np.sin(ang).sum(), np.cos(ang).sum()) / (2 * np.pi)) % 1.0)


def hue_feature(h: np.ndarray, s: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Embed HSV on a cone so k-means distances respect hue wrap-around."""
    ang = h * 2 * np.pi
    return np.stack([np.cos(ang) * s, np.sin(ang) * s, v * 0.6], axis=-1)


def kmeans(x: np.ndarray, k: int, iters: int = 25, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    if len(x) <= k:
        return np.arange(len(x))
    centers = x[rng.choice(len(x), k, replace=False)]
    labels = np.zeros(len(x), dtype=int)
    for _ in range(iters):
        d = ((x[:, None, :] - centers[None, :, :]) ** 2).sum(-1)
        labels = d.argmin(1)
        for j in range(k):
            m = labels == j
            centers[j] = x[m].mean(0) if m.any() else x[rng.integers(len(x))]
    return labels


class Cluster:
    def __init__(self, h: float, s: float, v: float, mass: float):
        self.h, self.s, self.v, self.mass = h, s, v, mass


def icon_clusters(png: Path) -> tuple[list[Cluster], Cluster | None]:
    """Coloured clusters (sorted dark -> light) plus the neutral (low-saturation) mean of an icon."""
    im = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32) / 255.0
    a = im[..., 3] > 0.8
    rgb = im[..., :3][a]
    h, s, v = rgb_to_hsv(rgb)
    keep = (v > 0.12) & ~((v < 0.3) & (s < 0.35))  # drop the black outline
    h, s, v = h[keep], s[keep], v[keep]
    col = s >= SAT_COLOURED
    clusters: list[Cluster] = []
    if col.sum() >= 40:
        feats = hue_feature(h[col], s[col], v[col])
        k = min(CLUSTERS, max(1, int(col.sum()) // 40))
        labels = kmeans(feats, k)
        for j in range(k):
            m = labels == j
            if m.sum() < 12:
                continue
            clusters.append(Cluster(circ_mean(h[col][m]), float(s[col][m].mean()), float(v[col][m].mean()), float(m.sum())))
    clusters.sort(key=lambda c: c.v)
    neutral = None
    if (~col).sum() >= 40:
        neutral = Cluster(circ_mean(h[~col]), float(s[~col].mean()), float(v[~col].mean()), float((~col).sum()))
    return clusters, neutral


def load_icon(png: Path) -> np.ndarray:
    return np.asarray(Image.open(png).convert("RGBA")).astype(np.float32) / 255.0


def bbox(alpha: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(alpha > 0.5)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def align_icons(normal: np.ndarray, shiny: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """Crop both icons to their alpha bounding boxes and resize the shiny one onto the normal one.
    Shiny parts are repaints of the same drawing, so this gives pixel correspondence."""
    nb, sb = bbox(normal[..., 3]), bbox(shiny[..., 3])
    n = normal[nb[1]:nb[3], nb[0]:nb[2]]
    s = shiny[sb[1]:sb[3], sb[0]:sb[2]]
    s_img = Image.fromarray((s * 255 + 0.5).astype(np.uint8), "RGBA").resize((n.shape[1], n.shape[0]), Image.BILINEAR)
    s = np.asarray(s_img).astype(np.float32) / 255.0
    a, b = n[..., 3] > 0.5, s[..., 3] > 0.5
    iou = float((a & b).sum() / max(1, (a | b).sum()))
    return n, s, iou


def pixel_pairs(normal_icon: Path, shiny_icon: Path) -> tuple[list[tuple[Cluster, Cluster]], float]:
    """Cluster the normal icon's paint and, for each cluster, take the mean shiny colour at the same
    pixels. Outline pixels (dark, unsaturated) are excluded on both sides."""
    n, s, iou = align_icons(load_icon(normal_icon), load_icon(shiny_icon))
    both = (n[..., 3] > 0.8) & (s[..., 3] > 0.8)
    nh, ns, nv = rgb_to_hsv(n[..., :3])
    sh, ss, sv = rgb_to_hsv(s[..., :3])
    paint = both & ~((nv < 0.3) & (ns < 0.35)) & ~((sv < 0.3) & (ss < 0.35)) & (nv > 0.12) & (sv > 0.12)
    if paint.sum() < 60:
        return [], iou
    feats = hue_feature(nh[paint], ns[paint], nv[paint])
    k = min(6, max(1, int(paint.sum()) // 60))
    labels = kmeans(feats, k)
    pairs: list[tuple[Cluster, Cluster]] = []
    for j in range(k):
        m = labels == j
        if m.sum() < max(12, 0.004 * paint.sum()):
            continue
        src = Cluster(circ_mean(nh[paint][m]), float(ns[paint][m].mean()), float(nv[paint][m].mean()), float(m.sum()))
        dst = Cluster(circ_mean(sh[paint][m]), float(ss[paint][m].mean()), float(sv[paint][m].mean()), float(m.sum()))
        pairs.append((src, dst))
    return pairs, iou


def transfer(png_path: Path, normal_icon: Path, shiny_icon: Path) -> tuple[bytes, dict]:
    """Recolour a pack texture with the normal->shiny mapping learned from the two icons."""
    pairs, iou = pixel_pairs(normal_icon, shiny_icon)
    src_neutral = dst_neutral = None
    # neutral (unsaturated) paint is handled by its own pair if the icon has one
    for c, t in pairs:
        if c.s < SAT_COLOURED and (src_neutral is None or c.mass > src_neutral.mass):
            src_neutral, dst_neutral = c, t
    pairs = [(c, t) for c, t in pairs if c.s >= SAT_COLOURED]

    im = Image.open(png_path)
    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    im = im.convert("RGBA") if has_alpha else im.convert("RGB")
    arr = np.asarray(im).astype(np.float32) / 255.0
    h, s, v = rgb_to_hsv(arr[..., :3])
    h2, s2, v2 = h.copy(), s.copy(), v.copy()

    coloured = s >= SAT_COLOURED
    if pairs:
        feats = hue_feature(h, s, v)
        centers = np.stack([hue_feature(np.array(c.h), np.array(c.s), np.array(c.v)) for c, _ in pairs])
        d = ((feats[..., None, :] - centers[None, None, :, :]) ** 2).sum(-1)  # HxWxK
        order = np.argsort(d, axis=-1)
        n1 = order[..., 0]
        n2 = order[..., 1] if len(pairs) > 1 else order[..., 0]
        d1 = np.take_along_axis(d, n1[..., None], -1)[..., 0]
        d2 = np.take_along_axis(d, n2[..., None], -1)[..., 0]
        w1 = np.where(d1 + d2 > 1e-6, d2 / (d1 + d2 + 1e-6), 1.0)
        w1 = np.clip((w1 - 0.5) * 4 + 0.5, 0, 1)  # mostly nearest, blend only near boundaries
        dh = np.array([((t.h - c.h + 0.5) % 1.0) - 0.5 for c, t in pairs])
        rs = np.array([t.s / max(c.s, 1e-3) for c, t in pairs])
        rv = np.array([t.v / max(c.v, 1e-3) for c, t in pairs])
        dhp = w1 * dh[n1] + (1 - w1) * dh[n2]
        rsp = w1 * rs[n1] + (1 - w1) * rs[n2]
        rvp = w1 * rv[n1] + (1 - w1) * rv[n2]
        h2 = np.where(coloured, (h + dhp) % 1.0, h)
        s2 = np.where(coloured, np.clip(s * rsp, 0, 1), s)
        v2 = np.where(coloured, np.clip(v * np.clip(rvp, 0.6, 1.5), 0, 1), v)
    if src_neutral and dst_neutral and dst_neutral.s > 0.12:
        # the shiny recolours the greys too (e.g. Hazy's pale green -> pale pink)
        n = ~coloured & (v > 0.35)
        h2 = np.where(n, dst_neutral.h, h2)
        s2 = np.where(n, np.clip(np.maximum(s, 0.05) * (dst_neutral.s / max(src_neutral.s, 0.05)), 0, 0.6), s2)
    out_arr = arr.copy()
    out_arr[..., :3] = hsv_to_rgb(h2, s2, v2)
    out = Image.fromarray((np.clip(out_arr, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA" if has_alpha else "RGB")
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    info = {
        "iconAlignmentIoU": round(iou, 3),
        "clusters": [
            {"from": [round(c.h * 360), round(c.s, 2), round(c.v, 2)], "to": [round(t.h * 360), round(t.s, 2), round(t.v, 2)]}
            for c, t in pairs
        ]
    }
    return buf.getvalue(), info


def dominant_hue(h: np.ndarray, s: np.ndarray, v: np.ndarray) -> float | None:
    mask = (s > 0.25) & (v > 0.25)
    if mask.sum() < 50:
        return None
    hist, edges = np.histogram(h[mask], bins=36, range=(0.0, 1.0))
    hist = hist + np.roll(hist, 1) + np.roll(hist, -1)
    k = int(np.argmax(hist))
    return (edges[k] + edges[k + 1]) / 2.0


def recolour_agamo(png_path: Path) -> bytes:
    im = Image.open(png_path)
    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    im = im.convert("RGBA") if has_alpha else im.convert("RGB")
    arr = np.asarray(im).astype(np.float32) / 255.0
    h, s, v = rgb_to_hsv(arr[..., :3])
    dom = dominant_hue(h, s, v)
    out = im
    if dom is not None:
        band = (hue_dist(h, dom) <= 40 / 360) & (s > 0.18)
        shift = (AGAMO_PRIMARY_DEG / 360) - dom
        h2 = np.where(band, (h + shift) % 1.0, h)
        other = (~band) & (s > 0.35) & (v > 0.3)
        h2 = np.where(other, (h + AGAMO_SECONDARY_SHIFT_DEG / 360) % 1.0, h2)
        s2 = np.where(band | other, np.minimum(1.0, s * 1.15), s)
        out_arr = arr.copy()
        out_arr[..., :3] = hsv_to_rgb(h2, s2, v)
        out = Image.fromarray((np.clip(out_arr, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA" if has_alpha else "RGB")
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- icons

def icon_path(part_id: str) -> Path:
    ICON_CACHE.mkdir(parents=True, exist_ok=True)
    p = ICON_CACHE / f"{part_id}.png"
    if not p.exists():
        req = urllib.request.Request(ICON_URL.format(id=part_id), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            p.write_bytes(r.read())
    return p


def local_path(url: str) -> Path:
    assert url.startswith("/assets/axie/"), url
    return PACK / url[len("/assets/axie/"):]


# ---------------------------------------------------------------- main

def main(argv: list[str]) -> int:
    sheet_path = Path(argv[argv.index("--sheet") + 1]) if "--sheet" in argv else None
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    parts = manifest["assets"]["parts"]
    mats = manifest["assets"]["materials"]
    texs = manifest["assets"]["textures"]
    by_type = manifest["creator"]["partIdsByType"]

    prev = json.loads(PROVENANCE.read_text(encoding="utf-8")) if PROVENANCE.exists() else {}
    for pid in prev.get("parts", {}):
        parts.pop(pid, None)
        for lst in by_type.values():
            if pid in lst:
                lst.remove(pid)
    for mid in prev.get("materials", []):
        mats.pop(mid, None)
    for tid in prev.get("textures", []):
        texs.pop(tid, None)

    DERIVED_DIR.mkdir(parents=True, exist_ok=True)
    PROVENANCE.parent.mkdir(parents=True, exist_ok=True)
    prov = {"generatedBy": "scripts/build_missing_parts.py", "parts": {}, "materials": [], "textures": []}
    tex_cache: dict[tuple[str, str], tuple[str, bytes]] = {}
    sheet_rows: list[tuple[str, Path, Path, Path, bytes]] = []
    built = 0

    for pid, label in expected_ids(manifest):
        if pid in parts:
            continue
        skin = int(pid[1:3])
        if skin == 13:
            src_id, mode = "S12" + pid[3:], "shiny"
            note = f"shiny of {src_id}: colour mapping learned from marketplace icons {NIGHTMARE_ICON.get(src_id)} vs shiny"
        elif skin == 2:
            src_id, mode = "S00" + pid[3:], "agamo"
            note = "normal (S00) mesh with a teal/violet palette; approximation (no Agamo reference reachable)"
        else:
            print(f"skip {pid} ({label}): no rule for skin {skin}", file=sys.stderr)
            continue
        src = parts.get(src_id)
        if not src:
            print(f"skip {pid}: source {src_id} missing", file=sys.stderr)
            continue

        part = copy.deepcopy(src)
        part["id"] = pid
        part["descriptor"] = dict(src["descriptor"], skin=skin)
        info: dict = {}
        for rig in part["rigs"]:
            mat = copy.deepcopy(mats[rig["materialId"]])
            tex_id = mat["textures"]["_MainTex"]
            tex = copy.deepcopy(texs[tex_id])
            src_png = tex["variants"].get("unity-import") or tex["variants"]["source"]
            key = (src_png, mode + pid)
            if key not in tex_cache:
                if mode == "shiny":
                    icon = NIGHTMARE_ICON[src_id]
                    normal_icon, shiny_icon = icon_path(icon), icon_path(icon.replace("-2", "-shiny-2"))
                    png, info = transfer(local_path(src_png), normal_icon, shiny_icon)
                    sheet_rows.append((pid, normal_icon, shiny_icon, local_path(src_png), png))
                else:
                    png = recolour_agamo(local_path(src_png))
                tex_cache[key] = (sha256_bytes(png), png)
            sha, png = tex_cache[key]
            out_file = DERIVED_DIR / f"{sha}.png"
            if not out_file.exists():
                out_file.write_bytes(png)
            url = f"/assets/axie/textures/derived/{sha}.png"
            new_tex_id = f"{sha[:32]}:2800000"
            tex["id"] = new_tex_id
            tex["variants"] = {"source": url, "unity-import": url}
            tex["unityContentHash"] = sha
            tex.pop("contentHash", None)
            tex["contentHash"] = sha256_json(tex)
            texs[new_tex_id] = tex
            if new_tex_id not in prov["textures"]:
                prov["textures"].append(new_tex_id)

            new_mat_id = hashlib.md5(f"{pid}:{rig['type']}".encode()).hexdigest() + ":2100000"
            mat["id"] = new_mat_id
            mat["sourceName"] = f"Derived/{pid}_{rig['type']}"
            mat["textures"]["_MainTex"] = new_tex_id
            if isinstance(mat.get("properties", {}).get("_MainTex"), dict):
                mat["properties"]["_MainTex"]["textureId"] = new_tex_id
            mat.pop("contentHash", None)
            mat["contentHash"] = sha256_json(mat)
            mats[new_mat_id] = mat
            prov["materials"].append(new_mat_id)
            rig["materialId"] = new_mat_id

        part.pop("contentHash", None)
        part["contentHash"] = sha256_json(part)
        parts[pid] = part
        ptype = part["descriptor"]["type"]
        if pid not in by_type[ptype]:
            by_type[ptype].append(pid)
            by_type[ptype].sort()
        prov["parts"][pid] = {"source": src_id, "label": label, "treatment": note, **info}
        built += 1
        print(f"built {pid} <- {src_id} ({mode})")

    keep = {Path(t["variants"]["source"]).name for tid, t in texs.items() if tid in prov["textures"]}
    for f in DERIVED_DIR.glob("*.png"):
        if f.name not in keep:
            f.unlink()
    MANIFEST.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    PROVENANCE.write_text(json.dumps(prov, indent=2), encoding="utf-8")
    print(f"done: {built} parts, {len(prov['textures'])} textures, pack now has {len(parts)} parts")

    if sheet_path and sheet_rows:
        from PIL import ImageDraw

        T = 200
        sheet = Image.new("RGB", (4 * (T + 10) + 20, len(sheet_rows) * (T + 30) + 20), (245, 245, 245))
        d = ImageDraw.Draw(sheet)

        def fit(img: Image.Image) -> Image.Image:
            img = img.convert("RGBA")
            img.thumbnail((T, T))
            card = Image.new("RGBA", (T, T), (255, 255, 255, 255))
            card.alpha_composite(img, ((T - img.size[0]) // 2, (T - img.size[1]) // 2))
            return card.convert("RGB")

        for i, (pid, ni, si, tp, png) in enumerate(sheet_rows):
            y = 20 + i * (T + 30)
            for k, img in enumerate([Image.open(ni), Image.open(si), Image.open(tp), Image.open(io.BytesIO(png))]):
                sheet.paste(fit(img), (20 + k * (T + 10), y))
            d.text((20, y + T + 4), f"{pid}: normal icon | shiny icon | S12 texture | derived S13 texture", fill=(0, 0, 0))
        sheet.save(sheet_path)
        print("sheet", sheet_path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
