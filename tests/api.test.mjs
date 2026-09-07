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

test('GET /api/cast returns the 18 faces plus the secret Golden Axie, Kotaro first', async () => {
  const r = await api('/api/cast')
  assert.equal(r.status, 200)
  assert.equal(r.json.cast.length, 19)
  assert.equal(r.json.cast[0].id, 'kotaro')
  assert.equal(r.json.cast.at(-2).id, 'agonia-echo')
  assert.equal(r.json.cast.at(-1).id, 'golden')
})

test('first guest post as Kotaro unlocks Bing (L1) and Bing welcomes the post', async () => {
  const g = guest('first')
  const r = await post(g)
  assert.equal(r.status, 201, r.text)
  assert.equal(r.json.post.axieId, 'kotaro')
  assert.match(r.json.post.imagePath, /^\/uploads\/[0-9a-f-]+\.png$/)
  assert.equal(r.json.castCrew.level, 1)
  assert.ok(r.json.castCrew.unlockedCast.includes('bing'))
  const welcome = r.json.post.comments.find((c) => c.cast && c.castId === 'bing')
  assert.ok(welcome, 'Bing welcome comment present')
  const img = await fetch(base + r.json.post.imagePath)
  assert.equal(img.status, 200)
  assert.match(img.headers.get('content-type'), /image\/png/)
})

test('posting as a locked cast face is refused with 403', async () => {
  const g = guest('locked')
  const r = await post(g, 'bing')
  assert.equal(r.status, 403)
  assert.match(r.json.error, /locked/)
})

test("one comment reaches L2 and unlocks Kotaro's sword", async () => {
  const g = guest('cmt')
  const p = await post(g)
  const c = await api(`/api/posts/${p.json.post.id}/comments`, {
    method: 'POST',
    body: { ...g, text: 'hi crew' },
  })
  assert.equal(c.status, 201, c.text)
  assert.equal(c.json.comment.text, 'hi crew')
  assert.equal(c.json.castCrew.level, 2)
  assert.ok(c.json.castCrew.unlockedProps.includes('kotaro-sword'))
})

test('like is idempotent per device and counts once', async () => {
  const g = guest('like')
  const p = await post(g)
  const other = guest('liker')
  const a = await api(`/api/posts/${p.json.post.id}/like`, { method: 'POST', body: { ...other } })
  assert.equal(a.status, 200, a.text)
  assert.equal(a.json.liked, true)
  assert.equal(a.json.post.likes, 1)
  const b = await api(`/api/posts/${p.json.post.id}/like`, { method: 'POST', body: { ...other } })
  assert.equal(b.json.post.likes, 1)
  const u = await api(`/api/posts/${p.json.post.id}/like`, {
    method: 'POST',
    body: { ...other, unlike: true },
  })
  assert.equal(u.json.liked, false)
  assert.equal(u.json.post.likes, 0)
})

test('global feed lists the post and reports warm rank; seeds are absent', async () => {
  const g = guest('feed')
  const p = await post(g, 'kotaro', 'feed me')
  const r = await api(`/api/feed?deviceKey=${g.deviceKey}&guestId=${g.authorGuestId}`)
  assert.equal(r.status, 200)
  assert.equal(r.json.rank, 'warm')
  assert.ok(r.json.posts.some((x) => x.id === p.json.post.id))
  assert.ok(r.json.posts.every((x) => !x.seed))
})

test('quest endpoint and board agree on the poster level', async () => {
  const g = guest('board')
  await post(g)
  const q = await api(`/api/quests?guestId=${g.authorGuestId}&deviceKey=${g.deviceKey}`)
  assert.equal(q.status, 200)
  assert.equal(q.json.level, 1)
  assert.equal(q.json.nextQuest.level, 2)
  const b = await api('/api/board?range=daily')
  assert.equal(b.status, 200)
  assert.equal(b.json.sortBy, 'questLevel')
  assert.ok(b.json.rankings.length >= 1)
  assert.ok(b.json.rankings.every((r, i, a) => i === 0 || a[i - 1].level >= r.level))
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

test('follow needs an address, is stored per address, and counts followers', async () => {
  const address = '0x' + 'a'.repeat(40)
  const no = await api('/api/follow', { method: 'POST', body: { axieId: 'kotaro' } })
  assert.equal(no.status, 401)
  const f = await api('/api/follow', {
    method: 'POST',
    body: { address, axieId: 'kotaro', deviceKey: 'dev-follow' },
  })
  assert.equal(f.status, 200, f.text)
  assert.equal(f.json.following, true)
  assert.ok(f.json.follows.includes('kotaro'))
  const list = await api(`/api/follows?address=${address}`)
  assert.ok(list.json.follows.includes('kotaro'))
  const count = await api('/api/followers/count?axieId=kotaro')
  assert.ok(count.json.followerCount >= 1)
})

test('profile for an address returns level, follows and burns', async () => {
  const address = '0x' + 'b'.repeat(40)
  const r = await api(`/api/profile?address=${address}`)
  assert.equal(r.status, 200)
  assert.equal(r.json.timezone, 'Asia/Manila')
  assert.ok('level' in r.json)
  assert.ok(Array.isArray(r.json.follows))
})

test('metadata proxy validates the id', async () => {
  const bad = await api('/api/metadata/abc')
  assert.equal(bad.status, 400)
})

test('SPA fallback serves index.html for unknown routes', async () => {
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
