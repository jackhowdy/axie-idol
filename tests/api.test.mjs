import { existsSync } from 'node:fs'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startNodeServer } from './helpers/start-node-server.mjs'

const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let base = process.env.BASE_URL || ''
let server = null

before(async () => {
  if (!base) {
    server = await startNodeServer()
    base = server.baseUrl
  }
})
after(async () => {
  if (server) await server.stop()
})

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON */
  }
  return { status: r.status, json, text, headers: r.headers }
}

function guest(tag) {
  const id = `guest-${tag}-${Math.random().toString(36).slice(2, 8)}`
  return { authorGuestId: id, authorLabel: `Guest-${tag.toUpperCase()}`, deviceKey: `dev-${id}` }
}

async function post(g, axieId = 'kotaro', caption = 'hello') {
  return api('/api/posts', { method: 'POST', body: { ...g, axieId, caption, imageBase64: PNG_1x1 } })
}

test('a guest post under the neutral id saves the photo and serves the upload', async () => {
  const g = guest('first')
  const r = await post(g)
  assert.equal(r.status, 201, r.text)
  assert.equal(r.json.post.axieId, 'kotaro')
  assert.match(r.json.post.imagePath, /^\/uploads\/[0-9a-f-]+\.png$/)
  assert.equal(r.json.buddy, null, 'no buddy flag, so no snap is credited')
  const img = await fetch(base + r.json.post.imagePath)
  assert.equal(img.status, 200)
  assert.match(img.headers.get('content-type'), /image\/png/)
})

test('a post under an id that is neither the neutral one nor a numeric Axie id is refused', async () => {
  const g = guest('badid')
  const r = await post(g, 'bing')
  assert.equal(r.status, 400)
  assert.match(r.json.error, /axieId/)
})

test('a post under a numeric Axie id needs an owner address', async () => {
  const g = guest('noowner')
  const r = await post(g, '4154')
  assert.equal(r.status, 403)
  assert.match(r.json.error, /ownerAddress required/)
})

test('the routes of the earlier feed app are gone', async () => {
  for (const path of ['/api/feed', '/api/board', '/api/quests', '/api/cast', '/api/cast-crew', '/api/follows', '/api/followers/count', '/api/notifications', '/api/profile', '/api/owner', '/api/inventory', '/api/burns/today', '/api/metadata/1', '/api/posts']) {
    const r = await api(path)
    assert.equal(r.status, 404, path)
  }
  for (const path of ['/api/follow', '/api/unfollow', '/api/follow/toggle', '/api/notifications/read', '/api/owner/sync', '/api/burns/boost', '/api/burns/settle-day', '/api/posts/x/like', '/api/posts/x/comments']) {
    const r = await api(path, { method: 'POST', body: { deviceKey: 'dev-gone' } })
    assert.equal(r.status, 404, path)
  }
})

test('11th post in an hour from one device is rate limited', async () => {
  const g = guest('rate')
  for (let i = 0; i < 10; i++) {
    const r = await post(g, 'kotaro', `p${i}`)
    assert.equal(r.status, 201, `post ${i}: ${r.text}`)
  }
  const r = await post(g, 'kotaro', 'p10')
  assert.equal(r.status, 429)
})

// the one test that needs the built game: skipped, with a reason, until `npm run build` has run
test('SPA fallback serves index.html for unknown routes', { skip: existsSync('dist/index.html') ? false : 'needs a build: run `npm run build` first' }, async () => {
  const r = await fetch(base + '/some/deep/link')
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type'), /text\/html/)
})

test('GET /api/axie/:id validates the id and reports a missing API key clearly', async () => {
  const bad = await api('/api/axie/abc')
  assert.equal(bad.status, 400)
  const nokey = await api('/api/axie/4154')
  assert.equal(nokey.status, 502)
  assert.match(nokey.json.error, /SKYMAVIS_API_KEY/)
})
