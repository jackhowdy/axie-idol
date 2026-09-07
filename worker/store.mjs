import { DurableObject } from 'cloudflare:workers'
import { Buffer } from 'node:buffer'
import { createCore } from '../server/core.mjs'

const STORE_NAMES = ['posts', 'castCrew', 'follows', 'notifications', 'owners', 'burns']
const SMALL_STORES = STORE_NAMES.filter((n) => n !== 'posts')
const PUT_BATCH = 128

/**
 * One instance ("main") holds the whole app state and runs the core handlers.
 * Small stores are one key each: `store:<name>`.
 * Posts are split so no key+value exceeds the 2 MB SQLite-backed limit:
 *   `posts:meta` = { order: [ids], axieScores, dailyScores }
 *   `post:<id>`  = the post object
 */
export class IdolStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.cache = new Map()
    this.dirty = new Set()
    /** id -> last persisted JSON, so flush writes only changed posts */
    this.postJson = new Map()
    this.loaded = null
    this.core = createCore({
      storage: {
        get: (name, makeEmpty) => this.get(name, makeEmpty),
        set: (name, obj) => this.set(name, obj),
      },
      blobs: {
        put: (name, bytes, mime) => this.putBlob(name, bytes, mime || 'image/png'),
      },
      env: {
        SEED_POSTS: env.SEED_POSTS || '0',
        SKYMAVIS_API_KEY: env.SKYMAVIS_API_KEY || '',
        GOLDEN_ODDS: env.GOLDEN_ODDS || '',
      },
      log: console,
    })
  }

  get(name, makeEmpty) {
    if (!this.cache.has(name)) this.cache.set(name, makeEmpty())
    return this.cache.get(name)
  }

  set(name, obj) {
    this.cache.set(name, obj)
    this.dirty.add(name)
  }

  /** Photos go to R2 when the bucket is bound; otherwise chunked into DO storage (<1 MB per key). */
  async putBlob(name, bytes, mime) {
    if (this.env.UPLOADS) {
      await this.env.UPLOADS.put(name, bytes, { httpMetadata: { contentType: mime } })
      return
    }
    const CHUNK = 1024 * 1024
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const parts = Math.ceil(u8.length / CHUNK)
    const puts = { [`blob:${name}:meta`]: { mime, parts, size: u8.length } }
    for (let i = 0; i < parts; i++) puts[`blob:${name}:${i}`] = u8.slice(i * CHUNK, (i + 1) * CHUNK)
    await this.ctx.storage.put(puts)
  }

  async getBlob(name) {
    const meta = await this.ctx.storage.get(`blob:${name}:meta`)
    if (!meta) return null
    const keys = Array.from({ length: meta.parts }, (_, i) => `blob:${name}:${i}`)
    const rows = await this.ctx.storage.get(keys)
    const out = new Uint8Array(meta.size)
    let off = 0
    for (const k of keys) {
      const part = rows.get(k)
      if (!part) return null
      out.set(part, off)
      off += part.length
    }
    return { bytes: out, mime: meta.mime }
  }

  async load() {
    if (this.loaded) return this.loaded
    this.loaded = (async () => {
      const small = await this.ctx.storage.get(SMALL_STORES.map((n) => `store:${n}`))
      for (const [k, v] of small) {
        if (v && typeof v === 'object') this.cache.set(k.slice('store:'.length), v)
      }
      const meta = await this.ctx.storage.get('posts:meta')
      if (meta) {
        const rows = await this.ctx.storage.list({ prefix: 'post:' })
        const byId = new Map()
        for (const [k, v] of rows) {
          const id = k.slice('post:'.length)
          byId.set(id, v)
          this.postJson.set(id, JSON.stringify(v))
        }
        const order = Array.isArray(meta.order) ? meta.order : []
        const posts = order.map((id) => byId.get(id)).filter(Boolean)
        this.cache.set('posts', {
          posts,
          axieScores: meta.axieScores || {},
          dailyScores: meta.dailyScores || {},
        })
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
      if (name !== 'posts') {
        puts[`store:${name}`] = obj
        continue
      }
      const seen = new Set()
      for (const p of obj.posts) {
        seen.add(p.id)
        const json = JSON.stringify(p)
        if (this.postJson.get(p.id) !== json) {
          puts[`post:${p.id}`] = p
          this.postJson.set(p.id, json)
        }
      }
      for (const id of [...this.postJson.keys()]) {
        if (!seen.has(id)) {
          dels.push(`post:${id}`)
          this.postJson.delete(id)
        }
      }
      puts['posts:meta'] = {
        order: obj.posts.map((p) => p.id),
        axieScores: obj.axieScores || {},
        dailyScores: obj.dailyScores || {},
      }
    }
    const entries = Object.entries(puts)
    for (let i = 0; i < entries.length; i += PUT_BATCH) {
      await this.ctx.storage.put(Object.fromEntries(entries.slice(i, i + PUT_BATCH)))
    }
    for (let i = 0; i < dels.length; i += PUT_BATCH) {
      await this.ctx.storage.delete(dels.slice(i, i + PUT_BATCH))
    }
    this.dirty.clear()
  }

  async fetch(request) {
    await this.load()
    const url = new URL(request.url)
    if (url.pathname.startsWith('/uploads/')) {
      const name = url.pathname.slice('/uploads/'.length)
      if (!name || name.includes('/') || name.includes('..')) return new Response('Not Found', { status: 404 })
      const blob = await this.getBlob(name)
      if (!blob) return new Response('Not Found', { status: 404 })
      return new Response(blob.bytes, {
        headers: { 'Content-Type': blob.mime, 'Cache-Control': 'public, max-age=86400' },
      })
    }
    const method = request.method
    const body =
      method === 'GET' || method === 'HEAD' ? null : Buffer.from(await request.arrayBuffer())
    const out = await this.core.handleApi({ method, url, headers: request.headers, body })
    await this.flush()
    if (!out) return new Response('Not found', { status: 404 })
    return new Response(out.body, { status: out.status, headers: out.headers })
  }
}
