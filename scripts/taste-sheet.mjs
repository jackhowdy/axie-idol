/**
 * Voice tasting: what the Axie says about a set of photos, for every lead trait, three lines each.
 * Same brief, same model and same rules as the app, so what reads well here reads well on a phone.
 *
 *   node scripts/taste-sheet.mjs --photos <dir of .jpg> --out <file.json> [--lines 3] [--concurrency 4]
 *
 * GEMINI_API_KEY comes from the repo's .env (never printed). Output is a JSON sheet: one entry per
 * photo with what the model saw, and per lead trait the class, the name and the lines.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createVoiceModel, splitImage } from '../server/voiceModel.mjs'
import { characterBrief, afterPrompt, cleanSeen, tidyLine, AFTER_SCHEMA } from '../server/voiceBrief.mjs'
import { checkRules } from '../server/voiceLines.mjs'
import { TRAITS } from '../server/buddyRules.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length))
const photosDir = args.photos
const out = args.out || 'taste-sheet.json'
const perTrait = Number(args.lines || 3)
const concurrency = Number(args.concurrency || 4)
if (!photosDir) { console.error('usage: --photos <dir> --out <file.json>'); process.exit(2) }

// .env next to the repo root, like server.mjs does
const envPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const model = createVoiceModel({ env: process.env })
if (!model.enabled) { console.error('GEMINI_API_KEY missing'); process.exit(2) }

const CLASSES = ['Beast', 'Aquatic', 'Plant', 'Bird', 'Bug', 'Reptile']
const NAMES = { Beast: 'Miso', Aquatic: 'Pip', Plant: 'Sprout', Bird: 'Chirp', Bug: 'Dot', Reptile: 'Sol' }
/** One Axie per trait, with a class spread across the six. */
const AXIES = TRAITS.map((lead, i) => {
  const cls = CLASSES[i % CLASSES.length]
  return { name: NAMES[cls], class: cls, traits: [lead], level: 2, wardrobe: { worn: null }, wish: { text: '' }, moments: [], seen: [], places: {}, snapCount: 3 }
})

const files = fs.readdirSync(photosDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
const sheet = { generatedAt: new Date().toISOString(), model: model.model, photos: [] }

async function askLine(axie, image, recent) {
  const b = { ...axie, recentLines: recent }
  const res = await model.ask({ system: characterBrief(b), user: afterPrompt(b, { dayCount: 3, hour: 15 }), image, schema: AFTER_SCHEMA, maxTokens: 120, temperature: 1.0 })
  const line = tidyLine(res?.line)
  return { seen: cleanSeen(res?.seen), line, ok: Boolean(line) && checkRules(line) }
}

const queue = []
for (const file of files) {
  const raw = fs.readFileSync(path.join(photosDir, file))
  const image = splitImage(`data:image/${/\.png$/i.test(file) ? 'png' : 'jpeg'};base64,${raw.toString('base64')}`)
  const entry = { file, seen: [], axies: [] }
  sheet.photos.push(entry)
  for (const axie of AXIES) {
    const row = { lead: axie.traits[0], traits: axie.traits, class: axie.class, name: axie.name, lines: [] }
    entry.axies.push(row)
    queue.push(async () => {
      const recent = []
      for (let i = 0; i < perTrait; i++) {
        const r = await askLine(axie, image, recent)
        if (!entry.seen.length && r.seen.length) entry.seen = r.seen
        row.lines.push({ text: r.line, ok: r.ok })
        if (r.line) recent.push(r.line)
      }
      process.stdout.write('.')
    })
  }
}

let next = 0
async function worker() { while (next < queue.length) { const job = queue[next++]; try { await job() } catch (e) { process.stdout.write('x') } } }
const t0 = Date.now()
await Promise.all(Array.from({ length: concurrency }, worker))
fs.writeFileSync(out, JSON.stringify(sheet, null, 2))
const total = sheet.photos.reduce((n, p) => n + p.axies.reduce((m, a) => m + a.lines.length, 0), 0)
const failed = sheet.photos.reduce((n, p) => n + p.axies.reduce((m, a) => m + a.lines.filter((l) => !l.ok).length, 0), 0)
console.log(`\n${files.length} photos x ${AXIES.length} Axies x ${perTrait} = ${total} lines (${failed} failed the rules) in ${Math.round((Date.now() - t0) / 1000)}s -> ${out}; model calls ${model.stats().used}`)
