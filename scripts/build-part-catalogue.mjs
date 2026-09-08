// scripts/build-part-catalogue.mjs
// Reads the mixer manifest and writes server/partCatalogue.json.
// Rules: wild Axies roll skin-0 stage-1 parts. "rare" = variant >= 10 within its class/type.
// "mystic" = skin-1 parts (the pack's Mystic set) when present for that class/type.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/assets/axie/manifest.json'), 'utf8'))
const CLASSES = ['Beast', 'Aquatic', 'Plant', 'Bird', 'Bug', 'Reptile']
const TYPES = ['eye', 'ear', 'mouth', 'horn', 'back', 'tail']

const parts = {}
for (const c of CLASSES) {
  parts[c] = {}
  for (const t of TYPES) parts[c][t] = { normal: [], rare: [], mystic: [] }
}
for (const [id, entry] of Object.entries(manifest.assets.parts)) {
  const d = entry.descriptor
  if (!CLASSES.includes(d.class) || !TYPES.includes(d.type) || d.level !== 1) continue
  const bucket = parts[d.class][d.type]
  if (d.skin === 0) (d.variant >= 10 ? bucket.rare : bucket.normal).push(id)
  else if (d.skin === 1) bucket.mystic.push(id)
}
const colorVariants = {}
for (const v of manifest.creator.colorVariants) {
  if (v.skin !== 0) continue
  const cls = v.class[0].toUpperCase() + v.class.slice(1)
  if (!CLASSES.includes(cls)) continue
  ;(colorVariants[cls] ||= []).push(v.index)
}
const out = { generatedAt: new Date().toISOString(), parts, colorVariants }
writeFileSync(resolve(ROOT, 'server/partCatalogue.json'), JSON.stringify(out))
for (const c of CLASSES) {
  const row = TYPES.map((t) => `${t}:${parts[c][t].normal.length}/${parts[c][t].rare.length}/${parts[c][t].mystic.length}`).join(' ')
  console.log(c.padEnd(8), row, 'colours', (colorVariants[c] || []).length)
}
