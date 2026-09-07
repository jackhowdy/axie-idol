"""
Best-effort build of the part variants the public mixer pack does not ship.

The public pack covers 576 of the 606 part/stage/skin variants. The 30 missing ones are:
  - 24 "nas-N" parts (skin 13, stage 2): the shiny versions of the Nightmare (skin 12) parts.
    Shiny keeps the mesh and recolours the dominant hue, leaving neutrals and accents alone. Compared
    with Sky Mavis art of real NightmareShiny Axies, the Nightmare set goes cool (about -120 degrees).
  - 6 "agamo" parts (skin 2): no Agamo texture exists in the pack, so we reuse the normal-skin (S00)
    mesh and shift its palette to a teal/violet treatment. This is an approximation, not the real art.

Run after scripts/copy-mixer-assets.mjs (which overwrites the manifest):
  <python> scripts/build_missing_parts.py

Writes: public/assets/axie/textures/derived/<sha256>.png, updates manifest.json in place,
and records what was derived in public/assets/axie/provenance/derived-parts.json.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "public" / "assets" / "axie"
MANIFEST = PACK / "manifest.json"
DERIVED_DIR = PACK / "textures" / "derived"
PROVENANCE = PACK / "provenance" / "derived-parts.json"

TYPE_ID = {"eyes": "Eye", "ears": "Ear", "mouth": "Mouth", "horn": "Horn", "back": "Back", "tail": "Tail"}
# Measured against Sky Mavis art of real NightmareShiny Axies (#12094912, #2660, #9, #7 vs their
# non-shiny Nightmare counterparts): pink/red -> blue/purple, purple -> green, teal -> green, i.e. about
# -120 degrees. (The pack's summer/summer-shiny pairs rotate +155; the Nightmare set was painted cooler.)
SHINY_SHIFT_DEG = -120
# Per-part exceptions, checked against the official art: Molten Peas Shiny (Axies #12094912, #2660)
# keeps a warm red/orange mask with yellow drips instead of going cool.
SHINY_SHIFT_OVERRIDES = {"S13_Beast04_L2_Eye": 30}  # Molten Peas (Beast eyes, stage 2)
AGAMO_PRIMARY_DEG = 175  # teal
AGAMO_SECONDARY_SHIFT_DEG = 120


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


def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rc = np.where(nz, (mx - r) / np.where(nz, d, 1), 0)
    gc = np.where(nz, (mx - g) / np.where(nz, d, 1), 0)
    bc = np.where(nz, (mx - b) / np.where(nz, d, 1), 0)
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


def dominant_hue(h: np.ndarray, s: np.ndarray, v: np.ndarray) -> float | None:
    mask = (s > 0.25) & (v > 0.25)
    if mask.sum() < 50:
        return None
    hist, edges = np.histogram(h[mask], bins=36, range=(0.0, 1.0))
    # smooth circularly so a hue straddling a bin edge still wins
    hist = hist + np.roll(hist, 1) + np.roll(hist, -1)
    k = int(np.argmax(hist))
    return (edges[k] + edges[k + 1]) / 2.0


def hue_dist(h: np.ndarray, center: float) -> np.ndarray:
    d = np.abs(h - center)
    return np.minimum(d, 1.0 - d)


def recolour(png_path: Path, mode: str, shiny_shift: float = SHINY_SHIFT_DEG) -> bytes:
    im = Image.open(png_path)
    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    im = im.convert("RGBA") if has_alpha else im.convert("RGB")
    arr = np.asarray(im).astype(np.float32) / 255.0
    rgb = arr[..., :3]
    h, s, v = rgb_to_hsv(rgb)
    dom = dominant_hue(h, s, v)
    if dom is None:
        # nothing saturated to shift: leave the texture alone
        out = im
    else:
        band = (hue_dist(h, dom) <= 40 / 360) & (s > 0.18)
        h2 = h.copy()
        s2 = s.copy()
        if mode == "shiny":
            h2 = np.where(band, (h + shiny_shift / 360) % 1.0, h)
        elif mode == "agamo":
            shift = (AGAMO_PRIMARY_DEG / 360) - dom
            h2 = np.where(band, (h + shift) % 1.0, h)
            other = (~band) & (s > 0.35) & (v > 0.3)
            h2 = np.where(other, (h + AGAMO_SECONDARY_SHIFT_DEG / 360) % 1.0, h2)
            s2 = np.where(band | other, np.minimum(1.0, s * 1.15), s)
        else:
            raise ValueError(mode)
        rgb2 = hsv_to_rgb(h2, s2, v)
        out_arr = arr.copy()
        out_arr[..., :3] = rgb2
        out = Image.fromarray((np.clip(out_arr, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA" if has_alpha else "RGB")
    import io

    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def local_path(url: str) -> Path:
    assert url.startswith("/assets/axie/"), url
    return PACK / url[len("/assets/axie/"):]


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    parts = manifest["assets"]["parts"]
    mats = manifest["assets"]["materials"]
    texs = manifest["assets"]["textures"]
    by_type = manifest["creator"]["partIdsByType"]

    # drop any earlier derived entries so the build is repeatable
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
    built = 0

    for pid, label in expected_ids(manifest):
        if pid in parts:
            continue
        skin = int(pid[1:3])
        if skin == 13:
            src_id, mode, note = "S12" + pid[3:], "shiny", "shiny of the Nightmare (S12) part: dominant hue shifted SHINY_SHIFT_DEG (cool)"
        elif skin == 2:
            src_id, mode, note = "S00" + pid[3:], "agamo", "normal (S00) mesh with a teal/violet palette; approximation"
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
        for rig in part["rigs"]:
            mat = copy.deepcopy(mats[rig["materialId"]])
            tex_id = mat["textures"]["_MainTex"]
            tex = copy.deepcopy(texs[tex_id])
            src_png = tex["variants"].get("unity-import") or tex["variants"]["source"]
            shift = SHINY_SHIFT_OVERRIDES.get(pid, SHINY_SHIFT_DEG)
            key = (src_png, mode + str(shift))
            if key not in tex_cache:
                png = recolour(local_path(src_png), mode, shift)
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
        prov["parts"][pid] = {"source": src_id, "label": label, "treatment": note}
        built += 1
        print(f"built {pid} <- {src_id} ({mode})")

    # prune derived textures no longer referenced (earlier runs with other rules)
    keep = {Path(t["variants"]["source"]).name for tid, t in texs.items() if tid in prov["textures"]}
    for f in DERIVED_DIR.glob("*.png"):
        if f.name not in keep:
            f.unlink()
    MANIFEST.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    PROVENANCE.write_text(json.dumps(prov, indent=2), encoding="utf-8")
    print(f"done: {built} parts, {len(prov['textures'])} textures, pack now has {len(parts)} parts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
