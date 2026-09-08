import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINES, TEMPLATES, SITUATIONS, pickLine, fillSlots, checkRules } from '../server/voiceLines.mjs'
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
  const t = pickLine({ traits: ['Shy'], situation: 'before', slots: { thing: 'a dog' }, recent: [...LINES.Shy.before, ...TEMPLATES.before], rng: () => 0 })
  assert.ok(typeof t === 'string' && t.length > 0, 'always returns something')
})
