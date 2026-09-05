/**
 * Cloudflare Worker host for Axie Idol.
 *  /api/*      -> single Durable Object ("main") running server/core.mjs
 *  /uploads/*  -> R2 bucket (post images)
 *  everything else -> static assets from dist/ (SPA fallback)
 */
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
      if (!name || name.includes('/') || name.includes('..')) {
        return new Response('Not Found', { status: 404 })
      }
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
