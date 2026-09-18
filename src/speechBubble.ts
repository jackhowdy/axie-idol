/**
 * The Axie's line on the photo: a speech bubble drawn onto the captured image, tail toward the
 * character, so the personality travels with the picture when it is saved or shared.
 *
 * The layout is pure (no DOM): `layoutBubble` takes the frame size, where the character is, the
 * text and a measuring function, and returns boxes and lines. `tests/speechBubble.test.mjs` runs
 * it under Node with a fake measure. Only `drawSpeechBubble` touches a canvas.
 */

/** The character on the composite: its centre and half extents, in canvas pixels. */
export type BubbleAnchor = { x: number; y: number; halfW: number; halfH: number }

export type BubbleLayout = {
  x: number
  y: number
  w: number
  h: number
  r: number
  fontPx: number
  lineH: number
  lines: string[]
  above: boolean
  /** Tail triangle: base on the bubble edge, tip toward the character. */
  tail: { x1: number; y1: number; x2: number; y2: number; tipX: number; tipY: number }
}

export const MAX_LINES = 3

/** Greedy word wrap; a single word wider than the box is kept whole (never split). */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES)
    kept[MAX_LINES - 1] = kept[MAX_LINES - 1].replace(/[.,;:!?]*$/, '') + '…'
    return kept
  }
  return lines
}

/**
 * What the bubble is sized against: the photo's width on a portrait photo (a phone), but on a wide
 * one (a desktop window) a portrait-sized slice of it, so the words stay in proportion to the Axie
 * instead of growing with the window.
 */
export function bubbleBase(W: number, H: number): number {
  return Math.min(W, H * 0.62)
}

export function layoutBubble(opts: { W: number; H: number; anchor: BubbleAnchor; text: string; measure: (s: string) => number }): BubbleLayout | null {
  const { W, H, anchor, text, measure } = opts
  if (!text.trim() || W < 64 || H < 64) return null
  const base = bubbleBase(W, H)
  const fontPx = Math.max(18, Math.min(44, Math.round(base / 26)))
  const lineH = Math.round(fontPx * 1.25)
  const pad = Math.round(fontPx * 0.7)
  const margin = Math.round(fontPx * 0.6)
  const tailLen = Math.round(fontPx * 0.9)
  const r = Math.round(fontPx * 0.75)
  const lines = wrapLines(text, base * 0.72 - 2 * pad, measure)
  if (!lines.length) return null
  const textW = Math.max(...lines.map(measure))
  const w = Math.min(W - 2 * margin, Math.round(textW + 2 * pad))
  const h = lines.length * lineH + 2 * pad

  // Above the character when there is room, else below it; never off the frame.
  let above = true
  let y = Math.round(anchor.y - anchor.halfH - margin - tailLen - h)
  if (y < margin) {
    above = false
    y = Math.round(anchor.y + anchor.halfH + margin + tailLen)
    if (y + h > H - margin) y = Math.max(margin, H - margin - h)
  }
  const x = Math.round(Math.min(Math.max(margin, anchor.x - w / 2), W - margin - w))

  // The tail leaves the bubble edge nearest the character, within the straight part of the edge.
  const baseHalf = Math.round(fontPx * 0.5)
  const baseX = Math.min(Math.max(x + r + baseHalf, anchor.x), x + w - r - baseHalf)
  const edgeY = above ? y + h : y
  const tipY = above ? anchor.y - anchor.halfH + Math.round(fontPx * 0.15) : anchor.y + anchor.halfH - Math.round(fontPx * 0.15)
  const tail = { x1: baseX - baseHalf, y1: edgeY, x2: baseX + baseHalf, y2: edgeY, tipX: anchor.x, tipY }
  return { x, y, w, h, r, fontPx, lineH, lines, above, tail }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Draw the bubble onto `ctx` (the composite). Returns false when there was nothing to draw. */
export function drawSpeechBubble(ctx: CanvasRenderingContext2D, text: string, anchor: BubbleAnchor, family = 'Nunito, system-ui, sans-serif', opts: { star?: boolean } = {}): boolean {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const probeFont = (px: number) => `800 ${px}px ${family}`
  // measure with the size the layout will pick
  const fontPx = Math.max(18, Math.min(44, Math.round(bubbleBase(W, H) / 26)))
  ctx.save()
  ctx.font = probeFont(fontPx)
  const layout = layoutBubble({ W, H, anchor, text, measure: (s) => ctx.measureText(s).width })
  if (!layout) { ctx.restore(); return false }
  const ink = '#1A2B3C'
  const stroke = Math.max(2, Math.round(layout.fontPx * 0.12))
  // soft drop shadow, then the shape: tail first so the bubble covers its base
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)'
  ctx.shadowBlur = layout.fontPx * 0.6
  ctx.shadowOffsetY = layout.fontPx * 0.15
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = ink
  ctx.lineWidth = stroke
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(layout.tail.x1, layout.tail.y1)
  ctx.lineTo(layout.tail.tipX, layout.tail.tipY)
  ctx.lineTo(layout.tail.x2, layout.tail.y2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  roundedRect(ctx, layout.x, layout.y, layout.w, layout.h, layout.r)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.stroke()
  // hide the tail's base line inside the bubble
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(layout.tail.x1 + stroke / 2, layout.tail.y1 - (layout.above ? stroke : 0), layout.tail.x2 - layout.tail.x1 - stroke, stroke)
  ctx.fillStyle = ink
  ctx.font = probeFont(layout.fontPx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const pad = (layout.h - layout.lines.length * layout.lineH) / 2
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, layout.x + layout.w / 2, layout.y + pad + layout.lineH * (i + 0.5))
  })
  // A Star's photos carry a gold star on the corner of the bubble.
  if (opts.star) {
    const R = layout.fontPx * 0.95
    const cx = layout.x + layout.w - R * 0.15
    const cy = layout.y + R * 0.1
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? R : R * 0.45
      const a = -Math.PI / 2 + (i * Math.PI) / 5 + 0.2
      ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fillStyle = '#FFC531'
    ctx.strokeStyle = ink
    ctx.lineWidth = stroke
    ctx.lineJoin = 'round'
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
  return true
}
