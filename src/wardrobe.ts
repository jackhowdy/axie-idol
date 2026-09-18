/**
 * Wardrobe: the worn item drawn as a flat 2D sprite pinned to the 3D character's joints, and the
 * optional photo frame drawn over a finished capture.
 *
 * The pure geometry lives here (ITEM_ANCHORS, placeItem, offsetJoints, unitFor) with no DOM and no
 * three.js import, so `tests/wardrobe.test.mjs` can load this module under
 * `node --experimental-strip-types`. Everything that needs a document or a canvas takes its
 * dependencies as arguments and is only called from the browser.
 *
 * Units: every anchor offset and width is measured in *body widths* — the width of the character's
 * rendered silhouette on screen. `Joint.scale` is that width / 100 (see `jointScreenPositions` in
 * axie3d.ts), so one unit = `scale * 100` px. That keeps items the right size whatever the canvas
 * size, device pixel ratio or camera framing (the ear span this once used foreshortens to a third
 * of the body in the 3/4 camera, which is how a hat landed small and on the upper body). The `head`
 * joint is the head's top surface at the horn, nudged toward the body's centre line; `chest` is
 * the lower body, two thirds of the way down the silhouette.
 */

export const WEARABLE_IDS = ['hat', 'scarf', 'shades', 'cape', 'crown'] as const
export type WearableId = (typeof WEARABLE_IDS)[number]

// 'gold' is the Idol's frame: offered only to an Axie that has earned the title (see main.ts)
export const FRAME_IDS = ['none', 'polaroid', 'film', 'postcard', 'gold'] as const
export type FrameId = (typeof FRAME_IDS)[number]

export const JOINT_NAMES = ['head', 'eyeL', 'eyeR', 'neck', 'chest', 'back'] as const
export type JointName = (typeof JOINT_NAMES)[number]

/** One projected joint in canvas pixels. `scale` is the ear span / 100. */
export type Joint = { x: number; y: number; scale: number }
export type JointScreen = Record<JointName, Joint>

export type ItemAnchor = {
  joint: JointName
  /** Offset of the rest line from the joint, in body widths (+x right, +y down on screen). */
  dx: number
  dy: number
  /** Sprite width in body widths; the height follows the sprite's aspect ratio. */
  w: number
  /**
   * Where the art rests, as a fraction of the sprite's height from its top: the base of a hat's
   * cone, the middle of a pair of lenses. That line is what lands on the joint (plus dx/dy), so an
   * item sits where its art touches the character, not where its square box is centred.
   */
  rest: number
}

export type Box = { x: number; y: number; w: number; h: number }

/**
 * Where each item sits. Headwear rests on the top of the silhouette (`head`), a hair below it so
 * it reads as worn rather than floating; shades centre on the eye joint; the scarf loops the neck;
 * the cape hangs from the spine. Sprites are square (256x256) with `rest` read off the art.
 */
export const ITEM_ANCHORS: Record<WearableId, ItemAnchor> = {
  hat: { joint: 'head', dx: 0, dy: 0.04, w: 0.7, rest: 0.79 },
  crown: { joint: 'head', dx: 0, dy: 0.04, w: 0.55, rest: 0.76 },
  // the rig has one mid eye joint (Root_Eye_M_JNT) covering both eyes, so the lenses centre on it
  shades: { joint: 'eyeL', dx: 0, dy: 0, w: 0.42, rest: 0.51 },
  // an Axie has no neck: the scarf wraps the lower body, two thirds of the way down the silhouette
  scarf: { joint: 'chest', dx: 0, dy: 0, w: 0.8, rest: 0.39 },
  // the 3/4 camera puts the character's rear toward screen-right, so the cape shifts that way
  cape: { joint: 'back', dx: 0.12, dy: 0.08, w: 0.8, rest: 0.2 },
}

/** Pixels per anchor unit. Falls back to 100 px for a missing or degenerate body width. */
export function unitFor(joint: Joint): number {
  const s = joint.scale
  return Number.isFinite(s) && s > 0 ? s * 100 : 100
}

/** Where to draw a sprite, in the same pixel space as the joints. */
export function placeItem(anchor: ItemAnchor, joint: Joint, spriteW: number, spriteH: number): Box {
  const unit = unitFor(joint)
  const w = anchor.w * unit
  const aspect = spriteW > 0 && spriteH > 0 ? spriteH / spriteW : 1
  const h = w * aspect
  return {
    x: joint.x + anchor.dx * unit - w / 2,
    y: joint.y + anchor.dy * unit - anchor.rest * h,
    w,
    h,
  }
}

/**
 * Move a projected joint set into the overlay canvas's pixel space. The overlay is larger than the
 * 3D canvas (headwear needs room above a character that fills its own frame), centred on the same
 * point, so the joints shift by half the difference.
 */
export function offsetJoints(joints: JointScreen | null, dx: number, dy: number): JointScreen | null {
  if (!joints) return null
  const out = {} as JointScreen
  for (const name of JOINT_NAMES) {
    const j = joints[name]
    out[name] = { x: j.x + dx, y: j.y + dy, scale: j.scale }
  }
  return out
}

export function isWearableId(id: string | null | undefined): id is WearableId {
  return typeof id === 'string' && (WEARABLE_IDS as readonly string[]).includes(id)
}

export function isFrameId(id: string | null | undefined): id is FrameId {
  return typeof id === 'string' && (FRAME_IDS as readonly string[]).includes(id)
}

/* ---------------------------------------------------------------- sprites (browser only) */

/** One HTMLImageElement per URL for the life of the page; SVGs are a few hundred bytes each. */
const images = new Map<string, HTMLImageElement>()

function sprite(url: string): HTMLImageElement {
  let img = images.get(url)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.src = url
    images.set(url, img)
  }
  return img
}

/** Usable = loaded with an intrinsic size (an SVG with no width/height attribute reports 0). */
function usable(img: HTMLImageElement | null): img is HTMLImageElement {
  return Boolean(img && img.complete && img.naturalWidth > 0)
}

export function wardrobeSprite(item: string): HTMLImageElement | null {
  return isWearableId(item) ? sprite(`/wardrobe/${item}.svg`) : null
}

/**
 * Sprites for side-view official art. Only the scarf differs: a filled loop reads as a plate under
 * a flat picture, so the 2D scarf is the front of the loop only, a band that hugs the body.
 */
export function wardrobeSprite2D(item: string): HTMLImageElement | null {
  return item === 'scarf' ? sprite('/wardrobe/scarf-2d.svg') : wardrobeSprite(item)
}

export function frameSprite(id: string): HTMLImageElement | null {
  return isFrameId(id) && id !== 'none' ? sprite(`/frames/${id}.svg`) : null
}

/** Start the downloads before the first frame that needs them (called once the camera opens). */
export function preloadWardrobe(): void {
  for (const item of WEARABLE_IDS) { wardrobeSprite(item); wardrobeSprite2D(item) }
  for (const id of FRAME_IDS) frameSprite(id)
}

/**
 * Clear the overlay and draw the worn item, one drawImage per frame. `joints` must already be in
 * `ctx.canvas`'s pixel space (see offsetJoints). Returns true when something was drawn.
 */
export function drawWardrobe(
  ctx: CanvasRenderingContext2D,
  worn: string | null,
  joints: JointScreen | null,
  resolve: (item: string) => HTMLImageElement | null = wardrobeSprite,
  anchors: Record<WearableId, ItemAnchor> = ITEM_ANCHORS,
): boolean {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!worn || !joints || !isWearableId(worn)) return false
  const img = resolve(worn)
  if (!usable(img)) return false
  const anchor = anchors[worn]
  const box = placeItem(anchor, joints[anchor.joint], img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, box.x, box.y, box.w, box.h)
  return true
}

/** Draw the chosen frame over the whole capture, stretched to the canvas. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frameId: string | null,
  resolve: (id: string) => HTMLImageElement | null = frameSprite,
): boolean {
  if (!frameId || frameId === 'none') return false
  const img = resolve(frameId)
  if (!usable(img)) return false
  ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height)
  return true
}
