#!/usr/bin/env node
/**
 * Seed the monthly Idol ladder so it has a podium instead of a single row.
 *
 * Creates eight device accounts, hatches each one, and takes between 12 and 40 tiny snaps per
 * account at scattered coordinates so the places (and therefore the moments) differ. Everything
 * goes over the public HTTP API — no server internals, no client imports.
 *
 *   node scripts/seed-ladder.mjs --base http://127.0.0.1:5199 --yes
 *   node scripts/seed-ladder.mjs --base http://127.0.0.1:5199 --admin-key demo --yes
 *
 * The daily bond cap is ten, so snapping alone leaves every seeded account tied at ten bond and
 * the ladder has no podium. `--admin-key` calls the operator-only `POST /api/admin/seed-bond`
 * hook afterwards to write a stepped bond per account; that route only exists when the server was
 * started with a matching `ADMIN_KEY`, and it is refused (as a plain 404) otherwise.
 *
 * The eight device ids are remembered in `scripts/.seed-devices.json` per base URL, so re-running
 * tops up the same eight Axies instead of adding eight more.
 *
 * It refuses to do anything without `--yes`, and it is a writing script: point it at a local or
 * staging server, never at anything you are not willing to fill with fake Axies.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The class name pools from the client's own suggestName(), copied so this script imports no client code. */
const NAMES = [
  'Miso', 'Tofu', 'Biscuit', 'Rumble',
  'Bubbles', 'Pip', 'Kelp', 'Mochi',
  'Sprout', 'Fern', 'Pudding', 'Moss',
  'Chirp', 'Nimbus', 'Kite', 'Waffle',
  'Dot', 'Zip', 'Clover', 'Pebble',
  'Sol', 'Ember', 'Ziggy', 'Onyx',
]

/** A 1x1 transparent PNG — the smallest thing the upload path accepts. */
const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const ACCOUNTS = 8
const MIN_SNAPS = 12
/** The server's buddy post ceiling is 40/hour per device; never plan a device past it. */
const MAX_SNAPS = 40
/** The hatch needs five egg photos first. */
const HATCH_AT = 5
/**
 * Monthly bond per podium place, written through the admin hook. Deliberately uneven and with a
 * clear top three, so the ladder reads like a month of real play rather than a generated list.
 */
const PODIUM = [214, 188, 171, 166, 152, 120, 62, 40]

const DEVICES_FILE = join(dirname(fileURLToPath(import.meta.url)), '.seed-devices.json')

function parseArgs(argv) {
  const args = { base: 'http://127.0.0.1:5199', yes: false, adminKey: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') args.base = argv[++i] || args.base
    else if (argv[i] === '--admin-key') args.adminKey = argv[++i] || ''
    else if (argv[i] === '--yes') args.yes = true
  }
  return args
}

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))

/** Scatter the snaps around Hong Kong so each one lands in its own grid cell. */
function coordFor(i) {
  return { lat: 22.24 + i * 0.011, lng: 114.13 + ((i * 7) % 13) * 0.009 }
}

/** Remembered device ids, keyed by base URL so two servers never share accounts. */
function loadDevices(base) {
  try {
    const all = JSON.parse(readFileSync(DEVICES_FILE, 'utf8'))
    const list = all?.[base]
    if (Array.isArray(list) && list.length === ACCOUNTS && list.every((d) => typeof d === 'string' && d)) return list
  } catch {
    /* no file yet, or unreadable — start fresh */
  }
  return null
}

function saveDevices(base, devices) {
  let all = {}
  try {
    all = JSON.parse(readFileSync(DEVICES_FILE, 'utf8')) || {}
  } catch {
    /* first run */
  }
  all[base] = devices
  writeFileSync(DEVICES_FILE, `${JSON.stringify(all, null, 2)}\n`)
}

async function api(base, path, { method = 'GET', body, device, adminKey } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (device) headers['X-Device-Key'] = device
  if (adminKey) headers['X-Admin-Key'] = adminKey
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, json, text }
}

/** Bring one device up to a hatched Axie with `total` snaps behind it, reusing whatever is there. */
async function seedOne(base, index, device) {
  const name = NAMES[index % NAMES.length]
  const total = rand(MIN_SNAPS, MAX_SNAPS)

  const before = await api(base, '/api/buddy', { device })
  let b = before.json?.active || null
  let reused = Boolean(b?.hatchedAt)

  if (!b) {
    const egg = await api(base, '/api/buddy/egg', { method: 'POST', device })
    if (egg.status !== 201) throw new Error(`egg failed (${egg.status}): ${egg.text.slice(0, 200)}`)
    b = egg.json.active
  }

  // A reused account already has its snaps; only a fresh or half-finished one needs more taken.
  const taken = reused ? total : b.egg?.snaps || 0
  let added = 0
  let hatched = Boolean(b.hatchedAt)
  for (let i = taken; i < total; i++) {
    const { lat, lng } = coordFor(i + index * 3)
    const post = await api(base, '/api/posts', {
      method: 'POST',
      device,
      body: {
        axieId: 'kotaro',
        axieLabel: hatched ? name : 'Egg',
        imageBase64: PNG_1x1,
        authorGuestId: device,
        buddy: true,
        lat,
        lng,
        hour: rand(8, 22),
      },
    })
    if (post.status !== 201) throw new Error(`snap ${i + 1} failed (${post.status}): ${post.text.slice(0, 200)}`)
    added++
    if (!hatched && i + 1 >= HATCH_AT) {
      const h = await api(base, '/api/buddy/hatch', { method: 'POST', device, body: { name } })
      if (h.status !== 200) throw new Error(`hatch failed (${h.status}): ${h.text.slice(0, 200)}`)
      hatched = true
    }
  }

  const me = await api(base, '/api/buddy', { device })
  const active = me.json?.active || null
  return { device, buddyId: active?.id || null, name: active?.name || name, snaps: active?.snapCount ?? added, added, reused, cls: active?.class || '?' }
}

/** Write a stepped bond onto one seeded Axie through the operator-only hook. */
async function setBond(base, adminKey, buddyId, bond) {
  const r = await api(base, '/api/admin/seed-bond', { method: 'POST', adminKey, body: { buddyId, bond, monthlyBond: bond } })
  if (r.status === 404) {
    throw new Error('seed-bond returned 404 — the server has no ADMIN_KEY set, or --admin-key does not match it')
  }
  if (r.status !== 200) throw new Error(`seed-bond failed (${r.status}): ${r.text.slice(0, 200)}`)
  return r.json
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.yes) {
    console.error('seed-ladder: refusing to run without --yes')
    console.error(`  it would create or top up ${ACCOUNTS} device accounts and up to ${MAX_SNAPS} posts each on ${args.base}`)
    console.error('  usage: node scripts/seed-ladder.mjs --base <url> [--admin-key <key>] --yes')
    process.exitCode = 2
    return
  }
  const base = args.base.replace(/\/+$/, '')
  const remembered = loadDevices(base)
  const devices = remembered
    || Array.from({ length: ACCOUNTS }, (_, i) => `seed-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}`)

  console.log(`seed-ladder: ${ACCOUNTS} accounts against ${base}${remembered ? ' (reusing remembered devices)' : ''}`)
  if (!args.adminKey) {
    console.warn('  warning: no --admin-key, so bond comes from snaps alone. The daily cap is ten,')
    console.warn('           so every seeded Axie will tie at ten bond and the ladder will have no podium.')
  }

  const seeded = []
  for (let i = 0; i < ACCOUNTS; i++) {
    const r = await seedOne(base, i, devices[i])
    seeded.push(r)
    console.log(`  ${String(i + 1).padStart(2)}. ${r.name.padEnd(8)} ${r.cls.padEnd(8)} ${String(r.snaps).padStart(2)} snaps (+${r.added} this run)${r.reused ? ' · reused' : ''}`)
  }
  saveDevices(base, devices)

  if (args.adminKey) {
    console.log('\nwriting the podium through /api/admin/seed-bond')
    for (let i = 0; i < seeded.length; i++) {
      const r = seeded[i]
      if (!r.buddyId) throw new Error(`no buddy id for account ${i + 1}`)
      const out = await setBond(base, args.adminKey, r.buddyId, PODIUM[i] ?? PODIUM.at(-1))
      console.log(`  ${r.name.padEnd(8)} bond ${String(out.bond).padStart(3)} · level ${out.level}`)
    }
  }

  const ladder = await api(base, '/api/ladder/monthly', { device: `seed-reader-${Math.random().toString(36).slice(2, 8)}` })
  if (ladder.status !== 200) {
    console.error(`ladder read failed (${ladder.status}): ${ladder.text.slice(0, 200)}`)
    process.exitCode = 1
    return
  }
  const rows = ladder.json?.rows || []
  console.log(`\n/api/ladder/monthly — ${ladder.json?.month || '?'} · ${rows.length} axies`)
  for (const row of rows.slice(0, 10)) {
    console.log(`  #${String(row.rank).padStart(2)} ${String(row.name).padEnd(10)} ${String(row.class || '?').padEnd(8)} bond ${String(row.monthlyBond).padStart(3)} · level ${row.level} · ${row.kind}`)
  }
  if (!rows.length) console.log('  (empty — nothing earned bond this month)')
}

main().catch((err) => {
  console.error('seed-ladder failed:', err?.message || err)
  process.exitCode = 1
})
