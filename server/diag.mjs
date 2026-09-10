/**
 * Field reports from phones we cannot reproduce. The 3D rig (5 MB manifest, part textures, WebGL)
 * is the one part of the app that can fail silently on a device the developer does not own — on an
 * iPhone the egg showed and the hatched Axie did not, with nothing in any log here to say why.
 *
 * A report is a shout from an untrusted client: every field is clamped, only the last hundred are
 * kept, and nothing is ever read back except by an operator holding ADMIN_KEY. Without that key the
 * read route does not answer at all (the handler declines and core's ordinary 404 replies), exactly
 * like /api/admin/seed-bond.
 */
const MAX_REPORTS = 100
const MAX_KIND = 40
const MAX_MESSAGE = 400
const MAX_UA = 300
/** `extra` is free-form client JSON: shallow, small, and never trusted to be either. */
const MAX_EXTRA_KEYS = 12
const MAX_EXTRA_VALUE = 120

/** One level deep, primitives only: an object of unknown depth must not be stored or echoed back. */
function cleanExtra(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}
  for (const [k, v] of Object.entries(raw).slice(0, MAX_EXTRA_KEYS)) {
    if (v === null || typeof v === 'boolean' || typeof v === 'number') out[String(k).slice(0, 40)] = v
    else if (typeof v === 'string') out[String(k).slice(0, 40)] = v.slice(0, MAX_EXTRA_VALUE)
  }
  return Object.keys(out).length ? out : null
}

export function createDiagModule({ storage, helpers, env = {}, now = () => Date.now() }) {
  const { sendJson, readBody, deviceKeyFrom, checkRate, recordRate } = helpers

  const emptyStore = () => ({ reports: [] })
  const load = () => {
    const s = storage.get('diag', emptyStore)
    if (!Array.isArray(s.reports)) s.reports = []
    return s
  }
  const save = (s) => storage.set('diag', s)

  async function handle(req, res, url) {
    if (url.pathname !== '/api/diag') return false

    if (req.method === 'POST') {
      let body
      try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { sendJson(res, 400, { error: 'Invalid JSON' }); return true }
      const kind = String(body.kind || '').trim().slice(0, MAX_KIND)
      if (!kind) { sendJson(res, 400, { error: 'kind required' }); return true }
      // Shares the buddy bucket on purpose: a device cannot spend its way around one ceiling by
      // filing reports instead. The client sends at most one report per kind per page load.
      const rateKey = deviceKeyFrom(req, body) || 'anon'
      if (typeof checkRate === 'function' && typeof recordRate === 'function') {
        const r = checkRate(rateKey, 'buddy')
        if (!r.ok) { sendJson(res, 429, { error: `Rate limit: max ${r.limit}/hour`, limit: r.limit }); return true }
        recordRate(rateKey, 'buddy')
      }
      const store = load()
      store.reports.push({
        at: new Date(now()).toISOString(),
        kind,
        message: String(body.message || '').slice(0, MAX_MESSAGE),
        ua: String(body.ua || '').slice(0, MAX_UA),
        extra: cleanExtra(body.extra),
        device: rateKey.slice(0, 64),
      })
      if (store.reports.length > MAX_REPORTS) store.reports = store.reports.slice(-MAX_REPORTS)
      save(store)
      sendJson(res, 202, { ok: true })
      return true
    }

    if (req.method === 'GET') {
      const adminKey = typeof env.ADMIN_KEY === 'string' ? env.ADMIN_KEY : ''
      // No key configured, or the wrong one: decline, and the route reads as one that is not there.
      if (!adminKey || req.headers?.get?.('x-admin-key') !== adminKey) return false
      const store = load()
      sendJson(res, 200, { reports: [...store.reports].reverse() })
      return true
    }
    return false
  }

  return { handle }
}
