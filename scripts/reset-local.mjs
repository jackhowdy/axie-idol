#!/usr/bin/env node
/**
 * Wipe the local Node host's state so the next run starts on a fresh egg.
 *
 * Removes `data/posts.json`, `data/buddies.json`, `data/castCrew.json` and everything inside
 * `data/uploads/`. Nothing else in `data/` is touched (the Axie gene cache, owner names, follows,
 * burns and notifications survive). Stop `node server.mjs` first — it keeps the stores in memory
 * and would write them back on the next request.
 *
 *   node scripts/reset-local.mjs            # dry run: lists what it would remove
 *   node scripts/reset-local.mjs --yes      # actually removes it
 *
 * This only touches the local Node host. The deployed Worker keeps its state in the `IdolStore`
 * Durable Object — see "Resetting the live store" in README.md.
 */
import { readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(ROOT, 'data')
const FILES = ['posts.json', 'buddies.json', 'castCrew.json']
const UPLOADS = join(DATA_DIR, 'uploads')
/** How paths are named in the output: "data" for the default, the real path when DATA_DIR is set. */
const DIR_LABEL = relative(ROOT, DATA_DIR).split('\\').join('/') || DATA_DIR

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

/** Every path this run would remove, as { path, label, bytes }. Missing paths are simply absent. */
function plan() {
  const items = []
  for (const name of FILES) {
    const path = join(DATA_DIR, name)
    try {
      items.push({ path, label: `${DIR_LABEL}/${name}`, bytes: statSync(path).size })
    } catch {
      /* already gone */
    }
  }
  let uploads = []
  try {
    uploads = readdirSync(UPLOADS)
  } catch {
    /* no uploads dir */
  }
  for (const name of uploads) {
    const path = join(UPLOADS, name)
    try {
      const s = statSync(path)
      if (s.isFile()) items.push({ path, label: `${DIR_LABEL}/uploads/${name}`, bytes: s.size })
    } catch {
      /* raced away */
    }
  }
  return items
}

const yes = process.argv.slice(2).includes('--yes')
const items = plan()
const total = items.reduce((n, i) => n + i.bytes, 0)

if (!items.length) {
  console.log(`reset-local: nothing to remove in ${DATA_DIR}`)
  process.exit(0)
}

if (!yes) {
  console.log(`reset-local: DRY RUN — would remove ${items.length} item(s), ${kb(total)}, from ${DATA_DIR}`)
  for (const i of items) console.log(`  would remove ${i.label} (${kb(i.bytes)})`)
  console.log('\nRe-run with --yes to remove them. Stop `node server.mjs` first.')
  process.exit(0)
}

let removed = 0
let bytes = 0
for (const i of items) {
  try {
    rmSync(i.path, { force: true })
    removed++
    bytes += i.bytes
    console.log(`  removed ${i.label} (${kb(i.bytes)})`)
  } catch (err) {
    console.error(`  FAILED  ${i.label}: ${err?.message || err}`)
    process.exitCode = 1
  }
}
console.log(`reset-local: removed ${removed} of ${items.length} item(s), ${kb(bytes)}, from ${DATA_DIR}`)
