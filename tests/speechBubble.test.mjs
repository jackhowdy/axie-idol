import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wrapLines, layoutBubble, MAX_LINES } from '../src/speechBubble.ts'

/** Ten pixels a character: wide enough to be predictable, narrow enough to force wrapping. */
const measure = (s) => s.length * 10

test('wrapLines wraps on words, keeps a giant word whole, and caps at three lines with an ellipsis', () => {
  assert.deepEqual(wrapLines('Stairs. Can we go up them?', 130, measure), ['Stairs. Can', 'we go up', 'them?'])
  assert.deepEqual(wrapLines('Supercalifragilistic dog', 80, measure), ['Supercalifragilistic', 'dog'])
  const many = wrapLines('one two three four five six seven eight nine ten', 60, measure)
  assert.equal(many.length, MAX_LINES)
  assert.match(many[MAX_LINES - 1], /…$/)
  assert.deepEqual(wrapLines('   ', 100, measure), [])
})

test('the bubble sits above the character, centred on it, with the tail pointing at its head', () => {
  const anchor = { x: 360, y: 900, halfW: 150, halfH: 150 }
  const l = layoutBubble({ W: 720, H: 1558, anchor, text: 'A dog. Can we keep it?', measure })
  assert.ok(l)
  assert.equal(l.above, true)
  assert.equal(l.fontPx, 28, '720 wide -> 28 px type')
  assert.ok(l.y + l.h < anchor.y - anchor.halfH, 'bubble bottom clears the top of the character')
  assert.ok(Math.abs(l.x + l.w / 2 - anchor.x) <= 1, 'centred on the character')
  assert.equal(l.tail.tipX, anchor.x)
  assert.ok(l.tail.tipY > l.y + l.h && l.tail.tipY <= anchor.y - anchor.halfH + 10, 'tip lands on the head')
  assert.ok(l.x >= 0 && l.x + l.w <= 720, 'inside the frame')
})

test('a character at the top of the frame gets its bubble below it, still inside the frame', () => {
  const anchor = { x: 100, y: 120, halfW: 100, halfH: 100 }
  const l = layoutBubble({ W: 720, H: 1558, anchor, text: 'Is that yellow biscuit for me?', measure })
  assert.ok(l)
  assert.equal(l.above, false)
  assert.ok(l.y > anchor.y + anchor.halfH, 'below the character')
  assert.ok(l.x >= 0, 'not pushed off the left edge even though the character is near it')
  assert.ok(l.tail.tipY < l.y && l.tail.tipY >= anchor.y + anchor.halfH - 10, 'tip up toward the character bottom')
  assert.ok(l.tail.x1 >= l.x + l.r && l.tail.x2 <= l.x + l.w - l.r, 'tail base within the straight edge')
})

test('empty text or a tiny frame draws nothing', () => {
  const anchor = { x: 50, y: 50, halfW: 10, halfH: 10 }
  assert.equal(layoutBubble({ W: 720, H: 1558, anchor, text: '   ', measure }), null)
  assert.equal(layoutBubble({ W: 32, H: 32, anchor, text: 'Hi', measure }), null)
})

test('a long line wraps and the bubble never exceeds about three quarters of the frame width', () => {
  const anchor = { x: 360, y: 900, halfW: 150, halfH: 150 }
  const l = layoutBubble({ W: 720, H: 1558, anchor, text: 'Everyone is looking at the yellow packet. Did they see my pose?', measure })
  assert.ok(l)
  assert.ok(l.lines.length >= 2 && l.lines.length <= MAX_LINES)
  assert.ok(l.w <= 720 * 0.72 + 2, `width ${l.w}`)
  assert.equal(l.h, l.lines.length * l.lineH + 2 * Math.round(l.fontPx * 0.7))
})
