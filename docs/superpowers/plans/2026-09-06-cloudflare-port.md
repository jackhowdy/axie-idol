# Cloudflare Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Axie Idol backend on Cloudflare (Worker + one Durable Object + R2 + static assets) with byte-identical API behaviour to today's Node server, while keeping `node server.mjs` working for local development.

**Architecture:** The 4,000-line `server.mjs` is split into a runtime-agnostic core (`server/core.mjs`) that owns every handler, the quest engine, feed ranking and burns, and talks to storage only through a tiny injected adapter (`storage.get(name)` / `storage.set(name, obj)` for the six JSON stores, `blobs.put(name, bytes, mime)` for uploads). Two hosts wrap the core: the Node host (file-backed adapter, serves `dist/` and `data/uploads/`) and the Worker host, where every `/api/*` request is forwarded to a single Durable Object named `main` that loads the stores into memory on first use, runs the core handler, and flushes only the stores that changed. Posts are persisted one key per post because SQLite-backed Durable Objects cap a key+value at 2 MB.

**Tech Stack:** Node 24, Vite 6, Cloudflare Workers with `nodejs_compat`, SQLite-backed Durable Objects, R2, Workers Static Assets, wrangler 4, `node:test` for characterization tests.

## Global Constraints

- API paths, request bodies, response JSON shapes and status codes must not change. The client (`src/main.ts`) is untouched by this plan.
- `node server.mjs` must keep working exactly as documented in the README (port 5174, `dist/`, `data/*.json`, `data/uploads/`).
- Seeds stay off unless `SEED_POSTS=1`. Burns UI stays hidden. No behaviour change to quests, feed ranking or burns.
- Secrets never enter the repo: `SKYMAVIS_API_KEY` is a Wrangler secret; `VITE_WAYPOINT_CLIENT_ID` is a build-time variable from `.env`.
- Workers Free plan only: SQLite-backed Durable Objects (`new_sqlite_classes`), R2 free tier, no paid features.
- Every task ends with `npm test` green against the Node host; Task 4 onward also green against `wrangler dev`.

---

### Task 1: Characterization tests against the current Node server

**Files:**
- Modify: `server.mjs:26-48` (DATA_DIR override), `package.json` (test script)
- Create: `tests/helpers/start-node-server.mjs`, `tests/api.test.mjs`

**Interfaces:**
- Consumes: the running HTTP API as it exists today.
- Produces: `tests/api.test.mjs` reads `BASE_URL` from the environment; when unset it starts the Node server itself on a free port with a temp `DATA_DIR`. Task 4 reuses the same file against `wrangler dev` by setting `BASE_URL`.

- [ ] **Step 1: Let the Node server take a data directory from the environment**

In `server.mjs`, replace

```js
const DATA_DIR = resolve(__dirname, 'data')
```

with

```js
const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(__dirname, 'data')
```

(`DATA_DIR` must be resolved before `UPLOADS_DIR` and the six `*_FILE` constants, which already derive from it.)

- [ ] **Step 2: Write the server launcher helper**

`tests/helpers/start-node-server.mjs`:

```js
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'

function freePort() {
  return new Promise((res) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
  })
}

async function waitFor(url, ms = 15000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`server did not start: ${url}`)
}

/** Starts `node server.mjs` on a free port with a temp DATA_DIR. Returns { baseUrl, stop }. */
export async function startNodeServer() {
  const port = await freePort()
  const dataDir = mkdtempSync(join(tmpdir(), 'axie-idol-test-'))
  const child = spawn(process.execPath, [resolve('server.mjs')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, SEED_POSTS: '0', SKYMAVIS_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  const baseUrl = `http://127.0.0.1:${port}`
  try {
    await waitFor(`${baseUrl}/api/cast`)
  } catch (err) {
    child.kill()
    throw new Error(`${err.message}\n${log}`)
  }
  return {
    baseUrl,
    stop: () => new Promise((res) => { child.once('exit', res); child.kill() }),
  }
}
```

- [ ] **Step 3: Write the characterization tests**

`tests/api.test.mjs`:

```js
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
after(async () => { if (server) await server.stop() })

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text, headers: r.headers }
}

function guest(tag) {
  const id = `guest-${tag}-${Math.random().toString(36).slice(2, 8)}`
  return { authorGuestId: id, authorLabel: `Guest-${tag.toUpperCase()}`, deviceKey: `dev-${id}` }
}

async function post(g, axieId = 'kotaro', caption = 'hello') {
  return api('/api/posts', { method: 'POST', body: { ...g, axieId, caption, imageBase64: PNG_1x1 } })
}

test('GET /api/cast returns the 18-face free cast with Kotaro first', async () => {
  const r = await api('/api/cast')
  assert.equal(r.status, 200)
  assert.equal(r.json.cast.length, 18)
  assert.equal(r.json.cast[0].id, 'kotaro')
  assert.equal(r.json.cast.at(-1).id, 'agonia-echo')
})

test('first guest post as Kotaro unlocks Bing (L1) and Bing welcomes the post', async () => {
  const g = guest('first')
  const r = await post(g)
  assert.equal(r.status, 201)
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

test('one comment reaches L2 and unlocks Kotaro\'s sword', async () => {
  const g = guest('cmt')
  const p = await post(g)
  const c = await api(`/api/posts/${p.json.post.id}/comments`, { method: 'POST', body: { ...g, text: 'hi crew' } })
  assert.equal(c.status, 201)
  assert.equal(c.json.comment.text, 'hi crew')
  assert.equal(c.json.castCrew.level, 2)
  assert.ok(c.json.castCrew.unlockedProps.includes('kotaro-sword'))
})

test('like is idempotent per device and counts once', async () => {
  const g = guest('like')
  const p = await post(g)
  const other = guest('liker')
  const a = await api(`/api/posts/${p.json.post.id}/like`, { method: 'POST', body: { ...other } })
  assert.equal(a.status, 200)
  assert.equal(a.json.liked, true)
  assert.equal(a.json.post.likes, 1)
  const b = await api(`/api/posts/${p.json.post.id}/like`, { method: 'POST', body: { ...other } })
  assert.equal(b.json.post.likes, 1)
  const u = await api(`/api/posts/${p.json.post.id}/like`, { method: 'POST', body: { ...other, unlike: true } })
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
    assert.equal(r.status, 201, `post ${i}`)
  }
  const r = await post(g, 'kotaro', 'p10')
  assert.equal(r.status, 429)
})

test('follow needs an address, is stored per address, and counts followers', async () => {
  const address = '0x' + 'a'.repeat(40)
  const no = await api('/api/follow', { method: 'POST', body: { axieId: 'kotaro' } })
  assert.equal(no.status, 401)
  const f = await api('/api/follow', { method: 'POST', body: { address, axieId: 'kotaro', deviceKey: 'dev-follow' } })
  assert.equal(f.status, 200)
  assert.equal(f.json.following, true)
  assert.ok(f.json.follows.includes('kotaro'))
  const list = await api(`/api/follows?address=${address}`)
  assert.ok(list.json.follows.includes('kotaro'))
  const count = await api('/api/followers/count?axieId=kotaro')
  assert.ok(count.json.count >= 1)
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
```

- [ ] **Step 4: Add the test script and run it**

In `package.json` add `"test": "node --test tests/"`. Run:

```bash
npm run build && npm test
```

Expected: all 12 tests PASS against the unmodified server (the launcher builds nothing; `dist/` must exist, hence the build first).

- [ ] **Step 5: Commit**

```bash
git add server.mjs package.json tests/
git commit -m "test: characterization suite for the Node API"
```

---

### Task 2: Extract the runtime-agnostic core

**Files:**
- Create: `server/core.mjs` (moved handler code), `server/shim.mjs`
- Modify: `server.mjs` (becomes the Node host only)

**Interfaces:**
- Produces:
  - `server/shim.mjs`: `class ResponseShim { statusCode; headersSent; writeHead(status, headers); end(body); result() → { status, headers, body } }` where `body` is a `Buffer`, string or empty.
  - `server/core.mjs`: `export function createCore({ storage, blobs, env, log })` returning `{ handleApi(req) }`.
    - `storage.get(name, makeEmpty)` returns the live in-memory object for one of `'posts' | 'castCrew' | 'follows' | 'notifications' | 'owners' | 'burns'`, creating it with `makeEmpty()` when absent. `storage.set(name, obj)` marks it dirty. Both synchronous.
    - `blobs.put(filename, bytes: Uint8Array, mime)` async; returns nothing. Blob URL is always `/uploads/<filename>`.
    - `env.SEED_POSTS`, `env.SKYMAVIS_API_KEY` strings.
    - `req` is `{ method, url: URL, headers: Headers-like with get(), body: Buffer | null }`.
    - `handleApi(req)` resolves to `{ status, headers, body }` for any `/api/*` path, or `null` when the path is not an API path (host serves static or uploads).
- Consumes: nothing new.

- [ ] **Step 1: Create the response shim**

`server/shim.mjs`:

```js
import { Buffer } from 'node:buffer'

/** Minimal stand-in for node:http ServerResponse used by the core handlers. */
export class ResponseShim {
  constructor() {
    this.statusCode = 200
    this.headersSent = false
    this._headers = {}
    this._chunks = []
  }
  writeHead(status, headers = {}) {
    this.statusCode = status
    for (const [k, v] of Object.entries(headers)) this._headers[k.toLowerCase()] = String(v)
    this.headersSent = true
    return this
  }
  setHeader(k, v) { this._headers[k.toLowerCase()] = String(v) }
  end(body) {
    if (body != null) this._chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)))
    this.headersSent = true
  }
  result() {
    return { status: this.statusCode, headers: { ...this._headers }, body: Buffer.concat(this._chunks) }
  }
}
```

- [ ] **Step 2: Move the code into `server/core.mjs`**

Create `server/core.mjs` by copying `server.mjs` and applying these mechanical edits (do them in order; after each, `node --check server/core.mjs`):

1. Replace the node imports block (`import http ...` through `const execFileAsync = promisify(execFile)`) and the `.env` loader with:
   ```js
   import { Buffer } from 'node:buffer'
   import { ResponseShim } from './shim.mjs'
   const randomUUID = () => crypto.randomUUID()
   ```
2. Delete `__dirname`, `DIST`, `DATA_DIR`, `UPLOADS_DIR`, all six `*_FILE` constants, `PORT`, `HOST`, `MIME`, `mkdirSync(UPLOADS_DIR, ...)`, `safeJoinDist`, `safeJoinUploads`, `serveUpload`, `serveStatic`, the `if (!existsSync(DIST))` block, `http.createServer(...)`, the boot-time seed block, and `server.listen(...)`.
3. Wrap everything that remains, from `const KIT_CAST = [` to the end, inside:
   ```js
   export function createCore({ storage, blobs, env = {}, log = console }) {
     const SEED_ENABLED = env.SEED_POSTS === '1' || env.SEED_POSTS === 'true'
     const SKYMAVIS_API_KEY = String(env.SKYMAVIS_API_KEY || '').trim()
     // ... moved code ...
     return { handleApi }
   }
   ```
   and delete the two original `const SEED_ENABLED = process.env...` / `const SKYMAVIS_API_KEY = ...` lines.
4. Replace the six load/save pairs with adapter calls (same names, same call sites untouched):
   ```js
   function loadStore() { return storage.get('posts', emptyStore) }
   function saveStore(store) { storage.set('posts', store) }
   function loadCastCrew() { return storage.get('castCrew', emptyCastCrew) }
   function saveCastCrew(store) { storage.set('castCrew', store) }
   function loadFollows() { return storage.get('follows', emptyFollows) }
   function saveFollows(store) { storage.set('follows', store) }
   function loadNotifs() { return storage.get('notifications', emptyNotifs) }
   function saveNotifs(store) { storage.set('notifications', store) }
   function loadOwners() { return storage.get('owners', emptyOwners) }
   function saveOwners(store) { storage.set('owners', store) }
   function loadBurns() { return storage.get('burns', emptyBurns) }
   function saveBurns(store) { storage.set('burns', store) }
   ```
   The old implementations normalised on load (e.g. `normalizeQuestEntry`); keep that normalisation by moving it into the `makeEmpty`-independent path: `loadCastCrew` becomes `const s = storage.get('castCrew', emptyCastCrew); if (!s.byPoster) s.byPoster = {}; return s` and similarly for the others, copying whatever shape checks the old loader did after `JSON.parse`.
5. `seedCompositeImagePath`: replace the `existsSync(full)` branch with `return `/stickers/${castId}.png`` (seed composites on disk are not supported in the core; hosts may add them later).
6. `graphqlRequest`: delete the curl path entirely. Body becomes `return graphqlRequestKeyed(payload)` and, when `SKYMAVIS_API_KEY` is empty, throw `Object.assign(new Error('SKYMAVIS_API_KEY not configured'), { statusCode: 502 })`.
7. `fetchWaypointProfile`: it currently shells out to curl with temp files. Rewrite the body as a plain `fetch(WAYPOINT_PROFILE_URL, { headers: { Authorization: `Bearer ${idToken}` } })` returning the parsed JSON, preserving the existing error handling shape.
8. `readBody(req, limit)`: replace with
   ```js
   function readBody(req, limit = 8 * 1024 * 1024) {
     const buf = req.body || Buffer.alloc(0)
     if (buf.length > limit) return Promise.reject(Object.assign(new Error('Body too large'), { statusCode: 413 }))
     return Promise.resolve(buf)
   }
   ```
9. `deviceKeyFrom(req, body)`: `req.headers['x-device-key']` becomes `req.headers.get('x-device-key')`.
10. `handleCreatePost`: replace `writeFileSync(diskPath, parsed.buf)` with `await blobs.put(filename, parsed.buf, parsed.mime)`; delete `diskPath`.
11. `viewerDeviceKey(req, url)`: same header change as step 9.
12. Turn the body of the old `http.createServer(async (req, res) => { ... })` callback into:
    ```js
    async function handleApi(req) {
      const url = req.url
      const isApi = url.pathname.startsWith('/api/')
      if (!isApi) return null
      const res = new ResponseShim()
      try {
        // the original if-chain from `/api/metadata/` down to `commentMatch`, unchanged,
        // minus the OPTIONS block, `/uploads/` and `serveStatic` branches
      } catch (err) {
        log.error('[core]', err)
        if (!res.headersSent) sendJson(res, 502, { error: err instanceof Error ? err.message : 'Proxy error' })
      }
      if (!res.headersSent) sendJson(res, 404, { error: 'Not found' })
      return res.result()
    }
    ```
13. `sendJson`: keep as is (it calls `res.writeHead` / `res.end`, which the shim provides). `proxyMetadata` / `proxyImage` likewise unchanged.

- [ ] **Step 3: Rewrite `server.mjs` as the Node host**

Replace the whole file with:

```js
#!/usr/bin/env node
/** Node host: file-backed storage + static dist/ + uploads/. Same API as the Worker. */
import http from 'node:http'
import { existsSync, createReadStream, statSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { createCore } from './server/core.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// .env (git-ignored); existing process.env wins
try {
  const envPath = resolve(__dirname, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {}

const DIST = resolve(__dirname, 'dist')
const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(__dirname, 'data')
const UPLOADS_DIR = resolve(DATA_DIR, 'uploads')
const PORT = Number(process.env.PORT || 5174)
const HOST = process.env.HOST || '0.0.0.0'
const STORE_NAMES = ['posts', 'castCrew', 'follows', 'notifications', 'owners', 'burns']
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.map': 'application/json',
}

mkdirSync(UPLOADS_DIR, { recursive: true })

/** File-backed store adapter: all six JSON files live in memory; dirty ones are flushed after each request. */
function createFileStorage() {
  const cache = new Map()
  const dirty = new Set()
  const fileFor = (name) => resolve(DATA_DIR, `${name}.json`)
  return {
    get(name, makeEmpty) {
      if (!cache.has(name)) {
        let obj = null
        try {
          if (existsSync(fileFor(name))) obj = JSON.parse(readFileSync(fileFor(name), 'utf8') || 'null')
        } catch (err) {
          console.warn(`[axie-idol] ${name}.json unreadable, starting empty`, err?.message)
        }
        cache.set(name, obj && typeof obj === 'object' ? obj : makeEmpty())
      }
      return cache.get(name)
    },
    set(name, obj) { cache.set(name, obj); dirty.add(name) },
    flush() {
      for (const name of dirty) {
        const tmp = fileFor(name) + '.tmp'
        writeFileSync(tmp, JSON.stringify(cache.get(name), null, 2))
        renameSync(tmp, fileFor(name))
      }
      dirty.clear()
    },
  }
}

const storage = createFileStorage()
const blobs = {
  async put(filename, bytes) { writeFileSync(join(UPLOADS_DIR, filename), bytes) },
}
const core = createCore({ storage, blobs, env: process.env, log: console })

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((res, rej) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => { size += c.length; if (size > limit) { rej(Object.assign(new Error('Body too large'), { statusCode: 413 })); req.destroy(); return } chunks.push(c) })
    req.on('end', () => res(Buffer.concat(chunks)))
    req.on('error', rej)
  })
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const cleaned = normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const full = resolve(root, '.' + (cleaned.startsWith('/') ? cleaned : '/' + cleaned))
  return full.startsWith(root) ? full : null
}

function sendFile(res, filePath, cacheControl) {
  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(filePath).size, 'Cache-Control': cacheControl })
  createReadStream(filePath).pipe(res)
}

function serveUpload(pathname, res) {
  const name = pathname.replace(/^\/uploads\/?/, '').split('?')[0]
  const filePath = name && !/[\/\\]|\.\./.test(name) ? resolve(UPLOADS_DIR, name) : null
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not Found'); return }
  sendFile(res, filePath, 'public, max-age=86400')
}

function serveStatic(pathname, res) {
  if (pathname === '/') pathname = '/index.html'
  let filePath = safeJoin(DIST, pathname)
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (!pathname.startsWith('/assets/') && !pathname.includes('.')) filePath = join(DIST, 'index.html')
    else { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not Found'); return }
  }
  sendFile(res, filePath, pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
}

if (!existsSync(DIST)) { console.error('[server] Missing dist/'); process.exit(1) }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Device-Key' })
      res.end(); return
    }
    if (url.pathname.startsWith('/api/')) {
      let body = null
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        try { body = await readBody(req) } catch (err) { res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Body too large' })); return }
      }
      const headers = { get: (k) => { const v = req.headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : (v ?? null) } }
      const out = await core.handleApi({ method: req.method, url, headers, body })
      storage.flush()
      res.writeHead(out.status, out.headers)
      res.end(out.body)
      return
    }
    if (url.pathname.startsWith('/uploads/')) { serveUpload(url.pathname, res); return }
    serveStatic(url.pathname, res)
  } catch (err) {
    console.error('[server]', err)
    if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err?.message || 'Server error' })) }
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[axie-idol] serving ${DIST} on http://${HOST}:${PORT}`)
  console.log(`[axie-idol] data dir ${DATA_DIR} (${STORE_NAMES.join(', ')})`)
})
```

- [ ] **Step 4: Run the characterization suite**

```bash
npm run build && npm test
```

Expected: all 12 PASS. If a test fails, the diff is in the core extraction, not the test; fix the core.

- [ ] **Step 5: Boot the real server and click through Feed, Create, Board once**

```bash
node server.mjs
```

Open http://localhost:5174, confirm the feed loads, Create shows Kotaro, Board renders. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add server.mjs server/
git commit -m "refactor: runtime-agnostic core + Node host over storage/blob adapters"
```

---

### Task 3: Worker host with one Durable Object and R2

**Files:**
- Create: `worker/index.mjs`, `worker/store.mjs`, `wrangler.toml`
- Modify: `package.json` (wrangler dev dependency, scripts), `.gitignore` (`.wrangler/`)

**Interfaces:**
- Consumes: `createCore` from Task 2.
- Produces: a deployable Worker. Bindings: `STORE` (Durable Object namespace, class `IdolStore`), `UPLOADS` (R2 bucket), `ASSETS` (static assets from `dist/`). Vars: `SEED_POSTS`. Secret: `SKYMAVIS_API_KEY`.

- [ ] **Step 1: Install wrangler and add scripts**

```bash
npm i -D wrangler@4
```

`package.json` scripts, add:

```json
"dev:worker": "wrangler dev --port 8788",
"deploy": "npm run build && wrangler deploy",
"test:worker": "cross-env BASE_URL=http://127.0.0.1:8788 node --test tests/"
```

(If `cross-env` is not installed, run the worker tests with `BASE_URL=http://127.0.0.1:8788 npm test` from Git Bash instead and drop the script.)

Append `.wrangler/` to `.gitignore`.

- [ ] **Step 2: Write `wrangler.toml`**

```toml
name = "axie-idol"
main = "worker/index.mjs"
compatibility_date = "2026-09-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/uploads/*"]

[vars]
SEED_POSTS = "0"

[[durable_objects.bindings]]
name = "STORE"
class_name = "IdolStore"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["IdolStore"]

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "axie-idol-uploads"
```

- [ ] **Step 3: Write the Durable Object store adapter**

`worker/store.mjs`:

```js
import { DurableObject } from 'cloudflare:workers'
import { Buffer } from 'node:buffer'
import { createCore } from '../server/core.mjs'

const STORE_NAMES = ['posts', 'castCrew', 'follows', 'notifications', 'owners', 'burns']

/**
 * One instance ("main") holds the whole app state.
 * Small stores are one key each: `store:<name>`.
 * Posts are split: `posts:meta` = { order: [ids], axieScores, dailyScores }, `post:<id>` = post.
 * A key+value must stay under 2 MB (SQLite-backed DO limit).
 */
export class IdolStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.cache = new Map()
    this.dirty = new Set()
    this.postJson = new Map() // id -> last persisted JSON, to write only changed posts
    this.loaded = null
    this.core = createCore({
      storage: { get: (n, mk) => this.get(n, mk), set: (n, o) => this.set(n, o) },
      blobs: { put: (name, bytes, mime) => env.UPLOADS.put(name, bytes, { httpMetadata: { contentType: mime } }) },
      env: { SEED_POSTS: env.SEED_POSTS || '0', SKYMAVIS_API_KEY: env.SKYMAVIS_API_KEY || '' },
      log: console,
    })
  }

  get(name, makeEmpty) {
    if (!this.cache.has(name)) this.cache.set(name, makeEmpty())
    return this.cache.get(name)
  }
  set(name, obj) { this.cache.set(name, obj); this.dirty.add(name) }

  async load() {
    if (this.loaded) return this.loaded
    this.loaded = (async () => {
      const small = await this.ctx.storage.get(STORE_NAMES.filter((n) => n !== 'posts').map((n) => `store:${n}`))
      for (const [k, v] of small) if (v && typeof v === 'object') this.cache.set(k.slice('store:'.length), v)
      const meta = await this.ctx.storage.get('posts:meta')
      if (meta) {
        const rows = await this.ctx.storage.list({ prefix: 'post:' })
        const byId = new Map()
        for (const [k, v] of rows) { byId.set(k.slice('post:'.length), v); this.postJson.set(k.slice('post:'.length), JSON.stringify(v)) }
        const posts = meta.order.map((id) => byId.get(id)).filter(Boolean)
        this.cache.set('posts', { posts, axieScores: meta.axieScores || {}, dailyScores: meta.dailyScores || {} })
      }
    })()
    return this.loaded
  }

  async flush() {
    if (!this.dirty.size) return
    const puts = {}
    const dels = []
    for (const name of this.dirty) {
      const obj = this.cache.get(name)
      if (name !== 'posts') { puts[`store:${name}`] = obj; continue }
      const seen = new Set()
      for (const p of obj.posts) {
        seen.add(p.id)
        const json = JSON.stringify(p)
        if (this.postJson.get(p.id) !== json) { puts[`post:${p.id}`] = p; this.postJson.set(p.id, json) }
      }
      for (const id of [...this.postJson.keys()]) if (!seen.has(id)) { dels.push(`post:${id}`); this.postJson.delete(id) }
      puts['posts:meta'] = { order: obj.posts.map((p) => p.id), axieScores: obj.axieScores || {}, dailyScores: obj.dailyScores || {} }
    }
    // storage.put accepts up to 128 keys per call
    const entries = Object.entries(puts)
    for (let i = 0; i < entries.length; i += 128) await this.ctx.storage.put(Object.fromEntries(entries.slice(i, i + 128)))
    for (let i = 0; i < dels.length; i += 128) await this.ctx.storage.delete(dels.slice(i, i + 128))
    this.dirty.clear()
  }

  async fetch(request) {
    await this.load()
    const url = new URL(request.url)
    const method = request.method
    const body = method === 'GET' || method === 'HEAD' ? null : Buffer.from(await request.arrayBuffer())
    const out = await this.core.handleApi({ method, url, headers: request.headers, body })
    await this.flush()
    if (!out) return new Response('Not found', { status: 404 })
    return new Response(out.body, { status: out.status, headers: out.headers })
  }
}
```

- [ ] **Step 4: Write the Worker entry**

`worker/index.mjs`:

```js
export { IdolStore } from './store.mjs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Device-Key',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (url.pathname.startsWith('/api/')) {
      const stub = env.STORE.get(env.STORE.idFromName('main'))
      return stub.fetch(request)
    }

    if (url.pathname.startsWith('/uploads/')) {
      const name = url.pathname.slice('/uploads/'.length)
      if (!name || name.includes('/') || name.includes('..')) return new Response('Not Found', { status: 404 })
      const obj = await env.UPLOADS.get(name)
      if (!obj) return new Response('Not Found', { status: 404 })
      const headers = new Headers()
      obj.writeHttpMetadata(headers)
      headers.set('Cache-Control', 'public, max-age=86400')
      headers.set('etag', obj.httpEtag)
      return new Response(obj.body, { headers })
    }

    return env.ASSETS.fetch(request)
  },
}
```

- [ ] **Step 5: Run the suite against the local Worker**

Terminal 1:

```bash
npm run build && npx wrangler dev --port 8788
```

Terminal 2 (Git Bash):

```bash
BASE_URL=http://127.0.0.1:8788 npm test
```

Expected: all 12 PASS. Known differences to watch: R2 content type on the upload (`obj.writeHttpMetadata`), 404 JSON for unknown `/api/*` paths.

- [ ] **Step 6: Persistence check across a Durable Object restart**

With `wrangler dev` still running: create a post via the test flow (or curl), stop wrangler, start it again, `GET /api/feed` and confirm the post is still listed and its `/uploads/...` image still serves.

- [ ] **Step 7: Commit**

```bash
git add worker/ wrangler.toml package.json package-lock.json .gitignore
git commit -m "feat: Cloudflare Worker host (Durable Object state, R2 uploads, static assets)"
```

---

### Task 4: Deploy to workers.dev and document

**Files:**
- Modify: `README.md` (hosting section), `docs/AUDIT-2026-09-05.md` (hosting gap closed)

**Interfaces:**
- Consumes: a Cloudflare API token with permissions `Workers Scripts:Edit`, `Workers R2 Storage:Edit`, `Account Settings:Read`, `Workers KV Storage:Edit` (the "Edit Cloudflare Workers" template plus R2), placed in `.env` as `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID=b6acbcf4bd7eec900cec57d1102c5110`.

- [ ] **Step 1: Create the R2 bucket and set the secret**

```bash
npx wrangler r2 bucket create axie-idol-uploads
npx wrangler secret put SKYMAVIS_API_KEY
```

(paste the key when prompted; it is read from `.env` locally, never committed)

- [ ] **Step 2: Deploy**

```bash
npm run deploy
```

Expected: a URL like `https://axie-idol.<subdomain>.workers.dev`.

- [ ] **Step 3: Run the suite against production once**

```bash
BASE_URL=https://axie-idol.<subdomain>.workers.dev npm test
```

Expected: PASS. Then delete the test posts it created by clearing the Durable Object (`wrangler` has no direct command; add a guarded `POST /api/admin/reset` later if needed, or simply redeploy with a new migration tag before judging).

- [ ] **Step 4: Update docs**

README "Hosting" section: how to run locally (`node server.mjs`), how to run the Worker locally (`npm run dev:worker`), how to deploy (`npm run deploy`), where secrets live. Note that the Ronin Waypoint allowlist must include the workers.dev origin and later the custom domain.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/
git commit -m "docs: Cloudflare hosting and deploy runbook"
```
