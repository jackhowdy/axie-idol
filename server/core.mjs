/**
 * Axie Idol API core — runtime-agnostic (Node host: ../server.mjs, Worker host: ../worker/).
 * Storage adapter: storage.get(name, makeEmpty) / storage.set(name, obj). This file uses 'posts'
 * (one record per photo) and 'axies' (the gene cache); server/buddy.mjs uses 'buddies' and
 * server/diag.mjs uses 'diag'. A deployed store may still hold collections written by an earlier
 * product (castCrew, follows, notifications, owners, burns): nothing reads or writes them.
 * Blob adapter: blobs.put(filename, bytes, mime) / blobs.delete(filename); blobs are served by the
 * host at /uploads/<filename>.
 */
import { Buffer } from 'node:buffer'
import { ResponseShim } from './shim.mjs'
import { createBuddyModule } from './buddy.mjs'
import { createDiagModule } from './diag.mjs'

const randomUUID = () => crypto.randomUUID()

export function createCore({ storage, blobs, env = {}, log = console }) {
const METADATA_BASE = 'https://metadata.axieinfinity.com'
const AXIE_CDN_PNG = (id) =>
  `https://axiecdn.axieinfinity.com/axies/${id}/axie/axie-full-transparent.png`

/** Official Sky Mavis gateway; needs SKYMAVIS_API_KEY (Ronin Developer Console). */
const SKYMAVIS_GRAPHQL_URL = 'https://api-gateway.skymavis.com/graphql/axie-marketplace'
const SKYMAVIS_API_KEY = String(env.SKYMAVIS_API_KEY || '').trim()

/** Normalize Ronin/EVM address: strip ronin: prefix, lowercase. */
function normalizeAddress(raw) {
  if (typeof raw !== 'string') return ''
  let a = raw.trim()
  if (!a) return ''
  if (a.toLowerCase().startsWith('ronin:')) a = '0x' + a.slice(6)
  a = a.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(a)) return ''
  return a
}

/**
 * GraphQL via curl + temp file — Cloudflare challenges Node undici/fetch
 * (403 "Just a moment"); curl from the same host succeeds. Avoid stdin piping
 * (execFile input + curl @- can hang).
 */
async function graphqlRequest(query, variables = {}) {
  const payload = JSON.stringify({ query, variables })
  if (!SKYMAVIS_API_KEY) {
    throw Object.assign(new Error('SKYMAVIS_API_KEY not configured'), { statusCode: 502 })
  }
  return graphqlRequestKeyed(payload)
}

/** Official gateway via fetch + X-API-Key. Throws with statusCode on failure. */
async function graphqlRequestKeyed(payload) {
  let res
  try {
    res = await fetch(SKYMAVIS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': SKYMAVIS_API_KEY,
      },
      body: payload,
      signal: AbortSignal.timeout(25_000),
    })
  } catch (err) {
    throw Object.assign(new Error(err?.message || 'GraphQL fetch failed'), { statusCode: 502 })
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text || '{}')
  } catch {
    throw Object.assign(new Error('Invalid GraphQL JSON response'), { statusCode: 502 })
  }
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error(json?.message || 'Sky Mavis API key rejected'), { statusCode: 502 })
  }
  if (json?.errors?.length) {
    throw Object.assign(new Error(json.errors[0].message || 'GraphQL error'), { statusCode: 502 })
  }
  if (!json?.data) {
    throw Object.assign(new Error('Empty GraphQL data'), { statusCode: 502 })
  }
  return json.data
}

/** Genes/class/name for an Axie, cached forever in the 'axies' store (genes are immutable). */
async function fetchAxieGenes(axieId) {
  const cache = storage.get('axies', () => ({}))
  const hit = cache[axieId]
  // `level` marks a record fetched since the Axie Core facts were added; older ones are refreshed.
  if (hit && hit.genes && Array.isArray(hit.parts) && hit.level !== undefined && hit.stage !== undefined && hit.xp !== undefined) return hit
  let data
  try {
    data = await graphqlRequest(
      `query($axieId: ID!) {
        axie(axieId: $axieId) { id name class stage newGenes genes bodyShape birthDate breedCount axpInfo { level xp xpToLevelUp } parts { id name type class stage specialGenes } }
      }`,
      { axieId: String(axieId) },
    )
  } catch {
    // The Axie Core fields are a bonus: without them the Axie still loads and plays.
    data = await graphqlRequest(
      `query($axieId: ID!) {
        axie(axieId: $axieId) { id name class newGenes genes bodyShape parts { id name type stage specialGenes } }
      }`,
      { axieId: String(axieId) },
    )
  }
  const axie = data?.axie
  if (!axie || !axie.id) return null
  const rec = {
    id: String(axie.id),
    name: (axie.name && String(axie.name).trim()) || `Axie #${axie.id}`,
    class: axie.class || null,
    genes: axie.newGenes || axie.genes || '',
    bodyShape: axie.bodyShape || null,
    // Axie Core: how far it has been trained, when it was born, how often it has bred.
    level: Number.isFinite(Number(axie.axpInfo?.level)) ? Number(axie.axpInfo.level) : null,
    // how far along the current level it is, for a read-only progress bar
    xp: Number.isFinite(Number(axie.axpInfo?.xp)) ? Number(axie.axpInfo.xp) : null,
    xpToLevelUp: Number.isFinite(Number(axie.axpInfo?.xpToLevelUp)) ? Number(axie.axpInfo.xpToLevelUp) : null,
    // 4 is a grown Axie; eggs and petites have no real art to show
    stage: Number.isFinite(Number(axie.stage)) ? Number(axie.stage) : null,
    birthDate: Number(axie.birthDate) || null,
    breedCount: Number.isFinite(Number(axie.breedCount)) ? Number(axie.breedCount) : null,
    // Stage per part slot (1 or 2). The mixer's genes decoder always emits stage 1, so the client
    // needs this to pick stage-2 meshes (all Nightmare and Nightmare-shiny parts are stage 2).
    parts: Array.isArray(axie.parts)
      ? axie.parts.map((p) => ({
          type: String(p.type || '').toLowerCase(),
          stage: p.stage === 2 ? 2 : 1,
          name: p.name || null,
          class: p.class || null,
          specialGenes: p.specialGenes || null,
        }))
      : [],
    fetchedAt: Date.now(),
  }
  if (rec.genes) {
    cache[axieId] = rec
    storage.set('axies', cache)
  }
  return rec
}

async function handleAxieGenes(_req, res, id) {
  if (!ID_RE.test(id)) {
    sendJson(res, 400, { error: 'Invalid Axie ID' })
    return
  }
  try {
    const rec = await fetchAxieGenes(id)
    if (!rec) {
      sendJson(res, 404, { error: 'Axie not found' })
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    })
    res.end(JSON.stringify(rec))
  } catch (err) {
    sendJson(res, err?.statusCode || 502, { error: err instanceof Error ? err.message : 'Genes lookup failed' })
  }
}

function axieLabelFrom(name, id) {
  const n = (name && String(name).trim()) || `Axie #${id}`
  // Avoid "Axie #90 #90" when chain name already ends with #id
  if (n === `Axie #${id}` || n.endsWith(` #${id}`) || n.endsWith(`#${id}`)) {
    return n.includes('#') ? n : `${n} #${id}`
  }
  return `${n} #${id}`
}

async function fetchOwnerInventory(owner, from = 0, size = 50) {
  const data = await graphqlRequest(
    `query($owner: String!, $from: Int!, $size: Int!) {
      axies(owner: $owner, from: $from, size: $size) {
        total
        results { id name image class }
      }
    }`,
    { owner, from, size },
  )
  const block = data?.axies || { total: 0, results: [] }
  const results = Array.isArray(block.results) ? block.results : []
  const axies = results.map((r) => {
    const id = String(r.id)
    const name = (r.name && String(r.name).trim()) || `Axie #${id}`
    // GraphQL often returns assets.axieinfinity.com which 403s in <img>; use CDN.
    const image = AXIE_CDN_PNG(id)
    return {
      id,
      name,
      image,
      thumb: '/api/image/' + id,
      class: r.class || null,
      label: axieLabelFrom(name, id),
    }
  })
  return {
    address: owner,
    total: Number(block.total) || axies.length,
    axies,
  }
}

async function fetchAxieOwnership(axieId) {
  const data = await graphqlRequest(
    `query($axieId: ID!) {
      axie(axieId: $axieId) {
        id
        name
        owner
        image
        class
      }
    }`,
    { axieId: String(axieId) },
  )
  const axie = data?.axie
  if (!axie || !axie.id) return null
  return {
    id: String(axie.id),
    name: (axie.name && String(axie.name).trim()) || `Axie #${axie.id}`,
    owner: normalizeAddress(axie.owner || ''),
    image: AXIE_CDN_PNG(String(axie.id)),
    thumb: '/api/image/' + String(axie.id),
    class: axie.class || null,
  }
}

const MAX_POSTS_PER_HOUR = 10
/**
 * One-Axie loop: the legacy ceiling of 10 posts/hour is the same number as the daily bond cap,
 * so a player who takes eleven photos in an hour would be 429'd off their own camera. Buddy
 * snaps get a much higher ceiling; the ones past the daily cap simply earn no bond.
 */
const MAX_BUDDY_POSTS_PER_HOUR = 40
/** Fallback for the 'buddy' rate kind when the caller names no limit of its own. */
const MAX_BUDDY_ROUTES_PER_HOUR = 20
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

function emptyStore() {
  return { posts: [] }
}

/** Calendar date YYYY-MM-DD in Asia/Manila (UTC+8, no DST). */
function manilaDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (y && m && d) return `${y}-${m}-${d}`
  // Fallback: manual UTC+8
  const ms = date.getTime() + 8 * 60 * 60 * 1000
  const u = new Date(ms)
  const yy = u.getUTCFullYear()
  const mm = String(u.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(u.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * The 'posts' collection: `{ posts: [...] }`, newest first. Anything else a stored copy still
 * carries (score tables, and post records written by the earlier feed app) is left exactly as it
 * is: nothing here reads it, and saving the store writes it back untouched.
 */
function loadStore() {
  const data = storage.get('posts', emptyStore)
  if (!Array.isArray(data.posts)) data.posts = []
  return data
}

function saveStore(store) {
  storage.set('posts', store)
}

/** Fetch all pages for one owner (GraphQL paginates). */
async function fetchAllOwnerAxies(owner) {
  const all = []
  let from = 0
  let total = Infinity
  const pageSize = 100
  while (from < total && from < 5000) {
    const page = await fetchOwnerInventory(owner, from, pageSize)
    total = Number(page.total) || 0
    const batch = Array.isArray(page.axies) ? page.axies : []
    all.push(...batch)
    if (!batch.length) break
    from += batch.length
  }
  return all
}

/** In-memory rate buckets: deviceKey → { posts, buddy, routes: { 'buddy:<route>': [] } } (epoch ms arrays) */
const rateBuckets = new Map()

function getBucket(deviceKey) {
  let b = rateBuckets.get(deviceKey)
  if (!b) {
    b = { posts: [], buddy: [] }
    rateBuckets.set(deviceKey, b)
  }
  return b
}

function pruneHour(arr, now = Date.now()) {
  const cutoff = now - 60 * 60 * 1000
  while (arr.length && arr[0] < cutoff) arr.shift()
  return arr.length
}

function rateLimitFor(kind, opts = {}) {
  if (kind === 'posts') return opts.buddy ? MAX_BUDDY_POSTS_PER_HOUR : MAX_POSTS_PER_HOUR
  // The buddy module names its own ceiling per route (egg/retire 5, recovery 10, ronin 20) and
  // they share one bucket, so a device cannot walk around one limit by spending another.
  // Play routes (a pat, a game, meeting an Axie) each count on their own: `buddy:<route>`. Sharing
  // one bucket meant ten pats and shuffles used up the ten "pick an Axie" of the hour.
  return Number.isFinite(opts.limit) ? opts.limit : MAX_BUDDY_ROUTES_PER_HOUR
}

function rateArr(bucket, kind) {
  if (kind === 'posts') return bucket.posts
  if (kind === 'buddy') return bucket.buddy
  // `buddy:<route>`: one list per route
  bucket.routes ||= {}
  return (bucket.routes[kind] ||= [])
}

function checkRate(deviceKey, kind, opts = {}) {
  const limit = rateLimitFor(kind, opts)
  const b = getBucket(deviceKey)
  const arr = rateArr(b, kind)
  const count = pruneHour(arr)
  if (count >= limit) {
    return { ok: false, limit, count }
  }
  return { ok: true, limit, count }
}

function recordRate(deviceKey, kind) {
  const b = getBucket(deviceKey)
  rateArr(b, kind).push(Date.now())
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readBody(req, limit = 8 * 1024 * 1024) {
  const buf = req.body || Buffer.alloc(0)
  if (buf.length > limit) {
    return Promise.reject(Object.assign(new Error('Body too large'), { statusCode: 413 }))
  }
  return Promise.resolve(buf)
}

function deviceKeyFrom(req, body) {
  const header = req.headers.get('x-device-key')
  if (typeof header === 'string' && header.trim()) return header.trim().slice(0, 128)
  if (body && typeof body.deviceKey === 'string' && body.deviceKey.trim()) {
    return body.deviceKey.trim().slice(0, 128)
  }
  return ''
}

const ID_RE = /^\d+$/
/** The one non-numeric Axie id a photo can be posted under: a wild Axie or an egg posts as this. */
const NEUTRAL_AXIE_ID = 'kotaro'
const NEUTRAL_AXIE_LABEL = 'Kotaro'

async function proxyImage(id, res) {
  if (!ID_RE.test(id)) {
    sendJson(res, 400, { error: 'Invalid Axie ID' })
    return
  }
  const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AxieIdol/1.0)', Accept: 'image/png,image/*,*/*' }
  // 1) CDN first (fast path; works without metadata)
  let upstream = null
  try {
    upstream = await fetch(AXIE_CDN_PNG(id), { headers: UA, signal: AbortSignal.timeout(15_000) })
  } catch {
    upstream = null
  }
  // 2) Fallback: metadata image URL
  if (!upstream || !upstream.ok) {
    try {
      const metaRes = await fetch(`${METADATA_BASE}/axie/${id}`, { headers: { 'User-Agent': UA['User-Agent'], Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
      if (metaRes.ok) {
        const meta = await metaRes.json()
        if (meta?.image && typeof meta.image === 'string') {
          upstream = await fetch(meta.image, { headers: UA, signal: AbortSignal.timeout(15_000) })
        }
      }
    } catch {
      /* keep upstream as is */
    }
  }
  if (!upstream || !upstream.ok) {
    sendJson(res, upstream && upstream.status === 404 ? 404 : 502, {
      error: `Upstream image fetch failed (${upstream ? upstream.status : 'network'})`,
      url: AXIE_CDN_PNG(id),
    })
    return
  }
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.writeHead(200, {
    'Content-Type': upstream.headers.get('content-type') || 'image/png',
    'Cache-Control': 'public, max-age=86400',
    'Content-Length': String(buf.length),
  })
  res.end(buf)
}

function parseDataUrl(imageBase64) {
  if (typeof imageBase64 !== 'string' || !imageBase64) return null
  const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(imageBase64.trim())
  if (m) {
    const subtype = m[2].toLowerCase() === 'jpg' ? 'jpeg' : m[2].toLowerCase()
    const buf = Buffer.from(m[3], 'base64')
    return { buf, ext: subtype === 'jpeg' ? '.jpg' : `.${subtype}`, mime: `image/${subtype}` }
  }
  // Raw base64 — assume PNG
  try {
    const buf = Buffer.from(imageBase64.replace(/\s/g, ''), 'base64')
    if (buf.length < 8) return null
    // PNG magic
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { buf, ext: '.png', mime: 'image/png' }
    }
    // JPEG magic
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      return { buf, ext: '.jpg', mime: 'image/jpeg' }
    }
    return { buf, ext: '.png', mime: 'image/png' }
  } catch {
    return null
  }
}

async function handleCreatePost(req, res) {
  let body
  try {
    const raw = await readBody(req)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }

  const deviceKey = deviceKeyFrom(req, body)
  if (!deviceKey) {
    sendJson(res, 400, { error: 'Missing X-Device-Key' })
    return
  }

  // `body.buddy` alone is a client claim: the 40/hour ceiling and the snap credit both belong to a
  // caller that actually has an active buddy to credit, not to anyone who sets the flag.
  const buddyOwnerKey = buddy.ownerKeyFrom(req, body)
  const isBuddyPost = body.buddy === true && Boolean(buddy.getActive(buddyOwnerKey))

  const rate = checkRate(deviceKey, 'posts', { buddy: isBuddyPost })
  if (!rate.ok) {
    sendJson(res, 429, {
      error: `Post rate limit: max ${rate.limit}/hour`,
      limit: rate.limit,
      count: rate.count,
    })
    return
  }

  const axieId = typeof body.axieId === 'string' ? body.axieId.trim() : ''
  let axieLabel =
    typeof body.axieLabel === 'string' && body.axieLabel.trim()
      ? body.axieLabel.trim().slice(0, 96)
      : axieId === NEUTRAL_AXIE_ID ? NEUTRAL_AXIE_LABEL : axieId
  const caption =
    typeof body.caption === 'string' ? body.caption.trim().slice(0, 140) : ''
  const authorGuestId =
    typeof body.authorGuestId === 'string' ? body.authorGuestId.trim().slice(0, 64) : ''
  let authorLabel =
    typeof body.authorLabel === 'string' ? body.authorLabel.trim().slice(0, 96) : ''
  const ownerAddress = normalizeAddress(
    typeof body.ownerAddress === 'string' ? body.ownerAddress : '',
  )

  const isNeutral = axieId === NEUTRAL_AXIE_ID
  const isOwnedNumeric = ID_RE.test(axieId)

  if (!axieId || (!isNeutral && !isOwnedNumeric)) {
    sendJson(res, 400, {
      error: 'axieId must be a free-cast id or owned numeric Axie id',
    })
    return
  }

  let ownerAddressSaved = ''
  if (!isNeutral) {
    // Owned Axie post — require ownerAddress and verify on-chain ownership
    if (!ownerAddress) {
      sendJson(res, 403, { error: 'ownerAddress required for owned Axie posts' })
      return
    }
    let chain
    try {
      chain = await fetchAxieOwnership(axieId)
    } catch (err) {
      console.warn('[server] ownership check failed', err)
      sendJson(res, 502, {
        error: err instanceof Error ? err.message : 'Ownership check failed',
      })
      return
    }
    if (!chain || !chain.owner || chain.owner !== ownerAddress) {
      sendJson(res, 403, { error: 'Not the owner of this Axie' })
      return
    }
    ownerAddressSaved = ownerAddress
    // Prefer chain name #id for authorLabel / axieLabel
    const chainLabel = axieLabelFrom(chain.name, chain.id)
    axieLabel = chain.name.slice(0, 96)
    authorLabel = chainLabel.slice(0, 96)
  }

  if (!authorGuestId) {
    sendJson(res, 400, { error: 'authorGuestId required' })
    return
  }
  if (!authorLabel) {
    const short = authorGuestId.replace(/-/g, '').slice(0, 4).toUpperCase()
    authorLabel = `Guest-${short}`
  }

  const parsed = parseDataUrl(body.imageBase64)
  if (!parsed || !parsed.buf.length) {
    sendJson(res, 400, { error: 'imageBase64 required (PNG/JPEG data URL or raw base64)' })
    return
  }
  if (parsed.buf.length > MAX_IMAGE_BYTES) {
    sendJson(res, 413, { error: 'Image too large (max 6MB)' })
    return
  }

  const id = randomUUID()
  const filename = `${id}${parsed.ext}`
  await blobs.put(filename, parsed.buf, parsed.mime)
  const imagePath = `/uploads/${filename}`

  const post = {
    id,
    createdAt: Date.now(),
    axieId,
    axieLabel,
    caption,
    authorGuestId,
    authorLabel,
    ownerAddress: ownerAddressSaved || undefined,
    imagePath,
  }

  const store = loadStore()
  store.posts.unshift(post)
  // Cap store size
  if (store.posts.length > 500) store.posts.length = 500

  // Buddy: convert this snap into egg/bond progress before the post is persisted, so
  // any buddyId stamped on the post is saved with it.
  const buddyResult = await buddy.recordSnap(post, {
    buddy: isBuddyPost,
    ownerKey: buddyOwnerKey,
    lat: typeof body.lat === 'number' ? body.lat : undefined,
    lng: typeof body.lng === 'number' ? body.lng : undefined,
    hour: typeof body.hour === 'number' ? body.hour : undefined,
    weather: typeof body.weather === 'string' ? body.weather.slice(0, 16) : undefined,
    placeType: typeof body.placeType === 'string' ? body.placeType.slice(0, 16) : undefined,
    placeName: typeof body.placeName === 'string' ? body.placeName.slice(0, 40) : undefined,
    district: typeof body.district === 'string' ? body.district.slice(0, 40) : undefined,
    labels: Array.isArray(body.labels) ? body.labels.slice(0, 12).map(String) : [],
    // the upload itself, so the Axie can look at what it is reacting to
    image: typeof body.imageBase64 === 'string' ? body.imageBase64 : null,
    // the look the client already drew onto this image (see /api/buddy/look)
    lookId: typeof body.lookId === 'string' ? body.lookId.slice(0, 64) : null,
    // the phone measured the capture as very dark (see darkness() in main.ts)
    dark: body.dark === true,
    // the caption, so a post that has to ask the model itself asks with the person's words
    caption: typeof body.caption === 'string' ? body.caption.slice(0, 140) : '',
  })
  if (buddyResult) post.buddyId = buddy.getActive(buddyOwnerKey)?.id || null

  saveStore(store)
  recordRate(deviceKey, 'posts')

  sendJson(res, 201, { post: publicPost(post), buddy: buddyResult })
}

function publicPost(p) {
  const out = {
    id: p.id,
    createdAt: p.createdAt,
    axieId: p.axieId,
    axieLabel: p.axieLabel,
    caption: p.caption || '',
    authorGuestId: p.authorGuestId,
    authorLabel: p.authorLabel,
    imagePath: p.imagePath,
  }
  const ownerAddr = normalizeAddress(p.ownerAddress || '')
  if (ownerAddr) out.ownerAddress = ownerAddr
  return out
}

/**
 * Delete a post record, with its upload. Used by the buddy module when the player
 * says they do not want a photo kept. The blob only goes if the host adapter knows how to
 * delete one — a host that does not simply leaves the file, which nothing links to any more.
 */
async function removePost(postId) {
  const store = loadStore()
  const i = store.posts.findIndex((p) => p.id === postId)
  if (i < 0) return false
  const [post] = store.posts.splice(i, 1)
  saveStore(store)
  const name = String(post.imagePath || '').replace(/^\/uploads\//, '')
  if (name && !/[/\\]|\.\./.test(name) && typeof blobs?.delete === 'function') {
    try {
      await blobs.delete(name)
    } catch (err) {
      log.warn?.('[core] upload delete failed', name, err?.message)
    }
  }
  return true
}

const buddy = createBuddyModule({
  storage, env,
  helpers: { sendJson, readBody, deviceKeyFrom, manilaDayKey, fetchAxieGenes, fetchAllOwnerAxies, normalizeAddress, checkRate, recordRate, removePost },
})

/** Not gated on BUDDY: the reports are about the 3D rig, which the camera uses either way. */
const diag = createDiagModule({
  storage, env,
  helpers: { sendJson, readBody, deviceKeyFrom, checkRate, recordRate },
})

async function handleApi(req) {
  const url = req.url
  if (!url.pathname.startsWith('/api/')) return null
  const res = new ResponseShim()
  const route = async () => {
    if (await diag.handle(req, res, url)) return
    if (await buddy.handle(req, res, url)) return

    const genesMatch = /^\/api\/axie\/([^/]+)$/.exec(url.pathname)
    if (genesMatch && req.method === 'GET') {
      await handleAxieGenes(req, res, decodeURIComponent(genesMatch[1]))
      return
    }
    if (url.pathname.startsWith('/api/image/')) {
      let id = url.pathname.slice('/api/image/'.length)
      if (id.endsWith('/')) id = id.slice(0, -1)
      await proxyImage(id, res)
      return
    }

    if (url.pathname === '/api/posts' && req.method === 'POST') {
      await handleCreatePost(req, res)
      return
    }
  }
  try {
    await route()
  } catch (err) {
    log.error('[core]', err)
    if (!res.headersSent) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : 'Proxy error' })
    }
  }
  if (!res.headersSent) sendJson(res, 404, { error: 'Not found' })
  return res.result()
}

  return { handleApi }
}
