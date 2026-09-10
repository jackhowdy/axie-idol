import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startNodeServer } from './helpers/start-node-server.mjs'
import { createBuddyModule } from '../server/buddy.mjs'
import * as secp from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { keccak_256 } from '@noble/hashes/sha3'
import { hashPersonalMessage } from '../server/roninSig.mjs'
secp.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp.etc.concatBytes(...m))

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
let base = process.env.BASE_URL || ''
let server = null
before(async () => { if (!base) { server = await startNodeServer({ BUDDY: '1', BUDDY_TEST_SKIP_CHAIN: '1', TALK: '1' }); base = server.baseUrl } })
/** Started inside the ADMIN_KEY test below — the shared server deliberately has no admin key. */
let adminServer = null
/** Started inside the flag-off test below — the shared server runs with BUDDY=1. */
let flagOffServer = null
after(async () => {
  if (server) await server.stop()
  if (adminServer) await adminServer.stop()
  if (flagOffServer) await flagOffServer.stop()
})

/**
 * A buddy module wired to an in-memory store, with no rate limiter and no HTTP. Used by the tests
 * that would otherwise trip an unrelated ceiling (the post rate limit, the buddy route limits)
 * before reaching the behaviour under test.
 */
function directModule({ env = { BUDDY: '1', TALK: '1' }, voice = null } = {}) {
  const storeState = {}
  const storage = {
    get: (name, makeEmpty) => (storeState[name] ??= makeEmpty()),
    set: (name, val) => { storeState[name] = val },
  }
  const helpers = {
    sendJson: (res, status, body) => { res.status = status; res.body = body },
    readBody: async (req) => Buffer.from(JSON.stringify(req._body ?? {})),
    deviceKeyFrom: (req) => req._device || '',
    // Date-aware, like the real manilaDayKey(date?) in core.mjs: must vary with the date argument,
    // or streakFor's backward-walking loop (called from publicBuddy) never terminates.
    manilaDayKey: (d) => (d instanceof Date ? d : new Date()).toISOString().slice(0, 10),
    fetchAxieGenes: async () => null,
    fetchAllOwnerAxies: async () => [],
    normalizeAddress: (a) => String(a || '').toLowerCase(),
  }
  const buddy = createBuddyModule({ storage, helpers, env, voice })
  const call = async (pathname, { method = 'GET', body, device = 'unit-dev', search = '' } = {}) => {
    const req = { method, headers: { get: () => null }, _body: body, _device: device }
    const res = {}
    const handled = await buddy.handle(req, res, { pathname, searchParams: new URLSearchParams(search) })
    assert.ok(handled, `${pathname} should be handled by buddy.handle`)
    return res
  }
  return { buddy, call, storage }
}

async function api(path, { method = 'GET', body, device = 'dev-a' } = {}) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'X-Device-Key': device }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text }
}
const dev = () => 'dev-' + Math.random().toString(36).slice(2, 8)

test('GET /api/buddy with no buddy returns an empty account', async () => {
  const r = await api('/api/buddy', { device: dev() })
  assert.equal(r.status, 200)
  assert.equal(r.json.active, null)
  assert.deepEqual(r.json.buddies, [])
})

test('egg -> snaps -> hatch produces a named wild Axie with one trait and converted bond', async () => {
  const d = dev()
  const egg = await api('/api/buddy/egg', { method: 'POST', device: d })
  assert.equal(egg.status, 201, egg.text)
  assert.equal(egg.json.active.kind, 'wild')
  assert.equal(egg.json.active.hatchedAt, null)
  assert.equal(egg.json.active.egg.snaps, 0)

  const early = await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  assert.equal(early.status, 409, 'cannot hatch under 5 snaps')

  for (let i = 0; i < 6; i++) {
    const p = await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', caption: '', imageBase64: PNG_1x1, authorGuestId: d, buddy: true, lat: 22.30 + i * 0.01, lng: 114.17 } })
    assert.equal(p.status, 201, p.text)
    assert.ok(p.json.buddy, 'post response carries the buddy snap result')
  }
  const mid = await api('/api/buddy', { device: d })
  assert.equal(mid.json.active.egg.snaps, 6)
  assert.equal(mid.json.active.eggOdds.tier, 5)
  assert.ok(mid.json.active.eggOdds.nextTier === 20)

  const h = await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  assert.equal(h.status, 200, h.text)
  const b = h.json.active
  assert.equal(b.name, 'Miso')
  assert.equal(b.traits.length, 1)
  assert.equal(b.descriptor.parts.length, 6)
  assert.equal(b.bond, 6, 'egg snaps converted to bond')
  assert.equal(b.level, 1)
  assert.equal(h.json.lines.length, 1, 'one spoken line, for the one trait')
  assert.ok(b.wardrobe.unlocked.includes('hat'))
})

test('a buddy post records the photo path so the scrapbook can render a real thumbnail', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  const p = await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  assert.equal(p.status, 201, p.text)
  const g = await api('/api/buddy', { device: d })
  const photos = g.json.active.photos
  assert.ok(Array.isArray(photos), 'publicBuddy exposes photos')
  assert.equal(photos.length, 1)
  assert.match(photos[0].imagePath, /^\/uploads\//)
  assert.equal(photos[0].id, g.json.active.photoIds[0], 'photo id matches the post id in photoIds')
  assert.ok(typeof photos[0].at === 'string' && photos[0].at.length > 0)
})

test('un-keeping a photo drops it from the scrapbook and the feed, but never the bond it earned', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  const p = await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  assert.equal(p.status, 201, p.text)
  const photoId = p.json.post.id
  const before = await api('/api/buddy', { device: d })
  assert.equal(before.json.active.photos.length, 1)
  const snapCount = before.json.active.snapCount

  const gone = await api('/api/buddy/photo/unkeep', { method: 'POST', device: d, body: { photoId } })
  assert.equal(gone.status, 200, gone.text)
  const after = await api('/api/buddy', { device: d })
  assert.equal(after.json.active.photos.length, 0, 'photo record gone')
  assert.deepEqual(after.json.active.photoIds, [], 'photo id gone')
  assert.equal(after.json.active.snapCount, snapCount, 'the snap still happened')
  assert.equal(after.json.active.photoCount, snapCount - 1, 'but the book holds one photo fewer')
  assert.equal(after.json.active.egg.snaps, before.json.active.egg.snaps, 'egg progress is not taken back')

  const feed = await api('/api/feed')
  assert.ok(!(feed.json.posts || []).some((x) => x.id === photoId), 'the post left the feed too')

  const missing = await api('/api/buddy/photo/unkeep', { method: 'POST', device: d, body: { photoId } })
  assert.equal(missing.status, 404, 'un-keeping the same photo twice is a 404')
  const stranger = await api('/api/buddy/photo/unkeep', { method: 'POST', device: dev(), body: { photoId: 'no-such-photo' } })
  assert.equal(stranger.status, 404, 'an unknown id is a 404')
})

test('name filter and length', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  const bad = await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'x' } })
  assert.equal(bad.status, 400)
  const rude = await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'shithead' } })
  assert.equal(rude.status, 400)
})

test('retire keeps the old buddy and starts a fresh egg; switch changes the active one', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  const h = await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  const firstId = h.json.active.id
  const r = await api('/api/buddy/retire', { method: 'POST', device: d })
  assert.equal(r.status, 201)
  assert.notEqual(r.json.active.id, firstId)
  assert.equal(r.json.active.kind, 'wild')
  assert.equal(r.json.buddies.find((b) => b.id === firstId).retiredAt !== null, true)
  const s = await api('/api/buddy/switch', { method: 'POST', device: d, body: { buddyId: firstId } })
  assert.equal(s.status, 200)
  assert.equal(s.json.active.id, firstId)
  assert.equal(s.json.active.retiredAt, null, 'switching back un-retires')
})

// NOTE: this test drives server/buddy.mjs directly instead of through the running
// HTTP server. The daily bond cap (10) and the server's unrelated post rate limit
// (MAX_POSTS_PER_HOUR = 10, core.mjs) are numerically equal, so proving "one snap
// past the cap grants 0" needs an 11th /api/posts call in the same hour on one
// device — the rate limiter would 429 that call before buddy logic ever ran it.
// Calling buddy.handle()/recordSnap() directly exercises the exact fixed code path
// (bondByDay must survive the hatch reset) without that unrelated collision.
test('daily cap holds across hatch: egg snaps and post-hatch snaps share the same day bucket', async () => {
  const storeState = {}
  const storage = {
    get: (name, makeEmpty) => (storeState[name] ??= makeEmpty()),
    set: (name, val) => { storeState[name] = val },
  }
  // Date-aware, like the real manilaDayKey(date?) in core.mjs: must vary with the
  // date argument, or streakFor's backward-walking loop (called from publicBuddy)
  // never terminates.
  const helpers = {
    sendJson: (res, status, body) => { res.status = status; res.body = body },
    readBody: async (req) => Buffer.from(JSON.stringify(req._body ?? {})),
    deviceKeyFrom: (req) => req._device || '',
    manilaDayKey: (d) => (d instanceof Date ? d : new Date()).toISOString().slice(0, 10),
    fetchAxieGenes: async () => null,
    fetchAllOwnerAxies: async () => [],
    normalizeAddress: (a) => a,
  }
  const buddy = createBuddyModule({ storage, helpers, env: { BUDDY: '1' } })
  const call = async (pathname, { method = 'GET', body } = {}) => {
    const req = { method, headers: { get: () => null }, _body: body, _device: 'unit-dev' }
    const res = {}
    const handled = await buddy.handle(req, res, { pathname, searchParams: new URLSearchParams() })
    assert.ok(handled, `${pathname} should be handled by buddy.handle`)
    return res
  }
  const ownerKey = 'device:unit-dev'
  const snap = (id) => buddy.recordSnap({ id }, { buddy: true, ownerKey, hour: 12 })

  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) {
    const r = await snap(`egg-${i}`)
    assert.equal(r.kind, 'egg')
  }
  const h = await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  assert.equal(h.status, 200, JSON.stringify(h.body))
  assert.equal(h.body.active.bond, 6, 'egg snaps converted to bond')
  assert.equal(h.body.active.bondToday, 6, 'bondByDay carried across hatch, not reset')

  let last = null
  for (let i = 0; i < 10; i++) last = await snap(`post-${i}`)
  assert.equal(last.granted, 0, 'ten photos already counted today; the 10th post-hatch snap grants nothing')
  assert.equal(last.snapsToday, 10, 'six egg photos and four hatched ones: ten photos counted today')
  // bond is ten counted photos plus whatever bonus landed on top (a wish that matched any snap)
  const bonus = last.bond - 10
  assert.ok(bonus >= 0 && bonus <= 2, `bond ${last.bond} = ten photos + a small bonus`)
  assert.equal(last.bondToday, last.bond)

  const g = await call('/api/buddy')
  assert.equal(g.body.active.bond, last.bond)
  assert.equal(g.body.active.snapsToday, 10)
})

// The legacy limit of 10 posts/hour equals the daily bond cap, so a real player who shoots
// eleven photos in an hour would be 429'd off their own camera. Buddy posts get 40/hour; the
// eleventh is accepted and simply earns no bond (the daily cap already spent it).
test('buddy posts get a 40/hour ceiling: an 11th snap in the same hour is still accepted', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  const snap = () => api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  for (let i = 0; i < 5; i++) assert.equal((await snap()).status, 201, `egg snap ${i + 1}`)
  assert.equal((await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })).status, 200)
  for (let i = 0; i < 5; i++) assert.equal((await snap()).status, 201, `bond snap ${i + 1}`)
  const eleventh = await snap()
  assert.equal(eleventh.status, 201, `11th buddy snap must not be rate limited: ${eleventh.text}`)
  assert.equal(eleventh.json.buddy.granted, 0, 'daily bond cap already spent, the photo still goes in the book')
})

test('legacy (non-buddy) posts keep the 10/hour limit', async () => {
  const d = dev()
  for (let i = 0; i < 10; i++) {
    const p = await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d } })
    assert.equal(p.status, 201, `post ${i + 1}: ${p.text}`)
  }
  const eleventh = await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d } })
  assert.equal(eleventh.status, 429, eleventh.text)
  assert.equal(eleventh.json.limit, 10)
})

// The operator-only ladder seeding hook. It must not exist at all on a server that never set
// ADMIN_KEY, and a caller without the key must not be able to tell the route is there: both cases
// fall through to core's ordinary unknown-route 404, body and all.
test('the admin seed hook does not exist on a server with no ADMIN_KEY', async () => {
  const r = await fetch(base + '/api/admin/seed-bond', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ buddyId: 'whatever', bond: 200, monthlyBond: 200 }),
  })
  assert.equal(r.status, 404)
  assert.deepEqual(await r.json(), { error: 'Not found' }, 'the plain unknown-route 404, nothing that hints the route exists')
})

test('with ADMIN_KEY set, the seed hook writes bond and the monthly ladder shows it', async () => {
  adminServer = await startNodeServer({ BUDDY: '1', BUDDY_TEST_SKIP_CHAIN: '1', ADMIN_KEY: 'test-key' })
  const call = async (path, { method = 'GET', body, device, adminKey } = {}) => {
    const headers = { 'content-type': 'application/json' }
    if (device) headers['X-Device-Key'] = device
    if (adminKey) headers['X-Admin-Key'] = adminKey
    const r = await fetch(adminServer.baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: r.status, json, text }
  }
  const d = dev()
  await call('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await call('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  const h = await call('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Podium' } })
  assert.equal(h.status, 200, h.text)
  const buddyId = h.json.active.id

  const wrong = await call('/api/admin/seed-bond', { method: 'POST', adminKey: 'not-the-key', body: { buddyId, bond: 214, monthlyBond: 214 } })
  assert.equal(wrong.status, 404, 'a wrong key is indistinguishable from no route')
  assert.deepEqual(wrong.json, { error: 'Not found' })

  const ok = await call('/api/admin/seed-bond', { method: 'POST', adminKey: 'test-key', body: { buddyId, bond: 214, monthlyBond: 214 } })
  assert.equal(ok.status, 200, ok.text)
  assert.equal(ok.json.bond, 214)
  assert.equal(ok.json.level, 10, 'past the 120 bond the ladder tops out at')
  assert.ok(ok.json.wardrobe.unlocked.includes('crown'), 'wardrobe recomputed from the ladder for the new bond')
  assert.ok(ok.json.wardrobe.unlocked.includes('hat'), 'and the items it already had are kept')

  // A prototype-chain id must miss like any other unknown buddy, not reach Object.prototype
  const proto = await call('/api/admin/seed-bond', { method: 'POST', adminKey: 'test-key', body: { buddyId: 'constructor', bond: 9, monthlyBond: 9 } })
  assert.equal(proto.status, 404)
  assert.equal(proto.json.error, 'Buddy not found')

  const ladder = await call('/api/ladder/monthly', { device: d })
  assert.equal(ladder.status, 200)
  const row = ladder.json.rows.find((r) => r.buddyId === buddyId)
  assert.ok(row, 'the seeded buddy is on the monthly ladder')
  assert.equal(row.monthlyBond, 214)
  assert.equal(row.level, 10)
})

test('buddy posts still respect the cast lock for non-neutral cast ids', async () => {
  const d = dev()
  const p = await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'bing', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  assert.equal(p.status, 403, p.text)
})

test('monthly ladder ranks by bond this month and includes your row', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  const l = await api('/api/ladder/monthly', { device: d })
  assert.equal(l.status, 200)
  assert.ok(l.json.rows.length >= 1)
  assert.equal(l.json.you.monthlyBond, 5)
  assert.ok(l.json.rows.every((r, i) => i === 0 || l.json.rows[i - 1].monthlyBond >= r.monthlyBond))
  assert.ok(!('bondByDay' in l.json.rows[0]), 'ladder rows are public shapes only')
})

test('diary lists the week from the buddy record', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true, lat: 22.3 + i * 0.01, lng: 114.2 } })
  await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  const r = await api('/api/buddy/diary', { device: d })
  assert.equal(r.status, 200)
  assert.ok(r.json.entries.length >= 2, 'egg day and hatch day at least')
  assert.equal(r.json.entries[0].title, 'Found')
  assert.ok(r.json.entries.every((e) => typeof e.line === 'string' && e.line.length > 0))
})

test('talk answers from memory and never with a number', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  const r = await api('/api/buddy/talk', { method: 'POST', device: d, body: { text: 'Do you remember where you hatched?' } })
  assert.equal(r.status, 200)
  assert.match(r.json.reply, /hatch|came out|first/i)
  assert.doesNotMatch(r.json.reply, /\d/)
  const sad = await api('/api/buddy/talk', { method: 'POST', device: d, body: { text: 'I had a rough day' } })
  assert.match(sad.json.reply, /sofa|here|stay|face/i)
})

test('talk answers what was actually asked: a hatch question always gets the hatch line', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  const r = await api('/api/buddy/talk', { method: 'POST', device: d, body: { text: 'Where did you hatch?' } })
  assert.equal(r.status, 200)
  assert.match(r.json.reply, /came out|hatch/i)
  assert.doesNotMatch(r.json.reply, /\d/)
})

test('talk answers curiously to a question and generically otherwise, always without digits', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })
  const q = await api('/api/buddy/talk', { method: 'POST', device: d, body: { text: 'What is your favourite colour?' } })
  assert.equal(q.status, 200)
  assert.doesNotMatch(q.json.reply, /\d/)
  const other = await api('/api/buddy/talk', { method: 'POST', device: d, body: { text: 'The weather is nice today' } })
  assert.equal(other.status, 200)
  assert.doesNotMatch(other.json.reply, /\d/)
})

test('talk requires an active hatched Axie', async () => {
  const d = dev()
  const r = await api('/api/buddy/talk', { method: 'POST', device: d, body: { text: 'Hello' } })
  assert.equal(r.status, 409)
})

function wallet() {
  const priv = secp.utils.randomPrivateKey()
  const pub = secp.getPublicKey(priv, false)
  const address = '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
  const sign = (msg) => { const s = secp.sign(hashPersonalMessage(msg), priv); return '0x' + Buffer.from(s.toCompactRawBytes()).toString('hex') + (27 + s.recovery).toString(16) }
  return { address, sign }
}

test('ronin sign-in merges the device account and claim makes an owned buddy', async () => {
  const d = dev(); const w = wallet()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  const n = await api(`/api/ronin/nonce?address=${w.address}`, { device: d })
  assert.equal(n.status, 200)
  const v = await api('/api/ronin/verify', { method: 'POST', device: d, body: { address: w.address, signature: w.sign(n.json.message) } })
  assert.equal(v.status, 200, v.text)
  const session = v.json.session
  const me = await fetch(base + '/api/buddy', { headers: { 'X-Device-Key': d, 'X-Buddy-Session': session } }).then((r) => r.json())
  assert.equal(me.buddies.length, 1, 'device egg moved under the wallet')
  const c = await fetch(base + '/api/buddy/claim', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Device-Key': d, 'X-Buddy-Session': session }, body: JSON.stringify({ axieId: '6' }) }).then(async (r) => ({ status: r.status, json: await r.json() }))
  assert.equal(c.status, 201, JSON.stringify(c.json))
  assert.equal(c.json.active.kind, 'owned')
  assert.equal(c.json.active.axieId, '6')
  assert.equal(c.json.active.bond, 5)
  assert.equal(c.json.active.traits.length, 1)
  const bad = await api('/api/ronin/verify', { method: 'POST', device: d, body: { address: w.address, signature: w.sign('nope') } })
  assert.equal(bad.status, 401)
})

test('a signed-in wallet only earns bond when the post carries the buddy session header', async () => {
  const d = dev(); const w = wallet()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  const n = await api(`/api/ronin/nonce?address=${w.address}`, { device: d })
  const v = await api('/api/ronin/verify', { method: 'POST', device: d, body: { address: w.address, signature: w.sign(n.json.message) } })
  const session = v.json.session
  const post = (headers) => fetch(base + '/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Device-Key': d, ...headers },
    body: JSON.stringify({ axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true }),
  }).then(async (r) => ({ status: r.status, json: await r.json() }))
  const read = () => fetch(base + '/api/buddy', { headers: { 'X-Device-Key': d, 'X-Buddy-Session': session } }).then((r) => r.json())

  // Sign-in moved the egg from device:<key> to ronin:<addr>, so a device-key-only post has
  // no active buddy to credit — the snap earns nothing and the response carries no result.
  const blind = await post({})
  assert.equal(blind.status, 201, 'the post itself still succeeds')
  assert.equal(blind.json.buddy, null, 'no buddy result without the session header')
  assert.equal((await read()).active.egg.snaps, 0, 'the wallet buddy earned nothing')

  const signed = await post({ 'X-Buddy-Session': session })
  assert.equal(signed.status, 201, JSON.stringify(signed.json))
  assert.ok(signed.json.buddy, 'the session header credits the wallet account')
  assert.equal(signed.json.buddy.kind, 'egg')
  const after = await read()
  assert.equal(after.active.egg.snaps, 1)
  assert.match(after.active.photos[0].imagePath, /^\/uploads\//)
})

test('recovery code moves a guest account to a new device once', async () => {
  const d1 = dev(); const d2 = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d1 })
  const c = await api('/api/account/recovery', { method: 'POST', device: d1 })
  assert.equal(c.status, 200); assert.match(c.json.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  const r = await api('/api/account/recover', { method: 'POST', device: d2, body: { code: c.json.code } })
  assert.equal(r.status, 200); assert.equal(r.json.buddies.length, 1)
  const again = await api('/api/account/recover', { method: 'POST', device: dev(), body: { code: c.json.code } })
  assert.equal(again.status, 404)
})

test('recovery codes are guest-only: a signed-in wallet cannot mint one', async () => {
  const d = dev(); const w = wallet()
  const n = await api(`/api/ronin/nonce?address=${w.address}`, { device: d })
  const v = await api('/api/ronin/verify', { method: 'POST', device: d, body: { address: w.address, signature: w.sign(n.json.message) } })
  const session = v.json.session
  const r = await fetch(base + '/api/account/recovery', { method: 'POST', headers: { 'X-Device-Key': d, 'X-Buddy-Session': session } })
  assert.equal(r.status, 400)
  const j = await r.json()
  assert.equal(j.error, 'Recovery codes are for guest accounts; your wallet already keeps your Axies')
})

// --- rate limits, unauthenticated growth, record size -----------------------------------------

test('egg is capped at five an hour per device', async () => {
  const d = dev()
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/buddy/egg', { method: 'POST', device: d })
    assert.ok(r.status === 200 || r.status === 201, `egg ${i + 1}: ${r.text}`)
  }
  const sixth = await api('/api/buddy/egg', { method: 'POST', device: d })
  assert.equal(sixth.status, 429, sixth.text)
  assert.equal(sixth.json.limit, 5)
})

test('retire is capped at five an hour per device', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 4; i++) {
    assert.equal((await api('/api/buddy/retire', { method: 'POST', device: d })).status, 201, `retire ${i + 1}`)
  }
  // The egg above already spent one of the five slots this bucket holds.
  const fifth = await api('/api/buddy/retire', { method: 'POST', device: d })
  assert.equal(fifth.status, 429, fifth.text)
  assert.equal(fifth.json.limit, 5)
})

// A nonce is a challenge anyone can ask for, for any address they like. If asking created the
// account, an unauthenticated GET could grow the store one address at a time, for free.
test('asking for a nonce creates no account', async () => {
  const d = dev()
  const w = wallet()
  const n = await api(`/api/ronin/nonce?address=${w.address}`, { device: d })
  assert.equal(n.status, 200, n.text)
  const me = await api('/api/buddy', { device: d })
  assert.equal(me.status, 200)
  assert.equal(me.json.active, null, 'the nonce did not hand this device a buddy')
  assert.deepEqual(me.json.buddies, [])
})

test('a nonce leaves no ronin: account in the store, and only verify creates one', async () => {
  const { call, storage } = directModule()
  const address = '0x1111111111111111111111111111111111111111'
  const n = await call('/api/ronin/nonce', { search: `address=${address}` })
  assert.equal(n.status, 200, JSON.stringify(n.body))
  assert.ok(n.body.nonce, 'a nonce was issued')
  const store = storage.get('buddies', () => ({}))
  assert.deepEqual(
    Object.keys(store.accounts).filter((k) => k.startsWith('ronin:')),
    [],
    'no ronin account was minted by an unsigned GET',
  )
  assert.deepEqual(Object.keys(store.pendingNonces[address]), [n.body.nonce], 'the nonce is held outside the accounts')

  // A signature that does not recover to this address must not create one either.
  const bad = await call('/api/ronin/verify', { method: 'POST', body: { address, signature: '0x' + '11'.repeat(65) } })
  assert.equal(bad.status, 401)
  assert.deepEqual(Object.keys(store.accounts).filter((k) => k.startsWith('ronin:')), [])
})

test('a nonce request never holds more than five nonces for one address', async () => {
  const { call, storage } = directModule()
  const address = '0x2222222222222222222222222222222222222222'
  for (let i = 0; i < 9; i++) await call('/api/ronin/nonce', { search: `address=${address}` })
  const store = storage.get('buddies', () => ({}))
  assert.equal(Object.keys(store.pendingNonces[address]).length, 5)
})

test('one account holds at most twenty Axies', async () => {
  const { buddy, call, storage } = directModule()
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 19; i++) {
    const r = await call('/api/buddy/retire', { method: 'POST' })
    assert.equal(r.status, 201, `retire ${i + 1}: ${JSON.stringify(r.body)}`)
  }
  const store = storage.get('buddies', () => ({}))
  const acc = store.accounts['device:unit-dev']
  assert.equal(acc.buddyIds.length, 20)

  const twentyFirst = await call('/api/buddy/retire', { method: 'POST' })
  assert.equal(twentyFirst.status, 409)
  assert.deepEqual(twentyFirst.body, { error: 'Too many Axies in the scrapbook' })

  // `egg` answers the same way once nothing is active to fall back on.
  acc.activeBuddyId = null
  const egg = await call('/api/buddy/egg', { method: 'POST' })
  assert.equal(egg.status, 409)
  assert.deepEqual(egg.body, { error: 'Too many Axies in the scrapbook' })
  assert.equal(buddy.load().accounts['device:unit-dev'].buddyIds.length, 20, 'nothing was added')
})

test('photoIds keeps the first five and the last sixty; snapCount stays the true total', () => {
  const { buddy, call } = directModule()
  return call('/api/buddy/egg', { method: 'POST' }).then(async () => {
    for (let i = 0; i < 80; i++) await buddy.recordSnap({ id: `p-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
    const b = buddy.getActive('device:unit-dev')
    assert.equal(b.snapCount, 80)
    assert.equal(b.photoIds.length, 65)
    assert.deepEqual(b.photoIds.slice(0, 5), ['p-0', 'p-1', 'p-2', 'p-3', 'p-4'], 'the head the diary indexes into')
    assert.equal(b.photoIds.at(-1), 'p-79', 'the tail the scrapbook shows')
    assert.equal(b.photos.length, 60)
  })
})

// --- the earned fourth trait ------------------------------------------------------------------

async function hatchedBuddy() {
  const { buddy, call } = directModule()
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  const h = await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  assert.equal(h.status, 200, JSON.stringify(h.body))
  return { buddy, b: buddy.getActive('device:unit-dev') }
}

test('crossing to bond level 10 earns a fourth trait from how the Axie was played', async () => {
  const plain = await hatchedBuddy()
  assert.equal(plain.b.earnedTrait, null, 'not earned before level 10')
  plain.b.bond = 119
  plain.buddy.addBond(plain.b, 1)
  assert.equal(plain.b.bond, 120)
  assert.equal(plain.b.earnedTrait, 'Socialite', 'no night moments, few places')

  const owl = await hatchedBuddy()
  owl.b.moments.push({ id: 'night-owl', at: new Date().toISOString(), photoId: 'x' })
  owl.b.bond = 119
  owl.buddy.addBond(owl.b, 1)
  assert.equal(owl.b.earnedTrait, 'Night owl')

  const wanderer = await hatchedBuddy()
  wanderer.b.places = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`g${i}`, { first: 'x', count: 1, district: null }]))
  wanderer.b.bond = 119
  wanderer.buddy.addBond(wanderer.b, 1)
  assert.equal(wanderer.b.earnedTrait, 'Wanderer')

  // Earned once, and never re-decided by later bond.
  wanderer.b.moments.push({ id: 'night-owl', at: new Date().toISOString(), photoId: 'x' })
  wanderer.buddy.addBond(wanderer.b, 1)
  assert.equal(wanderer.b.earnedTrait, 'Wanderer')
})

test('the ceiling is on photos: with ten counted, a photo grants nothing but a wish that came true still pays', async () => {
  const { buddy, b } = await hatchedBuddy()
  const day = new Date().toISOString().slice(0, 10)
  // 'crowd' matches any snap, so only the ceiling decides what lands.
  b.wish = { day, id: 'crowd', text: 'Take me where the people are', bonus: 1, done: false }
  b.snapsByDay[day] = 10 // ten photos already counted today
  const bondBefore = b.bond
  const capped = await buddy.recordSnap({ id: 'capped' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  assert.equal(capped.granted, 0, 'the eleventh photo is not counted')
  assert.equal(capped.snapsToday, 10)
  assert.ok(capped.wishDone, 'the wish bonus is not subject to the photo ceiling')
  assert.equal(b.bond, bondBefore + 1, 'only the wish bonus landed')
  assert.equal(b.wish.done, true)
})

test('a fresh day counts photos again', async () => {
  const { buddy, b } = await hatchedBuddy()
  const day = new Date().toISOString().slice(0, 10)
  b.wish = { day, id: 'crowd', text: 'Take me where the people are', bonus: 1, done: false }
  b.snapsByDay[day] = 10
  const capped = await buddy.recordSnap({ id: 'capped' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  assert.equal(capped.granted, 0)
  assert.equal(b.wish.done, true, 'the wish paid even on a full day')

  b.snapsByDay[day] = 0 // a new day's worth of room
  const open = await buddy.recordSnap({ id: 'open' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  assert.equal(open.granted, 1, 'the photo counts again')
  assert.equal(open.snapsToday, 1)
})

// --- the voice rule at the HTTP edge -----------------------------------------------------------

// Two trait pools of one line each: by the third greeting both are in `recentLines` and pickLine
// falls through to TEMPLATES, where `{count}`/`{days}` are filled from real numbers.
test('the greeting never carries a digit, even once it falls through to the templates', async () => {
  const d = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d })
  for (let i = 0; i < 5; i++) await api('/api/posts', { method: 'POST', device: d, body: { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true } })
  assert.equal((await api('/api/buddy/hatch', { method: 'POST', device: d, body: { name: 'Miso' } })).status, 200)
  for (let i = 0; i < 3; i++) {
    const g = await api('/api/buddy', { device: d })
    assert.equal(g.status, 200)
    assert.ok(typeof g.json.greeting === 'string' && g.json.greeting.length > 0, `greeting ${i + 1} present`)
    assert.doesNotMatch(g.json.greeting, /\d/, `greeting ${i + 1}: ${g.json.greeting}`)
  }
})

// --- the flag ----------------------------------------------------------------------------------

test('with BUDDY=0 the buddy routes do not exist', async () => {
  flagOffServer = await startNodeServer({ BUDDY: '0' })
  const r = await fetch(flagOffServer.baseUrl + '/api/buddy', { headers: { 'X-Device-Key': dev() } })
  assert.equal(r.status, 404)
  assert.deepEqual(await r.json(), { error: 'Not found' })
})

test('a device redeeming its own recovery code is a no-op that does not burn the code', async () => {
  const d1 = dev(); const d2 = dev()
  await api('/api/buddy/egg', { method: 'POST', device: d1 })
  const c = await api('/api/account/recovery', { method: 'POST', device: d1 })
  assert.equal(c.status, 200)
  const self = await api('/api/account/recover', { method: 'POST', device: d1, body: { code: c.json.code } })
  assert.equal(self.status, 200); assert.equal(self.json.buddies.length, 1, 'self-redeem is a no-op, still one buddy')
  const other = await api('/api/account/recover', { method: 'POST', device: d2, body: { code: c.json.code } })
  assert.equal(other.status, 200, 'code was not burned by the self-redeem'); assert.equal(other.json.buddies.length, 1)
  const again = await api('/api/account/recover', { method: 'POST', device: dev(), body: { code: c.json.code } })
  assert.equal(again.status, 404, 'code is burned once actually redeemed elsewhere')
})

/** A fake voice model: answers from a queue, records every prompt it was given. */
function fakeVoice(answers) {
  const calls = []
  return {
    enabled: true,
    calls,
    ask: async (args) => { calls.push(args); return answers.length ? answers.shift() : null },
  }
}
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

test('after a photo, the model says what it saw: its nouns become the chips and its line is the reaction', async () => {
  const voice = fakeVoice([{ seen: ['Staircase', 'railing', 'a small cartoon axie', 'tree'], line: 'Stairs. Can we go up them? All of them.' }])
  const { buddy, call } = directModule({ voice })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  assert.equal(voice.calls.length, 0, 'an egg does not look at photos')
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const r = await buddy.recordSnap({ id: 'p1' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12, image: PHOTO, placeType: 'park' })
  assert.equal(voice.calls.length, 1)
  assert.equal(voice.calls[0].image.mime, 'image/jpeg')
  assert.match(voice.calls[0].system, /You are Cappy/)
  assert.match(voice.calls[0].user, /park, for the first time|at a park/)
  assert.deepEqual(r.labels, ['staircase', 'railing', 'tree'], 'nouns cleaned, the creature itself dropped')
  assert.equal(r.line, 'Stairs. Can we go up them? All of them.')
  const b = buddy.getActive('device:unit-dev')
  assert.deepEqual(b.seen.at(-1).seen, ['staircase', 'railing', 'tree'])
})

test('a model line that breaks the rules is dropped and the library speaks instead', async () => {
  const voice = fakeVoice([{ seen: ['dog'], line: 'Level 4 already! That is 2 dogs today!!' }, null])
  const { buddy, call } = directModule({ voice })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const r = await buddy.recordSnap({ id: 'p1' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12, image: PHOTO })
  assert.doesNotMatch(r.line, /\d/, 'never a digit on screen')
  assert.deepEqual(r.labels, ['dog'], 'the nouns are still kept')
  // the model failing outright (null) also leaves the library to speak
  const r2 = await buddy.recordSnap({ id: 'p2' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12, image: PHOTO })
  assert.ok(typeof r2.line === 'string' && r2.line.length > 0)
  assert.doesNotMatch(r2.line, /\d/)
})

test('talk goes through the model with the conversation so far, and the log is kept', async () => {
  const voice = fakeVoice([{ reply: 'Hello you. Where are we going first?' }, { reply: 'The park. Obviously the park.' }])
  const { buddy, call } = directModule({ voice })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const a = await call('/api/buddy/talk', { method: 'POST', body: { text: 'hi there' } })
  assert.equal(a.body.reply, 'Hello you. Where are we going first?')
  const b2 = await call('/api/buddy/talk', { method: 'POST', body: { text: 'where do you want to go?' } })
  assert.equal(b2.body.reply, 'The park. Obviously the park.')
  assert.match(voice.calls[1].user, /Person: hi there\nYou: Hello you/, 'the earlier exchange is in the prompt')
  assert.match(voice.calls[1].user, /Person: where do you want to go\?/)
  const b = buddy.getActive('device:unit-dev')
  assert.equal(b.talkLog.length, 2)
  const empty = await call('/api/buddy/talk', { method: 'POST', body: { text: '   ' } })
  assert.equal(empty.status, 400)
})

test('the greeting is asked once a day and repeated on every later open that day', async () => {
  const voice = fakeVoice([{ line: 'Morning. Shoes on, I have a plan.' }])
  const { buddy, call } = directModule({ voice })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const first = await call('/api/buddy')
  const second = await call('/api/buddy')
  assert.equal(first.body.greeting, 'Morning. Shoes on, I have a plan.')
  assert.equal(second.body.greeting, first.body.greeting)
  assert.equal(voice.calls.length, 1, 'one model call for the day')
})

test('without a model, talk still answers the things people type, in voice and without digits', async () => {
  const { buddy, call } = directModule()
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  for (const text of ['hello!', 'I love you', 'want to go for a walk?', 'are you hungry', 'good night', 'what is your wish today', 'why is the sky blue?', 'blah']) {
    const r = await call('/api/buddy/talk', { method: 'POST', body: { text } })
    assert.equal(r.status, 200, text)
    assert.ok(r.body.reply.length > 0, text)
    assert.doesNotMatch(r.body.reply, /\d/, text)
  }
})


test('an operator can remove any post from the feed with the admin key; without it the route does not exist', async () => {
  const adminBase = adminServer ? adminServer.baseUrl : (adminServer = await startNodeServer({ BUDDY: '1', BUDDY_TEST_SKIP_CHAIN: '1', ADMIN_KEY: 'test-key' })).baseUrl
  const d = dev()
  const post = async (path, body, headers = {}) => {
    const r = await fetch(adminBase + path, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Device-Key': d, ...headers }, body: JSON.stringify(body) })
    return { status: r.status, json: await r.json().catch(() => null) }
  }
  await post('/api/buddy/egg', {})
  const made = await post('/api/posts', { axieId: 'kotaro', imageBase64: PNG_1x1, authorGuestId: d, buddy: true })
  assert.equal(made.status, 201, JSON.stringify(made.json))
  const id = made.json.post?.id || made.json.id
  assert.ok(id, 'post id ' + JSON.stringify(made.json).slice(0, 200))
  const noKey = await post('/api/admin/remove-post', { id })
  assert.equal(noKey.status, 404, 'no key: not a route')
  const wrongKey = await post('/api/admin/remove-post', { id }, { 'X-Admin-Key': 'nope' })
  assert.equal(wrongKey.status, 404, 'wrong key: not a route')
  const gone = await post('/api/admin/remove-post', { id }, { 'X-Admin-Key': 'test-key' })
  assert.equal(gone.status, 200, JSON.stringify(gone.json))
  assert.equal(gone.json.removed, true)
  const feed = await (await fetch(adminBase + '/api/feed')).json()
  assert.ok(!(feed.posts || []).some((p) => p.id === id), 'the post left the feed')
})


test('look: the Axie sees the capture before the post, and the post reuses that look instead of asking twice', async () => {
  const voice = fakeVoice([{ seen: ['stairs', 'railing'], line: 'Stairs. Up. All of them.' }, { seen: ['dog'], line: 'A dog. Can we keep it?' }])
  const { buddy, call } = directModule({ voice })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const look = await call('/api/buddy/look', { method: 'POST', body: { imageBase64: PHOTO, hour: 15 } })
  assert.equal(look.status, 200)
  assert.ok(look.body.id, 'a look id')
  assert.equal(look.body.line, 'Stairs. Up. All of them.')
  assert.deepEqual(look.body.labels, ['stairs', 'railing'])
  assert.equal(voice.calls.length, 1)
  const r = await buddy.recordSnap({ id: 'p1' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 15, image: PHOTO, lookId: look.body.id })
  assert.equal(voice.calls.length, 1, 'the post did not ask the model again')
  assert.equal(r.line, 'Stairs. Up. All of them.')
  assert.deepEqual(r.labels, ['stairs', 'railing'])
  // a post without the id (the look never landed on the client) asks afresh and never reuses a look
  const look2 = await call('/api/buddy/look', { method: 'POST', body: { imageBase64: PHOTO } })
  assert.ok(look2.body.id)
  voice.calls.length = 0
  const answers = [{ seen: ['cat'], line: 'A cat. It looked at me first.' }]
  voice.ask = async (args) => { voice.calls.push(args); return answers.shift() || null }
  const r2 = await buddy.recordSnap({ id: 'p2' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 15, image: PHOTO })
  assert.equal(voice.calls.length, 1, 'asked for this photo')
  assert.equal(r2.line, 'A cat. It looked at me first.')
  const b = buddy.getActive('device:unit-dev')
  assert.equal(b.pendingLook, null, 'a stale look is dropped, never carried to a later photo')
})

test('look without a model, or before the hatch, has nothing to say', async () => {
  const { buddy, call } = directModule()
  await call('/api/buddy/egg', { method: 'POST' })
  const early = await call('/api/buddy/look', { method: 'POST', body: { imageBase64: PHOTO } })
  assert.equal(early.status, 409)
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const none = await call('/api/buddy/look', { method: 'POST', body: { imageBase64: PHOTO } })
  assert.equal(none.status, 200)
  assert.equal(none.body.id, null)
  assert.equal(none.body.line, null)
})

test('typed chat is off unless TALK=1: the route is simply not there', async () => {
  const { buddy, call } = directModule({ env: { BUDDY: '1' } })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const req = { method: 'POST', headers: { get: () => null }, _body: { text: 'hi' }, _device: 'unit-dev' }
  const res = {}
  const handled = await buddy.handle(req, res, { pathname: '/api/buddy/talk', searchParams: new URLSearchParams('') })
  assert.equal(handled, false, 'falls through to the host 404')
})


test('a record from before one-trait R1 is read with one current trait', async () => {
  const { buddy, call } = directModule()
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  const b = buddy.getActive('device:unit-dev')
  b.traits = ['Show-off', 'Athlete', 'Dreamer'] // as the store held it before the change
  const r = await call('/api/buddy')
  assert.deepEqual(r.body.active.traits, ['Explorer'])
  b.traits = ['Dreamer', 'Brave', 'Homebody']
  const r2 = await call('/api/buddy')
  assert.deepEqual(r2.body.active.traits, ['Explorer'])
})


test('look: a spot the Axie has stood on before reaches the model as memory, a new spot does not', async () => {
  const voice = fakeVoice([{ seen: ['slide'], line: 'A slide. Let us go up.' }, { seen: ['slide'], line: 'That slide again. Let us go higher.' }, { seen: ['sea'], line: 'The sea. Let us go closer.' }])
  const { buddy, call } = directModule({ voice })
  await call('/api/buddy/egg', { method: 'POST' })
  for (let i = 0; i < 6; i++) await buddy.recordSnap({ id: `e-${i}` }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12, lat: 22.30, lng: 114.17 })
  await call('/api/buddy/hatch', { method: 'POST', body: { name: 'Cappy' } })
  // the egg's six photos were all taken here, so the first hatched look knows the spot
  await call('/api/buddy/look', { method: 'POST', body: { imageBase64: PHOTO, lat: 22.30, lng: 114.17 } })
  assert.match(voice.calls[0].user, /stood on this exact spot six times before/)
  await buddy.recordSnap({ id: 'p1' }, { buddy: true, ownerKey: 'device:unit-dev', hour: 12, image: PHOTO, lat: 22.30, lng: 114.17 })
  assert.match(voice.calls[1].user, /stood on this exact spot six times before/, 'the photo being taken now is not counted as before')
  await call('/api/buddy/look', { method: 'POST', body: { imageBase64: PHOTO, lat: 22.28, lng: 114.16 } })
  assert.doesNotMatch(voice.calls[2].user, /exact spot/, 'a different spot carries no such memory')
  assert.match(voice.calls[2].user, /Earlier today you saw slide\./, 'what the last photo showed is remembered by day')
})
