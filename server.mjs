#!/usr/bin/env node
/**
 * Node host for Axie Idol: file-backed storage + static dist/ + data/uploads/.
 * Same API as the Cloudflare Worker host (worker/). All handler logic lives in server/core.mjs.
 */
import http from 'node:http'
import {
  existsSync,
  createReadStream,
  statSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs'
import { resolve, join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { createCore } from './server/core.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** Load .env next to server.mjs (git-ignored). Existing process.env wins. */
try {
  const envPath = resolve(__dirname, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {
  /* ignore */
}

const DIST = resolve(__dirname, 'dist')
const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(__dirname, 'data')
const UPLOADS_DIR = resolve(DATA_DIR, 'uploads')
const PORT = Number(process.env.PORT || 5174)
const HOST = process.env.HOST || '0.0.0.0'
const STORE_NAMES = ['posts', 'castCrew', 'follows', 'notifications', 'owners', 'burns', 'axies', 'buddies']
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

mkdirSync(UPLOADS_DIR, { recursive: true })

/** File-backed store adapter: six JSON files held in memory; dirty ones flushed after each request. */
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
    set(name, obj) {
      cache.set(name, obj)
      dirty.add(name)
    },
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
  async put(filename, bytes) {
    writeFileSync(join(UPLOADS_DIR, filename), bytes)
  },
}
const core = createCore({ storage, blobs, env: process.env, log: console })

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((res, rej) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        rej(Object.assign(new Error('Body too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
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
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': statSync(filePath).size,
    'Cache-Control': cacheControl,
  })
  createReadStream(filePath).pipe(res)
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
}

function serveUpload(pathname, res) {
  const name = pathname.replace(/^\/uploads\/?/, '').split('?')[0]
  const filePath = name && !/[/\\]|\.\./.test(name) ? resolve(UPLOADS_DIR, name) : null
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) return notFound(res)
  sendFile(res, filePath, 'public, max-age=86400')
}

function serveStatic(pathname, res) {
  if (pathname === '/') pathname = '/index.html'
  let filePath = safeJoin(DIST, pathname)
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (!pathname.startsWith('/assets/') && !pathname.includes('.')) filePath = join(DIST, 'index.html')
    else return notFound(res)
  }
  sendFile(
    res,
    filePath,
    pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  )
}

if (!existsSync(DIST)) {
  console.error('[server] Missing dist/ — run the build first')
  process.exit(1)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Device-Key, X-Buddy-Session, X-Admin-Key',
      })
      res.end()
      return
    }

    if (url.pathname.startsWith('/api/')) {
      let body = null
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          body = await readBody(req)
        } catch (err) {
          res.writeHead(err?.statusCode || 400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Body too large' }))
          return
        }
      }
      const headers = {
        get: (k) => {
          const v = req.headers[k.toLowerCase()]
          return Array.isArray(v) ? v[0] : v ?? null
        },
      }
      const out = await core.handleApi({ method: req.method, url, headers, body })
      storage.flush()
      res.writeHead(out.status, out.headers)
      res.end(out.body)
      return
    }

    if (url.pathname.startsWith('/uploads/')) {
      serveUpload(url.pathname, res)
      return
    }
    serveStatic(url.pathname, res)
  } catch (err) {
    console.error('[server]', err)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err?.message || 'Server error' }))
    }
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[axie-idol] serving ${DIST} on http://${HOST}:${PORT}`)
  console.log(`[axie-idol] data dir ${DATA_DIR} (${STORE_NAMES.join(', ')})`)
})
