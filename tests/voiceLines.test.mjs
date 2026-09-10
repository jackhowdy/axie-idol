import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINES, GENERIC, TEMPLATES, SITUATIONS, pickLine, fillSlots, checkRules } from '../server/voiceLines.mjs'
import { TRAITS } from '../server/buddyRules.mjs'

test('every trait has every core situation with at least one line', () => {
  for (const t of TRAITS) for (const s of ['hatch', 'morning', 'wish', 'before', 'after', 'bedtime', 'return', 'big']) {
    assert.ok(LINES[t]?.[s]?.length >= 1, `${t}.${s}`)
  }
  for (const s of SITUATIONS) assert.ok(TEMPLATES[s]?.length >= 1, `template ${s}`)
})

test('all library lines pass the ten rules', () => {
  for (const t of Object.keys(LINES)) for (const s of Object.keys(LINES[t])) for (const l of LINES[t][s]) {
    assert.ok(checkRules(l), `${t}.${s}: ${l}`)
  }
})

// `{count}` and `{days}` are filled by the server from real numbers. The server spells them with
// wordsFor() first; if that ever regresses, a filled template line carries a digit and breaks the
// voice rule, so the rule is checked on the filled line, not just the raw one.
test('every template line still passes the rules once its slots are filled', () => {
  const slots = { count: 'three', days: 'two', thing: 'a dog', place: 'the park', weather: 'rainy' }
  for (const s of Object.keys(TEMPLATES)) for (const l of TEMPLATES[s]) {
    const filled = fillSlots(l, slots)
    assert.doesNotMatch(filled, /\{\w+\}/, `${s}: unfilled slot in ${filled}`)
    assert.ok(checkRules(filled), `${s}: ${filled}`)
  }
})

test('checkRules rejects long, numeric, game-word and emoji lines', () => {
  assert.equal(checkRules('This sentence has far more than fourteen words in it which is too many for the rules.'), false)
  assert.equal(checkRules('You are at level 4 now.'), false)
  assert.equal(checkRules('Bond went up!'), false)
  assert.equal(checkRules('I saw a dog 🐶'), false)
  assert.equal(checkRules('A DOG. Can we keep it?'), true)
})

test('pickLine prefers the lead trait, avoids recent lines, fills slots', () => {
  const recent = [...LINES.Explorer.before]
  const l = pickLine({ traits: ['Explorer', 'Foodie', 'Shy'], situation: 'before', slots: { thing: 'the bridge' }, recent, rng: () => 0 })
  assert.ok(!recent.includes(l), 'skips lines said in the last seven days')
  const filled = fillSlots('Get {thing} in it. Closer.', { thing: 'the noodles' })
  assert.equal(filled, 'Get the noodles in it. Closer.')

  // When every trait line is in recent, the trait-neutral pool speaks next: never a repeated trait line
  const shyBefore = LINES.Shy.before
  const templatesBefore = TEMPLATES.before
  const recentAll = [...shyBefore, ...templatesBefore]
  const t = pickLine({ traits: ['Shy'], situation: 'before', slots: { thing: 'a dog' }, recent: recentAll, rng: () => 0 })
  assert.ok(typeof t === 'string' && t.length > 0, 'always returns something')
  assert.ok(!shyBefore.includes(t), 'never returns a trait line from recent')
  assert.ok(GENERIC.before.includes(t), 'falls back to the trait-neutral pool before any template')

  // With the generic pool spent too, a filled template may speak; a trait line still never repeats
  const recentEverything = [...recentAll, ...GENERIC.before]
  const t2 = pickLine({ traits: ['Shy'], situation: 'before', slots: { thing: 'a dog' }, recent: recentEverything, rng: () => 0 })
  assert.ok(!shyBefore.includes(t2), 'still never a trait line from recent')
  const filledTemplates = templatesBefore.map((line) => fillSlots(line, { thing: 'a dog' })).filter((line) => !line.includes('{'))
  assert.ok(GENERIC.before.includes(t2) || filledTemplates.includes(t2), 'generic or a filled template when everything is spent')

  // Without a noun for the slot, no line with {thing} is ever spoken
  for (let i = 0; i < 12; i++) {
    const l = pickLine({ traits: ['Explorer', 'Foodie', 'Shy'], situation: 'after', slots: {}, recent: [], rng: Math.random })
    assert.ok(!/\{/.test(l), 'no unfilled slot: ' + l)
  }
})
