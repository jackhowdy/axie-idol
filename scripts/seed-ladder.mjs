#!/usr/bin/env node
/**
 * Seed the monthly Idol ladder so it has a podium instead of a single row.
 *
 * Creates eight device accounts, hatches each one, and takes between 12 and 40 tiny snaps per
 * account at scattered coordinates so the places (and therefore the moments) differ. Everything
 * goes over the public HTTP API — no server internals, no client imports.
 *
 *   node scripts/seed-ladder.mjs --base http://127.0.0.1:5199 --yes
 *
 * It refuses to do anything without `--yes`, and it is a writing script: point it at a local or
 * staging server, never at anything you are not willing to fill with fake Axies.
 */

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

function parseArgs(argv) {
  const args = { base: 'http://127.0.0.1:5199', yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') args.base = argv[++i] || args.base
    else if (argv[i] === '--yes') args.yes = true
  }
  return args
}

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Scatter the snaps around Hong Kong so each one lands in its own grid cell. */
function coordFor(i) {
  return { lat: 22.24 + i * 0.011, lng: 114.13 + ((i * 7) % 13) * 0.009 }
}

async function api(base, path, { method = 'GET', body, device } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (device) headers['X-Device-Key'] = device
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

async function seedOne(base, index) {
  const device = `seed-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`
  const name = NAMES[index % NAMES.length]
  const total = rand(MIN_SNAPS, MAX_SNAPS)
  if (total > MAX_SNAPS) throw new Error(`planned ${total} snaps, over the ${MAX_SNAPS}/hour ceiling`)

  const egg = await api(base, '/api/buddy/egg', { method: 'POST', device })
  if (egg.status !== 201) throw new Error(`egg failed (${egg.status}): ${egg.text.slice(0, 200)}`)

  let hatched = false
  for (let i = 0; i < total; i++) {
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
    if (!hatched && i + 1 >= HATCH_AT) {
      const h = await api(base, '/api/buddy/hatch', { method: 'POST', device, body: { name } })
      if (h.status !== 200) throw new Error(`hatch failed (${h.status}): ${h.text.slice(0, 200)}`)
      hatched = true
    }
  }
  const me = await api(base, '/api/buddy', { device })
  const b = me.json?.active || null
  return { device, name, snaps: total, bond: b?.bond ?? 0, level: b?.level ?? 0, cls: b?.class || '?' }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.yes) {
    console.error('seed-ladder: refusing to run without --yes')
    console.error(`  it would create ${ACCOUNTS} device accounts and up to ${MAX_SNAPS} posts each on ${args.base}`)
    console.error('  usage: node scripts/seed-ladder.mjs --base <url> --yes')
    process.exitCode = 2
    return
  }
  const base = args.base.replace(/\/+$/, '')
  console.log(`seed-ladder: ${ACCOUNTS} accounts against ${base}`)

  for (let i = 0; i < ACCOUNTS; i++) {
    const r = await seedOne(base, i)
    console.log(`  ${String(i + 1).padStart(2)}. ${r.name.padEnd(8)} ${r.cls.padEnd(8)} ${String(r.snaps).padStart(2)} snaps · bond ${r.bond} · level ${r.level}`)
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
