// Pure game rules for the one-Axie loop. No I/O. The server is the only caller.

// The first rung is the hatch itself; the first thing you wear is earned five photos later.
export const LADDER = [
  { level: 1, bond: 5, reward: 'A name and a voice', unlock: null },
  { level: 2, bond: 10, reward: 'Party hat', unlock: 'hat' },
  { level: 3, bond: 16, reward: 'Scarf', unlock: 'scarf' },
  { level: 4, bond: 24, reward: 'Shades', unlock: 'shades' },
  { level: 5, bond: 34, reward: 'Signature pose', unlock: 'pose-1' },
  { level: 6, bond: 46, reward: 'Cape and frames', unlock: 'cape' },
  { level: 7, bond: 60, reward: 'First trick', unlock: 'trick-1' },
  { level: 8, bond: 76, reward: 'Crown', unlock: 'crown' },
  { level: 9, bond: 95, reward: 'Second trick', unlock: 'trick-2' },
  { level: 10, bond: 120, reward: 'Mystic glow and Idol card', unlock: 'glow' },
]
export const LEVEL_NAMES = { 3: 'Good friends', 7: 'Best friends', 10: 'Idol' }

export function levelFor(bond) {
  let lvl = 0
  for (const row of LADDER) if (bond >= row.bond) lvl = row.level
  return lvl
}

export function nextStep(bond) {
  const row = LADDER.find((r) => bond < r.bond)
  if (!row) return null
  return { level: row.level, bond: row.bond, reward: row.reward, remaining: row.bond - bond }
}

export function eggOdds(snaps, places) {
  const placeBonus = Math.min(0.05, Math.max(0, places - 1) * 0.01)
  if (snaps < 5) return { tier: 0, rareParts: 0, mysticChance: 0, nextTier: 5 }
  if (snaps < 20) return { tier: 5, rareParts: 0, mysticChance: 0, nextTier: 20 }
  if (snaps < 50) return { tier: 20, rareParts: 1, mysticChance: 0, nextTier: 50 }
  if (snaps < 100) return { tier: 50, rareParts: 2, mysticChance: round2(0.05 + placeBonus), nextTier: 100 }
  return { tier: 100, rareParts: 2, mysticChance: round2(0.15 + placeBonus), nextTier: null }
}
const round2 = (n) => Math.round(n * 100) / 100

const TYPES = ['eye', 'ear', 'mouth', 'horn', 'back', 'tail']
const CLASSES = ['Beast', 'Aquatic', 'Plant', 'Bird', 'Bug', 'Reptile']
const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]

export function parsePartId(id) {
  const m = /^S(\d{2})_([A-Za-z]+?)(\d{2})_L(\d)_(Eye|Ear|Mouth|Horn|Back|Tail)$/.exec(id)
  if (!m) throw new Error('bad part id ' + id)
  return { type: m[5].toLowerCase(), skin: Number(m[1]), class: m[2], variant: Number(m[3]), level: Number(m[4]) }
}

/**
 * Roll a wild Axie. Own-class parts 60% of the time, like real Axies.
 * Rare slots are chosen first via a partial Fisher-Yates draw; the Mystic
 * slot (if rolled) is then drawn from the remaining, still-unassigned
 * types, so a Mystic part is always in ADDITION to the guaranteed rare
 * parts, never a substitute for one of them.
 */
export function rollWild(rng, snaps, places, catalogue) {
  const odds = eggOdds(snaps, places)
  const cls = pick(rng, CLASSES)
  const slots = [...TYPES]
  for (let i = 0; i < odds.rareParts; i++) {
    const j = i + Math.floor(rng() * (slots.length - i))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  const rareSlots = new Set(slots.slice(0, odds.rareParts))
  const mystic = odds.mysticChance > 0 && rng() < odds.mysticChance
  let mysticSlot = null
  if (mystic) {
    const i = odds.rareParts
    const j = i + Math.floor(rng() * (slots.length - i))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
    mysticSlot = slots[i]
  }
  const rareIds = []
  let mysticId = null
  const parts = TYPES.map((type) => {
    const partClass = rng() < 0.6 ? cls : pick(rng, CLASSES)
    const bucket = catalogue.parts[partClass][type]
    let pool
    if (type === mysticSlot && bucket.mystic.length) pool = bucket.mystic
    else if (rareSlots.has(type) && bucket.rare.length) pool = bucket.rare
    else pool = bucket.normal.length ? bucket.normal : bucket.rare
    const id = pick(rng, pool)
    if (pool === bucket.mystic) mysticId = id
    else if (pool === bucket.rare) rareIds.push(id)
    return parsePartId(id)
  })
  const colorVariant = pick(rng, catalogue.colorVariants[cls])
  return { descriptor: { colorVariant, body: 'normal', parts }, class: cls, rareIds, mysticId, mystic }
}

/**
 * R1 ships one personality for every Axie: Explorer (decided 11 September 2026 after four rounds
 * of voice tasting; it was the one that read as a real creature every time). The other traits from
 * the voice bible wait for R2, when there is time to make each of them as good.
 */
export const TRAITS = ['Explorer']
/** No pairs to keep apart with a single trait; kept for callers that still ask. */
export const OPPOSITES = []
/** Traits from before the change: an Axie that rolled one of these is an Explorer now. */
const RETIRED_TRAITS = ['Homebody', 'Foodie', 'Athlete', 'Goofball', 'Show-off', 'Shy', 'Brave', 'Dreamer', 'Collector']

function drawTraits(rng, weights, count = 1) {
  const out = []
  const pool = TRAITS.map((t) => ({ t, w: weights[t] ?? 1 }))
  while (out.length < count) {
    const usable = pool.filter((p) => !out.includes(p.t))
    const total = usable.reduce((s, p) => s + p.w, 0)
    let r = rng() * total
    let chosen = usable[usable.length - 1].t
    for (const p of usable) { r -= p.w; if (r <= 0) { chosen = p.t; break } }
    out.push(chosen)
  }
  return out
}

/** Wild roll. With one trait in R1 the egg's handling has nothing to nudge; the shape stays for R2. */
export function rollTraits(rng, nudges) {
  const w = {}
  if (nudges?.places >= 5) w.Explorer = 6
  return drawTraits(rng, w)
}

/**
 * A record from before the change (three traits, or a retired one) becomes one current trait: the
 * first of its traits that still exists, else null so the caller rolls a fresh one.
 */
export function normalizeTraits(traits) {
  const kept = (Array.isArray(traits) ? traits : []).filter((t) => TRAITS.includes(t))
  return kept.length ? [kept[0]] : null
}
export const isRetiredTrait = (t) => RETIRED_TRAITS.includes(t)

export function hashInt(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h
}

function seededRng(seed) {
  let s = seed >>> 0 || 1
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

/** Owned Axies: the same Axie always rolls the same personality. */
export function traitsForOwned(axieId, cls, partNames) {
  const rng = seededRng(hashInt(`${axieId}|${cls}|${[...partNames].sort().join(',')}`))
  return drawTraits(rng, {})
}

const WISHES = [
  { id: 'rain', when: (c) => c.weather === 'rain', text: 'Show me the rain', bonus: 2 },
  { id: 'wind', when: (c) => c.weather === 'wind', text: 'Take me somewhere windy', bonus: 2 },
  { id: 'golden', when: (c) => c.hour >= 17 && c.hour <= 19, text: 'Show me a sunset', bonus: 2 },
  { id: 'night', when: (c) => c.hour >= 20, text: 'Take me out after dark', bonus: 2 },
  { id: 'sea', when: (c) => c.placeTypes.includes('harbour'), text: 'Show me the sea', bonus: 2 },
  { id: 'park', when: (c) => c.placeTypes.includes('park'), text: 'Take me somewhere green', bonus: 1 },
  { id: 'market', when: (c) => c.placeTypes.includes('market'), text: 'Take me somewhere that smells like garlic', bonus: 1 },
  { id: 'peak', when: (c) => c.placeTypes.includes('peak'), text: 'Take me up something', bonus: 2 },
]
const TRAIT_WISH = {
  Explorer: { id: 'new-place', text: "Take me somewhere you've never taken me", bonus: 2 },
}

export function wishForToday(ctx) {
  const done = new Set(ctx.firstsDone || [])
  for (const w of WISHES) if (w.when(ctx) && !done.has(w.id)) return { id: w.id, text: w.text, bonus: w.bonus }
  for (const t of ctx.traits || []) { const w = TRAIT_WISH[t]; if (w && !done.has(w.id)) return w }
  const rest = WISHES.filter((w) => !done.has(w.id))
  const w = rest.length ? rest[Math.floor(ctx.rng() * rest.length)] : WISHES[0]
  return { id: w.id, text: w.text, bonus: w.bonus }
}

export const MOMENTS = [
  { id: 'night-owl', title: 'Night owl', line: 'My eyes did a thing in the dark.', rarityHint: 0.3 },
  { id: 'rain-dancer', title: 'Rain dancer', line: 'Rain is wet. Why is rain wet?', rarityHint: 0.3 },
  { id: 'golden-hour', title: 'Golden hour', line: 'The light went orange and so did I.', rarityHint: 0.4 },
  { id: 'sea-legs', title: 'Sea legs', line: 'The sea is very big and it moves.', rarityHint: 0.3 },
  { id: 'summit', title: 'Summit', line: 'We are on top of the thing.', rarityHint: 0.1 },
  { id: 'market-day', title: 'Market day', line: 'Everything here smells like something.', rarityHint: 0.3 },
  { id: 'temple-bell', title: 'Temple bell', line: 'It is quiet here. I will be quiet too.', rarityHint: 0.15 },
  { id: 'tram-spotter', title: 'Tram spotter', line: 'A long dog on rails. Amazing.', rarityHint: 0.2 },
  { id: 'ferry', title: 'Ferry', line: 'We are on the sea. On it.', rarityHint: 0.2 },
  { id: 'first-friend', title: 'First friend', line: 'There is a person in it who is not you.', rarityHint: 0.5 },
  { id: 'dog', title: 'A dog', line: 'A DOG. Can we keep it?', rarityHint: 0.4 },
  { id: 'cat', title: 'A cat', line: 'It looked at me. I looked back. We are friends now.', rarityHint: 0.3 },
  { id: 'noodles', title: 'Noodles', line: 'Is that for me? Blink twice.', rarityHint: 0.4 },
  { id: 'egg-tart', title: 'Egg tart', line: 'That one is round and yellow and mine.', rarityHint: 0.2 },
  { id: 'rooftop', title: 'Rooftop', line: 'The city is under us. All of it.', rarityHint: 0.1 },
  { id: 'fog', title: 'Fog', line: 'The buildings are hiding. Good game.', rarityHint: 0.1 },
  { id: 'wind', title: 'Wind', line: 'The air pushed me. I pushed back.', rarityHint: 0.2 },
  { id: 'sunrise', title: 'Sunrise', line: 'Up! The sky is doing the thing.', rarityHint: 0.1 },
  { id: 'full-moon', title: 'Full moon', line: 'The moon is round tonight. Rounder than me.', rarityHint: 0.1 },
  { id: 'festival', title: 'Festival', line: 'Everyone is here. I mean everyone.', rarityHint: 0.05 },
  { id: 'new-place', title: 'New place', line: 'We have not been here. Don\'t blink.', rarityHint: 0.9 },
  { id: 'three-districts', title: 'Three districts', line: 'Three places in one day. My legs.', rarityHint: 0.15 },
  { id: 'home-again', title: 'Back where I hatched', line: 'This is where I came out. It looks smaller.', rarityHint: 0.3 },
  { id: 'hundredth', title: 'Hundredth snap', line: 'One hundred. I counted every one.', rarityHint: 0.05 },
]

export function detectMoments(ctx, have) {
  const has = new Set(have)
  const found = []
  const add = (id) => { if (!has.has(id) && !found.includes(id)) found.push(id) }
  const labels = new Set((ctx.labels || []).map((l) => l.toLowerCase()))
  if (ctx.hour >= 20 || ctx.hour < 5) add('night-owl')
  if (ctx.weather === 'rain') add('rain-dancer')
  if (ctx.weather === 'wind') add('wind')
  if (ctx.weather === 'fog') add('fog')
  if (ctx.hour >= 17 && ctx.hour <= 19) add('golden-hour')
  if (ctx.hour >= 5 && ctx.hour < 7) add('sunrise')
  const place = ctx.placeType || ''
  if (place === 'harbour') add('sea-legs')
  if (place === 'peak') add('summit')
  if (place === 'market') add('market-day')
  if (place === 'temple') add('temple-bell')
  if (place === 'rooftop') add('rooftop')
  for (const [label, id] of [['tram', 'tram-spotter'], ['ferry', 'ferry'], ['person', 'first-friend'], ['dog', 'dog'], ['cat', 'cat'], ['noodles', 'noodles'], ['egg tart', 'egg-tart'], ['moon', 'full-moon'], ['festival', 'festival']]) {
    if (labels.has(label)) add(id)
  }
  if (ctx.isNewPlace) add('new-place')
  if (ctx.isNewDistrict && ctx.districtsToday >= 3) add('three-districts')
  if (ctx.hatchGrid && ctx.grid && ctx.hatchGrid === ctx.grid && ctx.snapCount > 5) add('home-again')
  if (ctx.snapCount === 100) add('hundredth')
  return found
}
