import { defineConfig, type Plugin } from 'vite'

const METADATA_BASE = 'https://metadata.axieinfinity.com'
const AXIE_CDN_PNG = (id: string) =>
  'https://axiecdn.axieinfinity.com/axies/' + id + '/axie/axie-full-transparent.png'

function axieApiPlugin(): Plugin {
  const attach = (middlewares: { use: (fn: unknown) => void }) => {
    middlewares.use(async (req: { url?: string }, res: any, next: () => void) => {
      try {
        const url = req.url ? new URL(req.url, 'http://localhost') : null
        if (!url) return next()

        if (url.pathname.startsWith('/api/metadata/')) {
          let id = url.pathname.slice('/api/metadata/'.length)
          if (id.endsWith('/')) id = id.slice(0, -1)
          if (!/^\d+$/.test(id)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid Axie ID' }))
            return
          }
          const upstream = await fetch(METADATA_BASE + '/axie/' + id)
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'public, max-age=60')
          res.end(text)
          return
        }

        if (url.pathname.startsWith('/api/image/')) {
          let id = url.pathname.slice('/api/image/'.length)
          if (id.endsWith('/')) id = id.slice(0, -1)
          if (!/^\d+$/.test(id)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid Axie ID' }))
            return
          }
          let imageUrl = AXIE_CDN_PNG(id)
          try {
            const metaRes = await fetch(METADATA_BASE + '/axie/' + id)
            if (metaRes.ok) {
              const meta = (await metaRes.json()) as { image?: string }
              if (meta?.image && typeof meta.image === 'string') imageUrl = meta.image
            }
          } catch {
            // fall back
          }
          const upstream = await fetch(imageUrl, {
            headers: { Accept: 'image/png,image/*,*/*' },
          })
          if (!upstream.ok) {
            res.statusCode = upstream.status === 404 ? 404 : 502
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Upstream image fetch failed (' + upstream.status + ')',
                url: imageUrl,
              }),
            )
            return
          }
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.statusCode = 200
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/png')
          res.setHeader('Cache-Control', 'public, max-age=300')
          res.setHeader('Content-Length', String(buf.length))
          res.end(buf)
          return
        }

        next()
      } catch (err) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Proxy error',
          }),
        )
      }
    })
  }

  return {
    name: 'axie-api-proxy',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [axieApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
  },
  resolve: {
    dedupe: ['pixi.js', '@pixi/core', '@pixi/assets', '@pixi/utils'],
  },
  optimizeDeps: {
    include: ['pixi.js', 'pixi-spine', '@axieinfinity/mixer'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
})
