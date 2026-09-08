import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startNodeServer } from './helpers/start-node-server.mjs'

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
let base = process.env.BASE_URL || ''
let server = null
before(async () => { if (!base) { server = await startNodeServer({ BUDDY: '1' }); base = server.baseUrl } })
after(async () => { if (server) await server.stop() })

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

test('egg -> snaps -> hatch produces a named wild Axie with three traits and converted bond', async () => {
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
  assert.equal(b.traits.length, 3)
  assert.equal(b.descriptor.parts.length, 6)
  assert.equal(b.bond, 6, 'egg snaps converted to bond')
  assert.equal(b.level, 1)
  assert.equal(h.json.lines.length, 3, 'three spoken lines, one per trait')
  assert.ok(b.wardrobe.unlocked.includes('hat'))
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
