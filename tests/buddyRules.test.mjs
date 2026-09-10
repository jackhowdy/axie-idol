import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LADDER, levelFor, nextStep, eggOdds, rollWild, rollTraits, traitsForOwned, normalizeTraits,
  TRAITS, OPPOSITES, wishForToday, detectMoments, MOMENTS, hashInt, parsePartId,
} from '../server/buddyRules.mjs'
import catalogue from '../server/partCatalogue.json' with { type: 'json' }

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length] }

test('ladder has ten levels at the spec thresholds', () => {
  assert.deepEqual(LADDER.map((l) => l.bond), [5, 10, 16, 24, 34, 46, 60, 76, 95, 120])
  assert.equal(levelFor(0), 0)
  assert.equal(levelFor(5), 1)
  assert.equal(levelFor(23), 3)
  assert.equal(levelFor(120), 10)
  assert.equal(levelFor(999), 10)
  assert.deepEqual(nextStep(20), { level: 4, bond: 24, reward: 'Signature pose', remaining: 4 })
  assert.equal(nextStep(120), null)
})

test('egg odds tiers and cap', () => {
  assert.equal(eggOdds(3, 1).tier, 0)
  assert.equal(eggOdds(5, 1).tier, 5)
  assert.deepEqual(eggOdds(20, 1), { tier: 20, rareParts: 1, mysticChance: 0, nextTier: 50 })
  assert.equal(eggOdds(50, 1).mysticChance, 0.05)
  assert.equal(eggOdds(100, 1).mysticChance, 0.15)
  assert.equal(eggOdds(100, 9).mysticChance, 0.2, 'places add up to +5%')
  assert.equal(eggOdds(400, 1).tier, 100)
})

test('rollWild honours tier guarantees and produces a valid descriptor', () => {
  const r = rollWild(seq(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9), 20, 1, catalogue)
  assert.equal(r.descriptor.parts.length, 6)
  assert.deepEqual(new Set(r.descriptor.parts.map((p) => p.type)), new Set(['eye', 'ear', 'mouth', 'horn', 'back', 'tail']))
  assert.equal(r.rareIds.length, 1)
  assert.equal(r.descriptor.body, 'normal')
  assert.ok(catalogue.colorVariants[r.class].includes(r.descriptor.colorVariant))
  const r2 = rollWild(seq(0.5), 50, 1, catalogue)
  assert.equal(r2.rareIds.length, 2)
  const r0 = rollWild(seq(0.99), 5, 1, catalogue)
  assert.equal(r0.rareIds.length, 0)
  assert.equal(r0.mystic, false)
})

test('rollWild: Mystic is in addition to the guaranteed rares, never instead of one', () => {
  const r = rollWild(seq(0.01), 50, 1, catalogue)
  assert.equal(r.mystic, true)
  assert.equal(r.rareIds.length, 2)
  assert.ok(r.mysticId)
  const slotTypes = new Set([...r.rareIds, r.mysticId].map((id) => parsePartId(id).type))
  assert.equal(slotTypes.size, 3, 'two rare slots plus one distinct Mystic slot')
})

test('traits: one of five, nudged by the egg', () => {
  assert.deepEqual(TRAITS, ['Explorer', 'Foodie', 'Athlete', 'Shy', 'Collector'])
  assert.equal(OPPOSITES.length, 0)
  const t = rollTraits(seq(0.01, 0.5, 0.9, 0.3, 0.7), { places: 8, distanceKm: 1, foodSnaps: 0, oneSpot: false })
  assert.equal(t.length, 1)
  assert.equal(t[0], 'Explorer', 'many places leads Explorer')
  const quiet = rollTraits(seq(0.99), { places: 1, distanceKm: 0, foodSnaps: 0, oneSpot: true })
  assert.ok(TRAITS.includes(quiet[0]))
  const owned = traitsForOwned('6', 'Aquatic', ['Tricky', 'Catfish', 'Clamshell', 'Hero', 'Iguana', 'Ear Breathing'])
  assert.deepEqual(owned, traitsForOwned('6', 'Aquatic', ['Tricky', 'Catfish', 'Clamshell', 'Hero', 'Iguana', 'Ear Breathing']))
  assert.equal(owned.length, 1)
  assert.ok(TRAITS.includes(owned[0]))
})

test('old three-trait records collapse to one current trait; a retired trait becomes null', () => {
  assert.deepEqual(normalizeTraits(['Athlete', 'Explorer', 'Collector']), ['Athlete'])
  assert.deepEqual(normalizeTraits(['Show-off', 'Goofball', 'Foodie']), ['Foodie'], 'the first surviving trait')
  assert.equal(normalizeTraits(['Dreamer', 'Brave', 'Homebody']), null)
  assert.equal(normalizeTraits([]), null)
  assert.equal(normalizeTraits(undefined), null)
})

test('wish picks weather first, then place, then trait default', () => {
  const rain = wishForToday({ weather: 'rain', hour: 12, placeTypes: [], firstsDone: [], traits: ['Foodie'], rng: () => 0 })
  assert.equal(rain.id, 'rain')
  assert.equal(rain.bonus, 2)
  const harbour = wishForToday({ hour: 12, placeTypes: ['harbour'], firstsDone: [], traits: ['Foodie'], rng: () => 0 })
  assert.equal(harbour.id, 'sea')
  const def = wishForToday({ hour: 12, placeTypes: [], firstsDone: ['sea'], traits: ['Foodie'], rng: () => 0 })
  assert.equal(def.id, 'food')
})

test('moments: 24 defined, night and new place detected once', () => {
  assert.equal(MOMENTS.length, 24)
  const found = detectMoments({ hour: 22, labels: [], isNewPlace: true, isNewDistrict: false, snapCount: 3 }, [])
  assert.deepEqual(found.sort(), ['new-place', 'night-owl'])
  const again = detectMoments({ hour: 22, labels: [], isNewPlace: true, isNewDistrict: false, snapCount: 4 }, ['night-owl', 'new-place'])
  assert.deepEqual(again, [])
  assert.deepEqual(detectMoments({ hour: 12, labels: [], isNewPlace: false, isNewDistrict: false, snapCount: 100 }, []), ['hundredth'])
})

test('hashInt is stable', () => {
  assert.equal(hashInt('abc'), hashInt('abc'))
  assert.notEqual(hashInt('abc'), hashInt('abd'))
})
