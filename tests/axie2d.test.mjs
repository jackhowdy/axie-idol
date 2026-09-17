// Real Axies in 2D: the crop and the joints are pure, so they are tested without a browser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cropBox, jointsFor2D } from '../src/axie2d.ts'
import { ITEM_ANCHORS, placeItem } from '../src/wardrobe.ts'

/** A 100 x 80 picture: a body from (20,30) to (79,69), and a tall tail at the right reaching y=10. */
const alphaAt = (x, y) => ((x >= 20 && x < 80 && y >= 30 && y < 70) || (x >= 70 && x < 80 && y >= 10 && y < 30) ? 255 : 0)

test('the crop is the outline of the opaque pixels, and the head is the top of the middle, not the tail', () => {
  const found = cropBox(100, 80, alphaAt, 1)
  assert.deepEqual(found.box, { l: 20, t: 10, r: 80, b: 70 })
  // the body starts at y=30 in a box that runs 10..69: a third of the way down
  assert.ok(Math.abs(found.topMid - 20 / 59) < 0.01, String(found.topMid))
  assert.equal(cropBox(10, 10, () => 0), null, 'an empty picture has no box')
})

test('joints are fractions of the picture, in the unit the wardrobe uses', () => {
  const j = jointsFor2D(200, 150, 0.2)
  assert.equal(j.head.scale, 2, 'body width over a hundred')
  assert.equal(j.head.y, 30); assert.ok(j.head.x > 80 && j.head.x < 100)
  assert.ok(j.eyeL.x < j.head.x, 'official art faces left')
  assert.ok(j.chest.y > j.eyeL.y && j.chest.y < 150)
  assert.ok(j.back.x > j.chest.x)
  assert.equal(jointsFor2D(200, 150, 0.9).head.y, 75, 'a wild reading never puts the hat below the middle')
})

test('a hat lands on top of the head and a scarf on the lower body', () => {
  const j = jointsFor2D(200, 150, 0.1)
  const hat = placeItem(ITEM_ANCHORS.hat, j.head, 256, 256)
  assert.ok(hat.y < j.head.y && hat.y + hat.h > j.head.y, 'the brim sits on the head line')
  assert.ok(hat.y + hat.h < 150 * 0.45, 'and the hat stays off the face')
  const scarf = placeItem(ITEM_ANCHORS.scarf, j.chest, 256, 256)
  assert.ok(scarf.y + scarf.h * ITEM_ANCHORS.scarf.rest > 150 * 0.7)
})
