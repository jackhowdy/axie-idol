import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ITEM_ANCHORS,
  WEARABLE_IDS,
  FRAME_IDS,
  JOINT_NAMES,
  isFrameId,
  placeItem,
  offsetJoints,
  unitFor,
  drawWardrobe,
  drawFrame,
} from '../src/wardrobe.ts'

/** Enough of a 2D context to record what drawWardrobe/drawFrame did. */
const stubCtx = (w = 720, h = 720) => {
  const calls = { clear: 0, draws: [] }
  return {
    calls,
    canvas: { width: w, height: h },
    clearRect: () => { calls.clear++ },
    drawImage: (img, x, y, dw, dh) => { calls.draws.push({ img, x, y, w: dw, h: dh }) },
  }
}
/** A loaded sprite; `complete: false` or a 0 width is what an unloaded/missing image looks like. */
const stubImg = (w = 256, h = 256, complete = true) => ({ complete, naturalWidth: w, naturalHeight: h })

/**
 * A plausible projected joint set for a 240x240 canvas: the character's silhouette spans x 20..220
 * (200 px wide, so one unit = 200 px and scale = 2) with its top at y 30. `head` is that top
 * centre; the rest are rig joints.
 */
const joints = () => ({
  head: { x: 120, y: 30, scale: 2 },
  eyeL: { x: 148, y: 116, scale: 2 },
  eyeR: { x: 148, y: 116, scale: 2 },
  neck: { x: 132, y: 138, scale: 2 },
  back: { x: 116, y: 160, scale: 2 },
})

test('every wearable has an anchor on a known joint', () => {
  assert.deepEqual(Object.keys(ITEM_ANCHORS).sort(), [...WEARABLE_IDS].sort())
  for (const [item, a] of Object.entries(ITEM_ANCHORS)) {
    assert.ok(JOINT_NAMES.includes(a.joint), `${item} joint ${a.joint}`)
    assert.ok(a.w > 0 && a.w < 3, `${item} width ${a.w}`)
    assert.ok(Number.isFinite(a.dx) && Number.isFinite(a.dy), `${item} offsets`)
  }
})

test('unitFor is the body width in pixels, and never zero or negative', () => {
  assert.equal(unitFor({ x: 0, y: 0, scale: 1.2 }), 120)
  assert.equal(unitFor({ x: 0, y: 0, scale: 0 }), 100)
  assert.equal(unitFor({ x: 0, y: 0, scale: -3 }), 100)
  assert.equal(unitFor({ x: 0, y: 0, scale: Number.NaN }), 100)
})

test('placeItem puts the rest line on the joint plus the anchor offset, centred horizontally', () => {
  const j = { x: 100, y: 200, scale: 1 } // one unit = 100 px
  const box = placeItem({ joint: 'head', dx: 0.2, dy: -0.5, w: 1.5, rest: 0.5 }, j, 256, 256)
  assert.equal(box.w, 150)
  assert.equal(box.h, 150)
  // rest point = (100 + 20, 200 - 50) = (120, 150); rest is mid-height, so the box is centred on it
  assert.equal(box.x, 120 - 75)
  assert.equal(box.y, 150 - 75)
  // a rest line lower in the art lifts the box so that line still lands on the same point
  const low = placeItem({ joint: 'head', dx: 0.2, dy: -0.5, w: 1.5, rest: 0.8 }, j, 256, 256)
  assert.equal(low.y + 0.8 * low.h, 150)
})

test('placeItem keeps the sprite aspect ratio', () => {
  const j = { x: 0, y: 0, scale: 1 }
  const box = placeItem({ joint: 'neck', dx: 0, dy: 0, w: 1, rest: 0.5 }, j, 256, 128)
  assert.equal(box.w, 100)
  assert.equal(box.h, 50)
})

test('placeItem falls back to a square for a sprite with no intrinsic size', () => {
  const box = placeItem({ joint: 'neck', dx: 0, dy: 0, w: 1, rest: 0.5 }, { x: 0, y: 0, scale: 1 }, 0, 0)
  assert.equal(box.w, 100)
  assert.equal(box.h, 100)
})

test('the five anchors resolve to sensible boxes on a real joint set', () => {
  const j = joints()
  for (const item of WEARABLE_IDS) {
    const a = ITEM_ANCHORS[item]
    const box = placeItem(a, j[a.joint], 256, 256)
    // big enough to read, small enough not to swamp the character (unit = 200 px)
    assert.ok(box.w >= 70 && box.w <= 180, `${item} width ${box.w}`)
    assert.equal(box.h, box.w)
    // inside the 2x overlay the live view uses (240 px of padding on each side)
    const x = box.x + 240
    const y = box.y + 240
    assert.ok(x >= 0 && x + box.w <= 720, `${item} x ${x}`)
    assert.ok(y >= 0 && y + box.h <= 720, `${item} y ${y}`)
  }
})

test('the rest line of each item lands on its joint: hats on the top of the head, shades on the eyes', () => {
  const j = joints()
  const restY = (item) => {
    const a = ITEM_ANCHORS[item]
    const b = placeItem(a, j[a.joint], 256, 256)
    return b.y + a.rest * b.h
  }
  // the base of the cone / band sits a hair below the top of the silhouette, never on the body
  assert.ok(restY('hat') >= j.head.y && restY('hat') <= j.head.y + 12, `hat base ${restY('hat')}`)
  assert.ok(restY('crown') >= j.head.y && restY('crown') <= j.head.y + 12, `crown base ${restY('crown')}`)
  const hat = placeItem(ITEM_ANCHORS.hat, j.head, 256, 256)
  assert.ok(Math.abs(hat.x + hat.w / 2 - j.head.x) < 1, 'hat is centred over the head')
  assert.ok(hat.w >= 0.5 * 200 && hat.w <= 0.75 * 200, `hat spans most of the head: ${hat.w}`)
  assert.ok(Math.abs(restY('shades') - j.eyeL.y) < 2, 'shades sit on the eyes')
  assert.ok(restY('scarf') > j.eyeL.y, 'scarf hangs below the eyes')
  assert.ok(restY('cape') > j.neck.y, 'cape clasps below the neck')
})

test('offsetJoints shifts every joint and keeps the scale', () => {
  const moved = offsetJoints(joints(), 240, 240)
  assert.equal(moved.head.x, 360)
  assert.equal(moved.head.y, 270)
  assert.equal(moved.head.scale, 2)
  assert.equal(moved.back.x, 356)
  assert.deepEqual(Object.keys(moved).sort(), [...JOINT_NAMES].sort())
})

test('offsetJoints passes null through', () => {
  assert.equal(offsetJoints(null, 10, 10), null)
})

test('drawWardrobe clears the overlay and stamps the sprite exactly once', () => {
  const ctx = stubCtx()
  const img = stubImg()
  const j = offsetJoints(joints(), 240, 240)
  assert.equal(drawWardrobe(ctx, 'hat', j, () => img), true)
  assert.equal(ctx.calls.clear, 1)
  assert.equal(ctx.calls.draws.length, 1, 'one drawImage per frame')
  const expected = placeItem(ITEM_ANCHORS.hat, j.head, 256, 256)
  assert.deepEqual(
    { x: ctx.calls.draws[0].x, y: ctx.calls.draws[0].y, w: ctx.calls.draws[0].w, h: ctx.calls.draws[0].h },
    expected,
  )
})

test('drawWardrobe clears and draws nothing when there is nothing to draw', () => {
  for (const [worn, jointSet, resolve] of [
    [null, offsetJoints(joints(), 240, 240), () => stubImg()], // nothing worn
    ['hat', null, () => stubImg()], // model not loaded (jointScreenPositions returned null)
    ['sparkles', offsetJoints(joints(), 240, 240), () => stubImg()], // unknown item id
    ['hat', offsetJoints(joints(), 240, 240), () => null], // no sprite for it
    ['hat', offsetJoints(joints(), 240, 240), () => stubImg(256, 256, false)], // still loading
    ['hat', offsetJoints(joints(), 240, 240), () => stubImg(0, 0)], // SVG with no intrinsic size
  ]) {
    const ctx = stubCtx()
    assert.equal(drawWardrobe(ctx, worn, jointSet, resolve), false, `worn=${worn}`)
    assert.equal(ctx.calls.clear, 1, 'the overlay is always cleared')
    assert.equal(ctx.calls.draws.length, 0)
  }
})

test('drawFrame stretches the frame over the whole canvas, and skips "none"', () => {
  const ctx = stubCtx(1440, 2560)
  assert.equal(drawFrame(ctx, 'film', () => stubImg(1080, 1440)), true)
  assert.deepEqual(ctx.calls.draws, [{ img: ctx.calls.draws[0].img, x: 0, y: 0, w: 1440, h: 2560 }])
  assert.equal(ctx.calls.clear, 0, 'the frame never clears the capture underneath it')
  for (const id of [null, 'none']) {
    const c = stubCtx(1440, 2560)
    assert.equal(drawFrame(c, id, () => stubImg(1080, 1440)), false)
    assert.equal(c.calls.draws.length, 0)
  }
})

test('frame ids are the four R1 choices and are validated', () => {
  assert.deepEqual([...FRAME_IDS], ['none', 'polaroid', 'film', 'postcard'])
  assert.equal(isFrameId('film'), true)
  assert.equal(isFrameId('none'), true)
  assert.equal(isFrameId('sparkle'), false)
  assert.equal(isFrameId(null), false)
})
