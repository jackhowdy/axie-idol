/**
 * Real Axies in 2D: the official art, cropped to the creature.
 *
 * A real Axie has official artwork its owner knows by heart, so it is shown as that artwork
 * rather than as a 3D approximation (hatched Axies have no official art and stay in 3D). The
 * marketplace image is a wide transparent canvas with the Axie in the middle; cropping it to its
 * outline makes it the same size on screen as the 3D character, and makes the wardrobe simple:
 * the joints are fractions of the cropped box.
 *
 * `jointsFor2D` and `cropBox` are pure, so `tests/axie2d.test.mjs` can load this file under
 * `node --experimental-strip-types`. `loadAxieArt` needs a browser.
 */
import type { ItemAnchor, JointScreen, WearableId } from './wardrobe.ts'

/**
 * Where each item sits on official art. The 3D anchors assume a rig seen three-quarters on; the
 * art is a side view of a rounder body with the face on the left, so headwear is smaller and sits
 * on the head behind the horns, the scarf rides low under the chin, and the cape hangs from the
 * shoulders behind the body (`BEHIND_2D`: drawn under the picture, so only its edges show).
 */
export const ITEM_ANCHORS_2D: Record<WearableId, ItemAnchor> = {
  hat: { joint: 'head', dx: 0, dy: 0.05, w: 0.46, rest: 0.79 },
  crown: { joint: 'head', dx: 0, dy: 0.04, w: 0.4, rest: 0.76 },
  shades: { joint: 'eyeL', dx: 0, dy: 0, w: 0.4, rest: 0.51 },
  scarf: { joint: 'chest', dx: 0, dy: 0, w: 0.68, rest: 0.58 },
  cape: { joint: 'back', dx: 0, dy: 0, w: 0.9, rest: 0.12 },
}
export const BEHIND_2D: readonly string[] = ['cape']

export type Art2D = {
  /** Cropped art as a PNG data URL (same-origin source, so it never taints a canvas). */
  src: string
  w: number
  h: number
  /** Where the top of the head is, as a fraction of the height: the body's top, not a horn's tip. */
  topMid: number
}

export type Box = { l: number; t: number; r: number; b: number }

/**
 * The outline of the opaque pixels, and where the head's top is inside it. Horns, ears and back
 * parts are narrow; the body is the wide part. The first row (from the top) where opaque pixels
 * span at least half the outline's width is where the body starts, and the crown of the head is a
 * touch above that (the body is round). `alphaAt` reads one pixel's alpha; `step` trades accuracy
 * for speed. Null when nothing is opaque.
 */
export function cropBox(width: number, height: number, alphaAt: (x: number, y: number) => number, step = 2): { box: Box; topMid: number } | null {
  let l = width, t = height, r = -1, b = -1
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (alphaAt(x, y) > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y }
    }
  }
  if (r < l || b < t) return null
  const need = ((r - l) / step) * 0.5
  let top = t
  for (let y = t; y <= b; y += step) {
    let n = 0
    for (let x = l; x <= r; x += step) if (alphaAt(x, y) > 24) n++
    if (n >= need) { top = y; break }
  }
  return { box: { l, t, r: r + step, b: b + step }, topMid: Math.max(0, (top - t) / Math.max(1, b - t) - 0.05) }
}

/**
 * Joints for the wardrobe, in the pixel space of the picture as drawn (`w` x `h`). Official art
 * faces left: the eyes are in the left third, the back is on the right. `scale` is the body width
 * over a hundred, the same unit the 3D joints use, so the same anchors fit both.
 */
export function jointsFor2D(w: number, h: number, topMid: number): JointScreen {
  const scale = w / 100
  const top = Math.min(0.5, Math.max(0, topMid)) * h
  const bodyH = h - top
  const at = (x: number, y: number) => ({ x, y, scale })
  return {
    head: at(w * 0.44, top),
    eyeL: at(w * 0.3, top + bodyH * 0.4),
    eyeR: at(w * 0.3, top + bodyH * 0.4),
    neck: at(w * 0.44, top + bodyH * 0.7),
    chest: at(w * 0.46, top + bodyH * 0.8),
    back: at(w * 0.66, top + bodyH * 0.08),
  }
}

const cache = new Map<string, Promise<Art2D | null>>()

/** The official art for an Axie number, cropped. Cached per page; null when it cannot be had. */
export function loadAxieArt(axieId: string): Promise<Art2D | null> {
  const hit = cache.get(axieId)
  if (hit) return hit
  const job = (async (): Promise<Art2D | null> => {
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = `/api/image/${encodeURIComponent(axieId)}`
      await img.decode()
      const full = document.createElement('canvas')
      full.width = img.naturalWidth
      full.height = img.naturalHeight
      const g = full.getContext('2d', { willReadFrequently: true })
      if (!g || !full.width || !full.height) return null
      g.drawImage(img, 0, 0)
      const data = g.getImageData(0, 0, full.width, full.height).data
      const found = cropBox(full.width, full.height, (x, y) => data[(y * full.width + x) * 4 + 3])
      if (!found) return null
      const pad = Math.round(Math.max(found.box.r - found.box.l, found.box.b - found.box.t) * 0.02)
      const l = Math.max(0, found.box.l - pad), t = Math.max(0, found.box.t - pad)
      const w = Math.min(full.width, found.box.r + pad) - l
      const h = Math.min(full.height, found.box.b + pad) - t
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      out.getContext('2d')?.drawImage(full, l, t, w, h, 0, 0, w, h)
      // the crop moved the top edge up by `pad`: the body's top is a little lower in the new box
      const topMid = (found.topMid * (found.box.b - found.box.t) + (found.box.t - t)) / h
      return { src: out.toDataURL('image/png'), w, h, topMid }
    } catch {
      return null
    }
  })()
  cache.set(axieId, job)
  void job.then((art) => { if (!art) cache.delete(axieId) })
  return job
}
