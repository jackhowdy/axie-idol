/**
 * Group photo: extra squad mates in the Snap, each a draggable/pinchable PNG
 * sticker beside the primary (3D/spine) one. Drawn into the capture by
 * drawExtras() using the same viewfinder→canvas mapping as the primary.
 */

export type ExtraSticker = {
  id: string
  el: HTMLImageElement
  x: number
  y: number
  scale: number
  rotation: number
  /** Colour-shifted rare variant (1 in SHINY_ODDS placements). */
  shiny: boolean
}

export const SHINY_ODDS = 256
/** Canvas/CSS filter that turns a squad mate shiny. */
export const SHINY_FILTER = 'hue-rotate(150deg) saturate(1.4) brightness(1.08)'

/** Roll a shiny for one placement. */
export function rollShiny(random: () => number = Math.random): boolean {
  return random() * SHINY_ODDS < 1
}

type Point = { x: number; y: number }

const SCALE_MIN = 0.25
const SCALE_MAX = 4

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function ang(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** How many squad mates may appear in one photo at a given quest level. */
export function squadPhotoSlots(level: number): number {
  if (level >= 7) return 3
  if (level >= 3) return 2
  return 1
}

export class GroupPhoto {
  private layer: HTMLElement
  private extras: ExtraSticker[] = []
  private onChange: () => void

  constructor(layer: HTMLElement, onChange: () => void) {
    this.layer = layer
    this.onChange = onChange
  }

  list(): readonly ExtraSticker[] {
    return this.extras
  }

  has(id: string): boolean {
    return this.extras.some((s) => s.id === id)
  }

  count(): number {
    return this.extras.length
  }

  /** Ids of extras that rolled shiny (for the post payload). */
  shinyIds(): string[] {
    return this.extras.filter((s) => s.shiny).map((s) => s.id)
  }

  /** Add a squad mate beside the primary. `src` must be a transparent PNG. */
  add(id: string, src: string, anchor: Point, index: number, shiny = false): ExtraSticker | null {
    if (this.has(id)) return null
    const el = document.createElement('img')
    el.className = shiny ? 'extra-sticker is-shiny' : 'extra-sticker'
    el.src = src
    el.alt = ''
    el.draggable = false
    el.dataset.castId = id
    // Fan out: 1st extra to the right, 2nd to the left, slightly lower & smaller
    const side = index % 2 === 0 ? 1 : -1
    const s: ExtraSticker = {
      id,
      el,
      x: anchor.x + side * 110,
      y: anchor.y + 40,
      scale: 0.82,
      rotation: side * -6,
      shiny,
    }
    this.layer.appendChild(el)
    this.bind(s)
    this.apply(s)
    this.extras.push(s)
    this.onChange()
    return s
  }

  remove(id: string): void {
    const i = this.extras.findIndex((s) => s.id === id)
    if (i === -1) return
    this.extras[i]!.el.remove()
    this.extras.splice(i, 1)
    this.onChange()
  }

  clear(): void {
    for (const s of this.extras) s.el.remove()
    this.extras = []
    this.onChange()
  }

  private apply(s: ExtraSticker): void {
    s.el.style.left = `${s.x}px`
    s.el.style.top = `${s.y}px`
    s.el.style.transform = `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`
  }

  private bind(s: ExtraSticker): void {
    const pointers = new Map<number, Point>()
    let dragId: number | null = null
    let last: Point = { x: 0, y: 0 }
    let pinchDist = 0
    let pinchScale = 1
    let pinchAngle = 0
    let pinchRot = 0
    const el = s.el

    const pos = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY })

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      pointers.set(e.pointerId, pos(e))
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      // Bring to front
      this.layer.appendChild(el)
      if (pointers.size === 1) {
        dragId = e.pointerId
        last = pos(e)
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [Point, Point]
        pinchDist = dist(a, b)
        pinchScale = s.scale
        pinchAngle = ang(a, b)
        pinchRot = s.rotation
        dragId = null
      }
    })
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return
      e.stopPropagation()
      pointers.set(e.pointerId, pos(e))
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()] as [Point, Point]
        if (pinchDist > 0) {
          s.scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, pinchScale * (dist(a, b) / pinchDist)))
        }
        s.rotation = pinchRot + (ang(a, b) - pinchAngle)
        this.apply(s)
        return
      }
      if (dragId === e.pointerId) {
        const p = pos(e)
        s.x += p.x - last.x
        s.y += p.y - last.y
        last = p
        this.apply(s)
      }
    })
    const end = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      e.stopPropagation()
      pointers.delete(e.pointerId)
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      if (dragId === e.pointerId) dragId = null
      if (pointers.size === 1) {
        const [only] = [...pointers.entries()] as [[number, Point]]
        dragId = only[0]
        last = only[1]
      }
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  /**
   * Draw every extra into the capture. `scaleX` maps viewfinder CSS px to
   * canvas px (same factor the primary sticker uses).
   */
  async drawExtras(ctx: CanvasRenderingContext2D, scaleX: number): Promise<void> {
    for (const s of this.extras) {
      const img = s.el
      if (!img.complete) await img.decode().catch(() => undefined)
      if (!img.naturalWidth) continue
      const baseW = img.offsetWidth * scaleX
      const baseH = baseW * (img.naturalHeight / Math.max(1, img.naturalWidth))
      ctx.save()
      if (s.shiny) ctx.filter = SHINY_FILTER
      ctx.translate(s.x * scaleX, s.y * scaleX)
      ctx.rotate((s.rotation * Math.PI) / 180)
      ctx.scale(s.scale, s.scale)
      ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH)
      ctx.restore()
    }
  }
}
