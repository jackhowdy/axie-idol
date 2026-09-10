import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startNodeServer } from './helpers/start-node-server.mjs'

/**
 * Field reports from phones the developer does not own. One server with an ADMIN_KEY covers all
 * three things that matter: a report is stored, an ordinary caller cannot read the reports back,
 * and an operator holding the key can.
 */
const ADMIN_KEY = 'diag-test-key'
let base = ''
let server = null
before(async () => {
  server = await startNodeServer({ BUDDY: '1', BUDDY_TEST_SKIP_CHAIN: '1', ADMIN_KEY })
  base = server.baseUrl
})
after(async () => { if (server) await server.stop() })

async function call(path, { method = 'GET', body, adminKey, device = 'diag-dev' } = {}) {
  const headers = { 'content-type': 'application/json', 'X-Device-Key': device }
  if (adminKey) headers['X-Admin-Key'] = adminKey
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not JSON */ }
  return { status: r.status, json, text }
}

test('a 3D failure report is stored and read back only with the admin key', async () => {
  const posted = await call('/api/diag', {
    method: 'POST',
    body: {
      kind: '3d-load-failed',
      message: 'mixer load returned false',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      extra: { webgl2: false, mem: 4, spec: 'wild' },
    },
  })
  assert.equal(posted.status, 202, posted.text)

  const anonymous = await call('/api/diag')
  assert.equal(anonymous.status, 404, 'without the key the route reads as one that is not there')
  const wrongKey = await call('/api/diag', { adminKey: 'not-the-key' })
  assert.equal(wrongKey.status, 404)

  const read = await call('/api/diag', { adminKey: ADMIN_KEY })
  assert.equal(read.status, 200, read.text)
  const report = read.json.reports[0]
  assert.equal(report.kind, '3d-load-failed')
  assert.equal(report.message, 'mixer load returned false')
  assert.match(report.ua, /iPhone/)
  assert.deepEqual(report.extra, { webgl2: false, mem: 4, spec: 'wild' })
  assert.ok(typeof report.at === 'string' && report.at.length > 0)
})

test('a report without a kind is refused, and nested extra is flattened away', async () => {
  const bad = await call('/api/diag', { method: 'POST', body: { message: 'no kind here' } })
  assert.equal(bad.status, 400)

  const nested = await call('/api/diag', {
    method: 'POST',
    device: 'diag-dev-2',
    body: { kind: '3d-slow', message: 'x'.repeat(900), extra: { ok: true, deep: { nope: 1 } } },
  })
  assert.equal(nested.status, 202, nested.text)
  const read = await call('/api/diag', { adminKey: ADMIN_KEY })
  const report = read.json.reports.find((r) => r.kind === '3d-slow')
  assert.ok(report, 'newest reports come back first')
  assert.equal(report.message.length, 400, 'a long message is clamped, not stored whole')
  assert.deepEqual(report.extra, { ok: true }, 'only shallow primitives survive')
})
