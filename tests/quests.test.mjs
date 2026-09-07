import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNLOCK_LEVEL, unlockLevelFor, CAST_ORDER } from '../src/quests.ts'
import { icon } from '../src/icons.ts'

test('unlock table matches the R1 quest ladder', () => {
  assert.equal(UNLOCK_LEVEL.kotaro, 0)
  assert.equal(UNLOCK_LEVEL.bing, 1)
  assert.equal(UNLOCK_LEVEL['kotaro-sword'], 2)
  assert.equal(UNLOCK_LEVEL.buba, 14)
  assert.equal(UNLOCK_LEVEL.puffy, 16)
  assert.equal(UNLOCK_LEVEL['agonia-echo'], 24)
  assert.equal(unlockLevelFor('nope'), null)
  assert.equal(CAST_ORDER.length, 18)
  assert.equal(CAST_ORDER[0], 'kotaro')
  assert.equal(CAST_ORDER.at(-1), 'agonia-echo')
  for (const id of CAST_ORDER) assert.equal(typeof UNLOCK_LEVEL[id], 'number', id)
})

test('icons render inline SVG with the requested size', () => {
  const svg = icon('camera', 24)
  assert.match(svg, /^<svg width="24" height="24"/)
  assert.match(svg, /stroke="currentColor"/)
  assert.match(icon('heartFilled', 18), /fill="currentColor"/)
  assert.match(icon('unknown-name'), /<path/)
})

test('group photo slots grow with level: 1, then 2 at Lv3, then 3 at Lv7', async () => {
  const { squadPhotoSlots } = await import('../src/groupPhoto.ts')
  assert.equal(squadPhotoSlots(0), 1)
  assert.equal(squadPhotoSlots(2), 1)
  assert.equal(squadPhotoSlots(3), 2)
  assert.equal(squadPhotoSlots(6), 2)
  assert.equal(squadPhotoSlots(7), 3)
  assert.equal(squadPhotoSlots(24), 3)
})
