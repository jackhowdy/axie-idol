import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startNodeServer } from './helpers/start-node-server.mjs'

const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let base = ''
let server = null
before(async () => {
  server = await startNodeServer({ GOLDEN_ODDS: '1' })
  base = server.baseUrl
})
after(async () => {
  if (server) await server.stop()
})

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON */
  }
  return { status: r.status, json, text }
}
function guest(tag) {
  const id = `guest-${tag}-${Math.random().toString(36).slice(2, 8)}`
  return { authorGuestId: id, authorLabel: `Squad-${tag}`, deviceKey: `dev-${id}` }
}

test('with GOLDEN_ODDS=1 a post finds the Golden Axie, unlocks the golden face, and the Hall of Fame updates', async () => {
  const g = guest('gold')
  const r = await api('/api/posts', { method: 'POST', body: { ...g, axieId: 'kotaro', caption: 'lucky', imageBase64: PNG_1x1, shiny: ['kotaro', 'nope!', 'kotaro'] } })
  assert.equal(r.status, 201, r.text)
  assert.equal(r.json.goldenFound, true)
  assert.equal(r.json.post.golden, true)
  assert.deepEqual(r.json.post.shiny, ['kotaro'])
  assert.ok(r.json.castCrew.unlockedCast.includes('golden'))
  assert.ok(r.json.golden.count >= 1)
  assert.equal(r.json.golden.latest.label, g.authorLabel)

  // The finder can now post as the golden face; a fresh guest cannot
  const again = await api('/api/posts', { method: 'POST', body: { ...g, axieId: 'golden', caption: 'shine', imageBase64: PNG_1x1 } })
  assert.equal(again.status, 201, again.text)
  const other = guest('nogold')
  const locked = await api('/api/posts', { method: 'POST', body: { ...other, axieId: 'golden', caption: 'x', imageBase64: PNG_1x1 } })
  assert.equal(locked.status, 403)
})
