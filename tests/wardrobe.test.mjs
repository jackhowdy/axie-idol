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
} from '../src/wardrobe.ts'

/**
 * A plausible projected joint set for a 240x240 canvas: the character fills the frame, the ear
 * span (the unit every anchor is measured in) is 120 px, so one unit = 120 px.
 */
const joints = () => ({
  head: { x: 120, y: 62, scale: 1.2 },
  eyeL: { x: 148, y: 116, scale: 1.2 },
  eyeR: { x: 148, y: 116, scale: 1.2 },
  neck: { x: 132, y: 138, scale: 1.2 },
  back: { x: 116, y: 160, scale: 1.2 },
})

test('every wearable has an anchor on a known joint', () => {
  assert.deepEqual(Object.keys(ITEM_ANCHORS).sort(), [...WEARABLE_IDS].sort())
  for (const [item, a] of Object.entries(ITEM_ANCHORS)) {
    assert.ok(JOINT_NAMES.includes(a.joint), `${item} joint ${a.joint}`)
    assert.ok(a.w > 0 && a.w < 3, `${item} width ${a.w}`)
    assert.ok(Number.isFinite(a.dx) && Number.isFinite(a.dy), `${item} offsets`)
  }
})

test('unitFor is the ear span in pixels, and never zero or negative', () => {
  assert.equal(unitFor({ x: 0, y: 0, scale: 1.2 }), 120)
  assert.equal(unitFor({ x: 0, y: 0, scale: 0 }), 100)
  assert.equal(unitFor({ x: 0, y: 0, scale: -3 }), 100)
  assert.equal(unitFor({ x: 0, y: 0, scale: Number.NaN }), 100)
})

test('placeItem centres the sprite on the joint plus the anchor offset', () => {
  const j = { x: 100, y: 200, scale: 1 } // one unit = 100 px
  const box = placeItem({ joint: 'head', dx: 0.2, dy: -0.5, w: 1.5 }, j, 256, 256)
  assert.equal(box.w, 150)
  assert.equal(box.h, 150)
  // centre = (100 + 20, 200 - 50) = (120, 150); box is centred on it
  assert.equal(box.x, 120 - 75)
  assert.equal(box.y, 150 - 75)
})

test('placeItem keeps the sprite aspect ratio', () => {
  const j = { x: 0, y: 0, scale: 1 }
  const box = placeItem({ joint: 'neck', dx: 0, dy: 0, w: 1 }, j, 256, 128)
  assert.equal(box.w, 100)
  assert.equal(box.h, 50)
})

test('placeItem falls back to a square for a sprite with no intrinsic size', () => {
  const box = placeItem({ joint: 'neck', dx: 0, dy: 0, w: 1 }, { x: 0, y: 0, scale: 1 }, 0, 0)
  assert.equal(box.w, 100)
  assert.equal(box.h, 100)
})

test('the five anchors resolve to sensible boxes on a real joint set', () => {
  const j = joints()
  for (const item of WEARABLE_IDS) {
    const a = ITEM_ANCHORS[item]
    const box = placeItem(a, j[a.joint], 256, 256)
    // big enough to read, small enough not to swamp the character (unit = 120 px)
    assert.ok(box.w >= 60 && box.w <= 220, `${item} width ${box.w}`)
    assert.equal(box.h, box.w)
    // inside the 2x overlay the live view uses (240 px of padding on each side)
    const x = box.x + 240
    const y = box.y + 240
    assert.ok(x >= 0 && x + box.w <= 720, `${item} x ${x}`)
    assert.ok(y >= 0 && y + box.h <= 720, `${item} y ${y}`)
  }
})

test('hats and crowns sit above the head joint, scarves and capes below the eyes', () => {
  const j = joints()
  const bottom = (item) => {
    const a = ITEM_ANCHORS[item]
    const b = placeItem(a, j[a.joint], 256, 256)
    return b.y + b.h
  }
  // the head joint is the top of the body: headwear must clear it
  assert.ok(bottom('hat') <= j.head.y + 4, `hat bottom ${bottom('hat')}`)
  assert.ok(bottom('crown') <= j.head.y + 8, `crown bottom ${bottom('crown')}`)
  const shades = placeItem(ITEM_ANCHORS.shades, j.eyeL, 256, 256)
  assert.ok(Math.abs(shades.y + shades.h / 2 - j.eyeL.y) < 20, 'shades sit on the eyes')
  assert.ok(bottom('scarf') > j.eyeL.y, 'scarf hangs below the eyes')
  assert.ok(bottom('cape') > j.neck.y, 'cape hangs below the neck')
})

test('offsetJoints shifts every joint and keeps the scale', () => {
  const moved = offsetJoints(joints(), 240, 240)
  assert.equal(moved.head.x, 360)
  assert.equal(moved.head.y, 302)
  assert.equal(moved.head.scale, 1.2)
  assert.equal(moved.back.x, 356)
  assert.deepEqual(Object.keys(moved).sort(), [...JOINT_NAMES].sort())
})

test('offsetJoints passes null through', () => {
  assert.equal(offsetJoints(null, 10, 10), null)
})

test('frame ids are the four R1 choices and are validated', () => {
  assert.deepEqual([...FRAME_IDS], ['none', 'polaroid', 'film', 'postcard'])
  assert.equal(isFrameId('film'), true)
  assert.equal(isFrameId('none'), true)
  assert.equal(isFrameId('sparkle'), false)
  assert.equal(isFrameId(null), false)
})
