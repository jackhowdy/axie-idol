// Happiness (the game) and real Axies by number: rules first, then the routes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBuddyModule } from '../server/buddy.mjs'
import { HAPPY, HAPPY_START, moodFor, decayed, photoJoy } from '../server/buddyRules.mjs'
import { characterBrief, coreFacts, memoryFacts } from '../server/voiceBrief.mjs'

const HOUR = 36e5
const REAL = { id: '2660', name: 'Axie #2660', class: 'Beast', level: 60, birthDate: 1523510193, breedCount: 1, genes: '0x1', parts: [{ type: 'horn', name: 'Winter Branch', class: 'Beast', specialGenes: 'Mystic' }, { type: 'tail', name: 'Hatsune', class: 'Plant', specialGenes: null }] }

function rig({ genes = async () => REAL, owned = async () => [], voice = null } = {}) {
  const state = {}
  const clock = { t: Date.parse('2026-09-18T02:00:00Z') }
  const storage = { get: (n, mk) => (state[n] ??= mk()), set: (n, v) => { state[n] = v } }
  const helpers = {
    sendJson: (res, status, body) => { res.status = status; res.body = body },
    readBody: async (req) => Buffer.from(JSON.stringify(req._body ?? {})),
    deviceKeyFrom: (req) => req._device || '',
    manilaDayKey: (d) => new Date((d instanceof Date ? d.getTime() : clock.t)).toISOString().slice(0, 10),
    fetchAxieGenes: genes, fetchAllOwnerAxies: owned, normalizeAddress: (a) => String(a || '').toLowerCase(),
  }
  const buddy = createBuddyModule({ storage, helpers, env: { BUDDY: '1', TALK: '1' }, now: () => clock.t, voice })
  const call = async (pathname, { method = 'POST', body, device = 'happy-dev' } = {}) => {
    const req = { method, headers: { get: () => null }, _body: body, _device: device }
    const res = {}
    assert.ok(await buddy.handle(req, res, { pathname, searchParams: new URLSearchParams() }), pathname)
    return res
  }
  const snap = (id, ctx = {}) => buddy.recordSnap({ id }, { buddy: true, ownerKey: 'device:happy-dev', hour: 12, ...ctx })
  const hatch = async () => {
    await call('/api/buddy/egg')
    for (let i = 0; i < 5; i++) await snap(`egg-${i}`)
    return call('/api/buddy/hatch', { body: { name: 'Sunny' } })
  }
  return { buddy, call, snap, hatch, clock }
}

test('moods: five bands, and time alone wears happiness down to Bored in about two days', () => {
  assert.equal(moodFor(0).id, 'bored'); assert.equal(moodFor(19).id, 'bored'); assert.equal(moodFor(20).id, 'restless')
  assert.equal(moodFor(45).id, 'content'); assert.equal(moodFor(70).id, 'happy'); assert.equal(moodFor(90).id, 'overjoyed'); assert.equal(moodFor(100).id, 'overjoyed')
  assert.equal(moodFor(decayed(100, 24)).id, 'content', 'a day alone: still fine')
  assert.equal(moodFor(decayed(100, 56)).id, 'bored', 'more than two days alone: bored')
  assert.equal(decayed(10, 1000), 0, 'never below nothing')
})

test('a photo is worth more with new things and a new place, less when it is the same again or unreadable', () => {
  assert.equal(photoJoy({ labels: ['slide'], previous: [], recent: [] }).delta, HAPPY.photo + HAPPY.newThings)
  assert.equal(photoJoy({ labels: ['slide'], previous: ['slide', 'roof'], recent: ['slide', 'roof'] }).delta, HAPPY.sameAgain)
  assert.equal(photoJoy({ labels: [], judged: true }).delta, HAPPY.unclear)
  assert.equal(photoJoy({ labels: [], judged: false }).delta, HAPPY.photo, 'no model looked: an ordinary photo, not a dark one')
  const big = photoJoy({ labels: ['sea'], isNewPlace: true, wishDone: true })
  assert.equal(big.delta, HAPPY.photo + HAPPY.newThings + HAPPY.newPlace + HAPPY.wish)
  assert.ok(big.reasons.includes('a new place') && big.reasons.includes('its wish came true'))
})

test('a hatched Axie starts Content, photos lift it, and the snap says by how much', async () => {
  const r = rig()
  const h = await r.hatch()
  assert.equal(h.body.active.happy.value, HAPPY_START)
  assert.equal(h.body.active.happy.mood, 'Content')
  const s = await r.snap('p1')
  assert.equal(s.happy.delta, HAPPY.photo)
  assert.equal(s.happy.value, HAPPY_START + HAPPY.photo)
  assert.ok(Array.isArray(s.happy.reasons) && s.happy.reasons.length)
})

test('reaching Overjoyed is the win: once a day it pays bond and counts a joy day', async () => {
  const r = rig()
  await r.hatch()
  let won = null
  for (let i = 0; i < 6 && !won; i++) { const s = await r.snap(`p${i}`); if (s.happy.overjoyed) won = s }
  assert.ok(won, 'a handful of photos gets there')
  assert.equal(won.happy.joyBonus, HAPPY.joyBonus)
  assert.equal(won.happy.joyStreak, 1)
  const g = await r.call('/api/buddy', { method: 'GET' })
  assert.equal(g.body.active.happy.mood, 'Overjoyed')
  assert.equal(g.body.active.happy.overjoyedToday, true)
  assert.deepEqual(g.body.active.joy, { days: 1, streak: 1, best: 1 })
  // dipping and coming back the same day does not pay twice
  r.clock.t += 10 * HOUR
  const again = await r.snap('later')
  assert.equal(again.happy.overjoyed, false)
})

test('left alone it ends up Bored and the joy streak lapses; one good day starts a new one', async () => {
  const r = rig()
  await r.hatch()
  for (let i = 0; i < 6; i++) await r.snap(`p${i}`)
  r.clock.t += 72 * HOUR
  const g = await r.call('/api/buddy', { method: 'GET' })
  assert.equal(g.body.active.happy.mood, 'Bored')
  assert.equal(g.body.active.joy.streak, 0, 'the streak is not shown once a day was missed')
  assert.equal(g.body.active.joy.best, 1)
  let won = null
  for (let i = 0; i < 12 && !won; i++) { const s = await r.snap(`back-${i}`, { lat: 1 + i, lng: 1 + i }); if (s.happy.overjoyed) won = s }
  assert.ok(won, 'it can be cheered up again')
  assert.equal(won.happy.joyStreak, 1)
})

test('a pat lifts it a little, five times a day, and always gets a line', async () => {
  const r = rig()
  await r.hatch()
  for (let i = 0; i < HAPPY.petsPerDay; i++) {
    const p = await r.call('/api/buddy/pet')
    assert.equal(p.status, 200); assert.equal(p.body.happy.delta, HAPPY.pet); assert.ok(p.body.line)
  }
  const sixth = await r.call('/api/buddy/pet')
  assert.equal(sixth.body.happy.delta, 0); assert.ok(sixth.body.line)
  assert.equal(sixth.body.active.happy.petsLeft, 0)
  r.clock.t += 24 * HOUR
  assert.equal((await r.call('/api/buddy/pet')).body.happy.delta, HAPPY.pet, 'a new day, new pats')
})

test('talking lifts it too, and an egg cannot be patted', async () => {
  const r = rig()
  await r.call('/api/buddy/egg')
  assert.equal((await r.call('/api/buddy/pet')).status, 409)
  for (let i = 0; i < 5; i++) await r.snap(`egg-${i}`)
  await r.call('/api/buddy/hatch', { body: { name: 'Chatty' } })
  const t = await r.call('/api/buddy/talk', { body: { text: 'hello' } })
  assert.equal(t.status, 200); assert.equal(t.body.happy.delta, HAPPY.talk)
})

test('the mood reaches the model as a feeling, never as a number', () => {
  const facts = memoryFacts({}, { mood: moodFor(5).feel })
  assert.match(facts, /bored/); assert.doesNotMatch(facts, /\d/)
})

test('visit: any real Axie by number, no wallet, already hatched and knowing itself', async () => {
  const r = rig()
  const v = await r.call('/api/buddy/visit', { body: { axieId: '#2660' } })
  assert.equal(v.status, 201, JSON.stringify(v.body))
  const a = v.body.active
  assert.equal(a.kind, 'visit'); assert.equal(a.axieId, '2660'); assert.equal(a.class, 'Beast'); assert.ok(a.hatchedAt)
  assert.equal(a.core.level, 60); assert.equal(a.core.birthYear, 2018); assert.equal(a.mystic, true)
  assert.deepEqual(a.core.parts.map((p) => p.name), ['Winter Branch', 'Hatsune'])
  assert.equal((await r.call('/api/buddy/visit', { body: { axieId: '2660' } })).status, 200, 'visiting it again switches to it')
  assert.equal((await r.call('/api/buddy/visit', { body: { axieId: '2660' } })).body.buddies.length, 1)
  assert.equal((await r.call('/api/buddy/visit', { body: { axieId: 'pip' } })).status, 400)
  const none = rig({ genes: async () => null })
  assert.equal((await none.call('/api/buddy/visit', { body: { axieId: '99' } })).status, 404)
})

test('a real Axie brief names its parts and its training without a digit; a wild one has none', () => {
  const b = { name: 'Frost', class: 'Beast', traits: ['Explorer'], core: { level: 60, birthYear: 2018, parts: [{ type: 'horn', name: 'Winter Branch', special: 'Mystic' }, { type: 'tail', name: 'Hatsune', special: null }] } }
  const facts = coreFacts(b)
  assert.match(facts, /real Axie from Lunacia/); assert.match(facts, /horn: Winter Branch \(mystic, very rare\)/); assert.match(facts, /tail: Hatsune/)
  assert.match(facts, /trained for a very long time/); assert.doesNotMatch(facts, /\d/)
  assert.ok(characterBrief(b).includes(facts))
  assert.equal(coreFacts({ name: 'Wild', core: null }), '')
  assert.match(coreFacts({ core: { level: 1, parts: [{ type: 'horn', name: 'Imp' }] } }), /never trained/)
})
