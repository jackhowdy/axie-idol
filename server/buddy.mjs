// One-Axie loop: egg, hatch, claim, snaps, wishes, moments, ladder, diary. Server is the authority.
import catalogueJson from './partCatalogue.json' with { type: 'json' }
import {
  LADDER, LEVEL_NAMES, levelFor, nextStep, eggOdds, rollWild, rollTraits, traitsForOwned,
  wishForToday, detectMoments, MOMENTS,
} from './buddyRules.mjs'
import { pickLine, checkRules } from './voiceLines.mjs'
import { createVoiceModel, splitImage } from './voiceModel.mjs'
import { characterBrief, afterPrompt, greetingPrompt, talkPrompt, cleanSeen, tidyLine, AFTER_SCHEMA, LINE_SCHEMA, REPLY_SCHEMA } from './voiceBrief.mjs'
import { signInMessage, recoverAddress } from './roninSig.mjs'

const NAME_RE = /^[\p{L}\p{N} '’-]{2,16}$/u
const BAD_WORDS = ['shit', 'fuck', 'cunt', 'nigg', 'fag', 'bitch', 'dick', 'porn', 'nazi']
const DAILY_CAP = 10
const PLACE_GRID_DEG = 0.003 // ~300 m
/** Scrapbook keeps the last N photo records (id + upload path). */
const PHOTO_CAP = 60
/**
 * `photoIds` is unbounded no longer: the head is what the diary indexes into (day one, hatch day),
 * the tail is what the scrapbook shows, and the middle is never read by anything.
 */
const PHOTO_ID_HEAD = 5
const PHOTO_ID_TAIL = 60
/** Cap on how many Axies one account can pile into its scrapbook. */
const BUDDY_CAP = 20
/** Spells counts in words so a spoken line never carries a digit (voice rule). */
const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
  'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one',
]
const wordsFor = (n) => (Number.isFinite(n) && n >= 0 && n < ONES.length ? ONES[Math.floor(n)] : 'many')
/**
 * Per-device hourly ceilings for the routes that create or move state. `handle` takes the
 * limit from `"<METHOD> <path>"` so a mismatched method never spends a slot.
 */
const RATE_LIMITS = {
  'POST /api/buddy/egg': 5,
  'POST /api/buddy/retire': 5,
  'POST /api/buddy/photo/unkeep': 20,
  'POST /api/account/recover': 10,
  'POST /api/account/recovery': 10,
  'GET /api/ronin/nonce': 20,
  'POST /api/ronin/verify': 20,
}
/** A signed-in nonce is only worth keeping for ten minutes; these bound the pending map. */
const NONCE_TTL_MS = 10 * 60_000
const NONCES_PER_ADDRESS = 5
const NONCE_ADDRESS_CAP = 2000

export function createBuddyModule({ storage, helpers, env = {}, catalogue = catalogueJson, now = () => Date.now(), rng = Math.random, voice = null }) {
  const { sendJson, readBody, deviceKeyFrom, manilaDayKey, fetchAxieGenes, fetchAllOwnerAxies, normalizeAddress, checkRate, recordRate, removePost } = helpers
  const enabled = env.BUDDY !== '0'
  // The model behind the voice (tests pass a fake; production reads GEMINI_API_KEY). Off = library only.
  const model = voice || createVoiceModel({ env, now })

  const emptyStore = () => ({ accounts: {}, buddies: {}, usedRecoveryCodes: {}, pendingNonces: {} })
  const load = () => storage.get('buddies', emptyStore)
  const save = (s) => storage.set('buddies', s)
  const monthKey = () => manilaDayKey().slice(0, 7)
  const uid = () => crypto.randomUUID()

  function accountFor(store, ownerKey) {
    return (store.accounts[ownerKey] ||= { ownerKey, activeBuddyId: null, buddyIds: [], recoveryCode: null })
  }
  /**
   * Session (Task 8) wins over device key. Header only: a session in the query string would ride
   * along in referrers, logs and shared links, so it is not accepted there.
   */
  function ownerKeyFrom(req, body) {
    const session = req.headers?.get?.('x-buddy-session')
    const addr = session ? verifySession(load(), session) : null
    if (addr) return `ronin:${addr}`
    const dk = deviceKeyFrom(req, body || {})
    return dk ? `device:${dk}` : null
  }
  /**
   * Bounds the pending-nonce map: expired nonces go, then the oldest ones past five for this
   * address, then the least recently used addresses past two thousand. Without this an unsigned
   * GET could grow the store without limit.
   */
  function prunePendingNonces(pending, address) {
    const bucket = pending[address]
    if (bucket) {
      for (const k of Object.keys(bucket)) if (now() - bucket[k] > NONCE_TTL_MS) delete bucket[k]
      const keys = Object.keys(bucket).sort((a, b) => bucket[a] - bucket[b])
      while (keys.length > NONCES_PER_ADDRESS) delete bucket[keys.shift()]
      if (!Object.keys(bucket).length) delete pending[address]
    }
    const addrs = Object.keys(pending)
    if (addrs.length <= NONCE_ADDRESS_CAP) return
    const newestOf = (a) => Math.max(0, ...Object.values(pending[a]))
    addrs.sort((a, b) => newestOf(a) - newestOf(b))
    while (addrs.length > NONCE_ADDRESS_CAP) delete pending[addrs.shift()]
  }

  function verifySession(store, token) {
    for (const acc of Object.values(store.accounts)) if (acc.session === token && acc.ownerKey.startsWith('ronin:')) return acc.ownerKey.slice(6)
    return null
  }

  /** Move all of fromKey's buddies onto toKey's account (device -> wallet on sign-in, recovery-code redemption). */
  function mergeAccounts(store, fromKey, toKey) {
    if (fromKey === toKey) return
    const from = store.accounts[fromKey]; if (!from) return
    const to = accountFor(store, toKey)
    for (const id of from.buddyIds) { const b = store.buddies[id]; if (!b) continue; b.ownerKey = toKey; if (!to.buddyIds.includes(id)) to.buddyIds.push(id) }
    if (!to.activeBuddyId || !store.buddies[to.activeBuddyId]?.hatchedAt) to.activeBuddyId = from.activeBuddyId || to.activeBuddyId
    from.buddyIds = []; from.activeBuddyId = null
  }

  /**
   * A recovery code moves a whole account to another phone, so it is a credential and never comes
   * from the injectable `rng` (seeded in tests, Math.random in production). The 32-letter alphabet
   * divides 256 exactly, so a plain byte -> letter map is unbiased.
   */
  const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  function recoveryCode() {
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    const letters = Array.from(bytes, (n) => RECOVERY_ALPHABET[n % RECOVERY_ALPHABET.length])
    return [letters.slice(0, 4), letters.slice(4, 8), letters.slice(8, 12)].map((c) => c.join('')).join('-')
  }

  function newEgg(ownerKey) {
    return {
      id: uid(), ownerKey, kind: 'wild', axieId: null, class: null, descriptor: null,
      name: '', traits: [], earnedTrait: null, createdAt: new Date(now()).toISOString(), hatchedAt: null, retiredAt: null,
      egg: { snaps: 0, grids: [], distanceKm: 0, foodSnaps: 0, lastLatLng: null },
      bond: 0, bondByDay: {}, monthly: { key: monthKey(), bond: 0 },
      wish: { day: null, id: null, text: '', bonus: 1, done: false }, firstsDone: [],
      wardrobe: { unlocked: [], worn: null }, moments: [], places: {},
      photoIds: [], photos: [], snapCount: 0, unkeptCount: 0, lastSnapAt: null, recentLines: [], hatchGrid: null, rareIds: [], mysticId: null, mystic: false,
      // What the model saw in recent photos, the last talk exchanges, and today's greeting (one per day).
      seen: [], talkLog: [], greeting: null,
      // Photos counted per day: the ten-a-day ceiling is on photos, never on the bonuses.
      snapsByDay: {},
    }
  }

  function gridOf(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null
    return `${Math.round(lat / PLACE_GRID_DEG)}:${Math.round(lng / PLACE_GRID_DEG)}`
  }
  function kmBetween(a, b) {
    const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(x))
  }

  function publicBuddy(b) {
    if (!b) return null
    const level = b.hatchedAt ? levelFor(b.bond) : 0
    return {
      ...b, level, levelName: LEVEL_NAMES[level] || null, next: b.hatchedAt ? nextStep(b.bond) : null,
      photos: b.photos || [], // records written before this field existed
      // Photos still in the book: every counted snap minus the ones the owner chose not to keep.
      photoCount: Math.max(0, b.snapCount - (b.unkeptCount || 0)),
      eggOdds: b.hatchedAt ? null : eggOdds(b.egg.snaps, b.egg.grids.length),
      momentsTotal: MOMENTS.length, ladder: LADDER, bondToday: b.bondByDay[manilaDayKey()] || 0, snapsToday: snapsToday(b), dailyCap: DAILY_CAP,
      streak: streakFor(b),
    }
  }
  function streakFor(b) {
    let n = 0
    const d = new Date(now())
    for (;;) {
      const key = manilaDayKey(d)
      if (!(b.bondByDay[key] > 0)) break
      n++; d.setUTCDate(d.getUTCDate() - 1)
    }
    return n
  }
  function payload(store, ownerKey, extra = {}) {
    const acc = accountFor(store, ownerKey)
    const buddies = acc.buddyIds.map((id) => publicBuddy(store.buddies[id])).filter(Boolean)
    return { active: publicBuddy(store.buddies[acc.activeBuddyId]), buddies, ...extra }
  }
  /** Active buddy inside an already-loaded store, so a caller that has one never loads it twice. */
  function getActiveIn(store, ownerKey) {
    const acc = store.accounts[ownerKey]
    return acc ? store.buddies[acc.activeBuddyId] || null : null
  }
  function getActive(ownerKey) {
    return getActiveIn(load(), ownerKey)
  }

  function say(b, situation, slots = {}) {
    const line = pickLine({ traits: b.traits, situation, slots, recent: b.recentLines, rng })
    b.recentLines = [...b.recentLines.filter((l) => l !== line), line].slice(-60)
    return line
  }
  /** A model line that passed the rules, remembered so the library never repeats it soon after. */
  function heard(b, line) {
    b.recentLines = [...b.recentLines.filter((l) => l !== line), line].slice(-60)
    return line
  }
  /** Tidy a model line and hold it to the same ten rules as the library; null when it fails. */
  function ruled(raw) {
    const line = tidyLine(raw)
    if (!line) return null
    if (!checkRules(line)) {
      // worth a log line: the voice bible's rules are the whole point, and a model that keeps
      // tripping them shows up here before it shows up as silence on a phone
      console.warn('[voice] model line failed the rules: ' + line)
      return null
    }
    return line
  }
  const talkCtx = (b, extra = {}) => ({ dayCount: b.hatchedAt ? daysSince(b.hatchedAt) : undefined, ...extra })

  /**
   * A memory reply built only from `b.places` (a count) and a fixed hatch-day fact — the
   * only two things this function actually reads. Answers what was asked: hatch/came-out
   * wording gets the hatch line, place/park/where/been wording gets the places line (when
   * there are any places to talk about), otherwise it falls back to `places`-driven
   * randomness like before. Never a digit — the count is spelled with `wordsFor`.
   */
  function memoryLine(b, text = '') {
    const placeCount = Object.keys(b.places || {}).length
    const placesLine = () => `We went to ${wordsFor(placeCount)} places. The first one was warm.`
    const hatchLine = 'This is where I came out. It looked bigger from inside.'
    if (/hatch|came out|born|egg/.test(text)) return hatchLine
    if (/park|place|where|been/.test(text) && placeCount) return placesLine()
    if (!placeCount || rng() < 0.5) return hatchLine
    return placesLine()
  }

  /** The weather slot is client-supplied and lands inside a spoken line: letters only, never a digit. */
  function weatherWord(raw) {
    const w = String(raw || '').toLowerCase().replace(/[^a-z ]/g, '').trim().slice(0, 16)
    return w || 'fine'
  }

  function validName(raw) {
    const name = String(raw || '').trim().replace(/\s+/g, ' ')
    if (!NAME_RE.test(name)) return null
    const low = name.toLowerCase().replace(/[^a-z]/g, '')
    if (BAD_WORDS.some((w) => low.includes(w))) return null
    return name
  }

  /**
   * The fourth trait is not rolled, it is earned: at bond level 10 the Axie takes a name for how it
   * was actually played. Night owl beats Wanderer beats Socialite, and it is set once, for good.
   */
  function earnTrait(b, before, after) {
    if (!(before < 10 && after >= 10) || b.earnedTrait) return
    if (b.moments.some((m) => m.id === 'night-owl')) b.earnedTrait = 'Night owl'
    else if (Object.keys(b.places || {}).length >= 8) b.earnedTrait = 'Wanderer'
    else b.earnedTrait = 'Socialite'
  }

  /** Photos counted today (the ceiling is per photo; wishes and moments land on top). */
  function snapsToday(b, day = manilaDayKey()) {
    return (b.snapsByDay ||= {})[day] || 0
  }
  /**
   * `photo: true` is the one bond per counted photo, and only the first ten photos of a day count.
   * Everything else (a wish, a moment) is a bonus with no ceiling of its own: a wish that came true
   * on a day with ten photos already in the book still pays, and reads that way on the card.
   */
  function addBond(b, amount, { photo = false } = {}) {
    const day = manilaDayKey()
    const today = b.bondByDay[day] || 0
    if (photo) {
      if (snapsToday(b, day) >= DAILY_CAP) return { granted: 0, unlocks: [] }
      b.snapsByDay[day] = snapsToday(b, day) + 1
    }
    const granted = Math.max(0, Math.floor(amount))
    if (granted <= 0) return { granted: 0, unlocks: [] }
    const before = levelFor(b.bond)
    b.bond += granted
    b.bondByDay[day] = today + granted
    if (b.monthly.key !== monthKey()) b.monthly = { key: monthKey(), bond: 0 }
    b.monthly.bond += granted
    const after = levelFor(b.bond)
    const unlocks = []
    for (const row of LADDER) if (row.level > before && row.level <= after) { unlocks.push(row); if (row.unlock && !b.wardrobe.unlocked.includes(row.unlock)) b.wardrobe.unlocked.push(row.unlock) }
    earnTrait(b, before, after)
    return { granted, unlocks }
  }

  /** Called by core after a post is stored. Returns the snap result for the client or null. */
  async function recordSnap(post, ctx) {
    if (!enabled || !ctx.buddy) return null
    const store = load()
    const b = getActiveIn(store, ctx.ownerKey)
    if (!b || b.retiredAt) return null
    const grid = gridOf(ctx.lat, ctx.lng)
    const hour = Number(ctx.hour ?? new Date(now()).getUTCHours() + 8) % 24
    let labels = Array.isArray(ctx.labels) ? ctx.labels.slice(0, 12).map(String) : []
    b.photoIds.push(post.id); b.snapCount += 1; b.lastSnapAt = new Date(now()).toISOString()
    // Keep the head the diary indexes into and the tail the scrapbook shows; drop the middle,
    // which nothing reads. `snapCount` stays the true total.
    if (b.photoIds.length > PHOTO_ID_HEAD + PHOTO_ID_TAIL) {
      b.photoIds = [...b.photoIds.slice(0, PHOTO_ID_HEAD), ...b.photoIds.slice(-PHOTO_ID_TAIL)]
    }
    // `photoIds` are post ids; /api/image/<id> serves marketplace art, so the scrapbook needs the
    // stored upload path too. Kept alongside photoIds (never instead of it) and capped at the last 60.
    b.photos = [...(b.photos || []), { id: post.id, imagePath: post.imagePath || '', at: b.lastSnapAt }].slice(-PHOTO_CAP)
    const isNewPlace = Boolean(grid && !b.places[grid])
    if (grid) { const p = (b.places[grid] ||= { first: b.lastSnapAt, count: 0, district: ctx.district || null }); p.count += 1 }

    if (!b.hatchedAt) {
      const e = b.egg
      const day = manilaDayKey(); const today = b.bondByDay[day] || 0
      if (snapsToday(b, day) < DAILY_CAP) { e.snaps += 1; b.snapsByDay[day] = snapsToday(b, day) + 1; b.bondByDay[day] = today + 1 }
      if (grid && !e.grids.includes(grid)) e.grids.push(grid)
      if (typeof ctx.lat === 'number' && typeof ctx.lng === 'number') {
        if (e.lastLatLng) e.distanceKm += kmBetween(e.lastLatLng, { lat: ctx.lat, lng: ctx.lng })
        e.lastLatLng = { lat: ctx.lat, lng: ctx.lng }
      }
      if (labels.some((l) => /noodle|food|tart|bun|rice|coffee|tea|cake/i.test(l))) e.foodSnaps += 1
      save(store)
      return { kind: 'egg', snaps: e.snaps, odds: eggOdds(e.snaps, e.grids.length), canHatch: e.snaps >= 5 }
    }

    // The model looks at the photo first: what it saw drives the wish, the moments and the line.
    // Nothing here blocks the shot: a slow or failed call leaves the library to speak.
    let modelLine = null
    const image = model.enabled ? splitImage(ctx.image) : null
    if (image) {
      const snapCtx = talkCtx(b, { hour, weather: ctx.weather, placeName: ctx.placeName, placeType: ctx.placeType, firstTimeHere: isNewPlace })
      const out = await model.ask({ system: characterBrief(b), user: afterPrompt(b, snapCtx), image, schema: AFTER_SCHEMA, maxTokens: 120 })
      const seen = cleanSeen(out?.seen)
      if (seen.length) labels = seen
      modelLine = ruled(out?.line)
    }
    if (labels.length) b.seen = [...(b.seen || []), { day: manilaDayKey(), seen: labels.slice(0, 4), place: ctx.placeName || ctx.placeType || null }].slice(-10)

    const { granted, unlocks } = addBond(b, 1, { photo: true })
    let wishDone = null
    if (b.wish.day === manilaDayKey() && !b.wish.done && wishMatches(b.wish.id, { hour, weather: ctx.weather, placeType: ctx.placeType, labels, isNewPlace })) {
      // The bonus has no ceiling, so a wish that came true always pays and is always spent.
      const w = addBond(b, b.wish.bonus)
      if (w.granted >= 1) {
        b.wish.done = true; b.firstsDone.push(b.wish.id); wishDone = b.wish
        unlocks.push(...w.unlocks)
      }
    }
    const districtsToday = new Set(Object.values(b.places).filter((p) => p.district && p.count).map((p) => p.district)).size
    const found = detectMoments({ hour, weather: ctx.weather, placeType: ctx.placeType, labels, isNewPlace, isNewDistrict: Boolean(ctx.district), districtsToday, snapCount: b.snapCount, hatchGrid: b.hatchGrid, grid }, b.moments.map((m) => m.id))
    for (const id of found) { b.moments.push({ id, at: b.lastSnapAt, photoId: post.id }); const m = addBond(b, 2); unlocks.push(...m.unlocks) }
    // Only real nouns go into slots. With nothing seen or named, lines that need {thing} or
    // {place} are skipped, so the Axie never says "There was here" or "First time at here".
    const slots = {}
    if (labels[0]) slots.thing = labels[0]
    if (ctx.placeName) slots.place = ctx.placeName
    else if (ctx.placeType) { slots.place = `the ${ctx.placeType}`; slots.thing = slots.thing || `the ${ctx.placeType}` }
    const line = modelLine ? heard(b, modelLine) : say(b, 'after', slots)
    const momentLines = found.map((id) => MOMENTS.find((m) => m.id === id)).filter(Boolean)
    save(store)
    return {
      kind: 'snap', granted, bond: b.bond, level: levelFor(b.bond), next: nextStep(b.bond), line, labels, isNewPlace,
      wishDone, unlocks: unlocks.map((u) => ({ level: u.level, reward: u.reward, unlock: u.unlock, line: say(b, 'big') })),
      moments: momentLines.map((m) => ({ ...m, rarity: m.rarityHint })), bondToday: b.bondByDay[manilaDayKey()] || 0, snapsToday: snapsToday(b), dailyCap: DAILY_CAP,
    }
  }
  function wishMatches(id, c) {
    switch (id) {
      case 'rain': return c.weather === 'rain'; case 'wind': return c.weather === 'wind'
      case 'golden': return c.hour >= 17 && c.hour <= 19; case 'night': return c.hour >= 20
      case 'sea': return c.placeType === 'harbour'; case 'park': return c.placeType === 'park'
      case 'market': return c.placeType === 'market'; case 'peak': case 'high': return c.placeType === 'peak'
      case 'new-place': return c.isNewPlace; case 'food': return c.labels.some((l) => /noodle|food|tart|bun|rice/i.test(l))
      case 'crowd': case 'quiet': case 'silly': case 'stairs': case 'return': case 'sky': case 'sign': return true
      default: return false
    }
  }

  function ensureWish(b, ctx = {}) {
    const day = manilaDayKey()
    if (b.wish.day === day) return b.wish
    const hour = Number(ctx.hour ?? new Date(now()).getUTCHours() + 8) % 24
    const w = wishForToday({ weather: ctx.weather, hour, placeTypes: ctx.placeTypes || [], firstsDone: b.firstsDone, traits: b.traits, rng })
    b.wish = { day, id: w.id, text: w.text, bonus: w.bonus, done: false }
    return b.wish
  }

  /**
   * One greeting per day per Axie: the first open of the day asks the model (or the library) and
   * every later open that day hears the same line, so coming back to Home is not a slot machine.
   * Two or more days away turns it into a welcome back.
   */
  async function greetingFor(b, weatherRaw) {
    const day = manilaDayKey()
    const daysAway = Math.floor(hoursSince(b.lastSnapAt) / 24)
    const situation = daysAway >= 2 ? 'return' : 'morning'
    if (b.greeting && b.greeting.day === day && b.greeting.situation === situation && b.greeting.line) return b.greeting.line
    const weather = weatherRaw ? weatherWord(weatherRaw) : null
    let line = null
    if (model.enabled) {
      const out = await model.ask({ system: characterBrief(b), user: greetingPrompt(b, talkCtx(b, { daysAway, weather, hour: (new Date(now()).getUTCHours() + 8) % 24 })), schema: LINE_SCHEMA, maxTokens: 100 })
      line = ruled(out?.line)
      if (line) heard(b, line)
    }
    if (!line) line = say(b, situation, { count: wordsFor(daysSince(b.hatchedAt)), days: wordsFor(daysAway), ...(weather ? { weather } : {}) })
    b.greeting = { day, situation, line }
    return line
  }

  /**
   * Talk without the model: a handful of things people actually type, answered from the library
   * and the Axie's own memory. Never a digit.
   */
  function libraryReply(b, text) {
    if (/sad|tired|rough|bad day|lonely|miss/.test(text)) return say(b, 'talk-warm')
    if (/remember|hatch|born|came out|first|where|place|park|noodle/.test(text)) return memoryLine(b, text)
    if (/^(hi|hello|hey|yo|hiya|good morning|morning|good evening)\b/.test(text)) return say(b, 'morning')
    if (/\b(love|like) you\b|\bcute\b|\bgood (boy|girl|axie)\b/.test(text)) return say(b, 'big')
    if (/\b(walk|go out|outside|photo|picture|snap)\b/.test(text)) return say(b, 'before')
    if (/\b(food|eat|hungry|lunch|dinner|snack)\b/.test(text)) return b.traits.includes('Foodie') ? say(b, 'wish') : 'Food? I only eat pictures. Take one of the food.'
    if (/\b(bye|night|sleep|goodnight)\b/.test(text)) return say(b, 'bedtime')
    if (/\b(wish|want|today)\b/.test(text) && b.wish?.text) return b.wish.done ? 'My wish came true today. I felt it in my horns.' : b.wish.text + '. That is my wish today.'
    if (text.includes('?')) return say(b, 'talk-curious')
    return say(b, 'talk')
  }

  /**
   * Operator-only ladder seeding, for the demo. Not part of the game: it writes bond straight onto
   * a buddy so a seeded ladder can show a real podium instead of eight accounts tied at the daily
   * cap, which is all the public API can produce in a single day.
   *
   * Every rejection path returns `false`, so core answers with its ordinary
   * `{ error: 'Not found' }` 404 and the route is indistinguishable from one that does not exist.
   * On a deployment that never set `ADMIN_KEY`, it genuinely does not exist.
   */
  async function handleAdmin(req, res, url) {
    const adminKey = typeof env.ADMIN_KEY === 'string' ? env.ADMIN_KEY : ''
    if (!adminKey) return false
    if (req.headers?.get?.('x-admin-key') !== adminKey) return false
    if (req.method !== 'POST' || !['/api/admin/seed-bond', '/api/admin/remove-post'].includes(url.pathname)) return false

    let body
    try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { sendJson(res, 400, { error: 'Invalid JSON' }); return true }
    const store = load()
    // Operator moderation for a public feed: drop one post (and its upload) wherever it came from.
    // The buddy that took it keeps its snap count, exactly like the owner's own "don't keep".
    if (url.pathname === '/api/admin/remove-post') {
      const postId = String(body.id || '')
      if (!postId) { sendJson(res, 400, { error: 'id required' }); return true }
      for (const b of Object.values(store.buddies)) {
        if (!b.photoIds.includes(postId) && !(b.photos || []).some((x) => x.id === postId)) continue
        b.photoIds = b.photoIds.filter((id) => id !== postId)
        b.photos = (b.photos || []).filter((x) => x.id !== postId)
        b.moments = b.moments.filter((m) => m.photoId !== postId)
        b.unkeptCount = (b.unkeptCount || 0) + 1
      }
      save(store)
      let removed = false
      if (typeof removePost === 'function') { try { removed = Boolean(await removePost(postId)) } catch { removed = false } }
      sendJson(res, 200, { id: postId, removed })
      return true
    }
    // Own-property lookup only: an id of `constructor` or `__proto__` must miss, not reach up the
    // prototype chain and hand us something that is not a buddy.
    const buddyId = String(body.buddyId || '')
    const b = Object.prototype.hasOwnProperty.call(store.buddies, buddyId) ? store.buddies[buddyId] : null
    if (!b) { sendJson(res, 404, { error: 'Buddy not found' }); return true }
    const bondRaw = Number(body.bond)
    const monthlyRaw = Number(body.monthlyBond)
    if (!Number.isFinite(bondRaw) || !Number.isFinite(monthlyRaw)) { sendJson(res, 400, { error: 'bond and monthlyBond must be numbers' }); return true }
    const beforeLevel = levelFor(b.bond)
    b.bond = Math.max(0, Math.floor(bondRaw))
    b.monthly = { key: monthKey(), bond: Math.max(0, Math.floor(monthlyRaw)) }
    earnTrait(b, beforeLevel, levelFor(b.bond))
    // Recompute the wardrobe from the ladder for the new bond, union with whatever it already had.
    for (const row of LADDER) {
      if (row.unlock && b.bond >= row.bond && !b.wardrobe.unlocked.includes(row.unlock)) b.wardrobe.unlocked.push(row.unlock)
    }
    save(store)
    sendJson(res, 200, { buddyId: b.id, name: b.name, bond: b.bond, level: levelFor(b.bond), monthly: b.monthly, wardrobe: b.wardrobe })
    return true
  }

  async function handle(req, res, url) {
    if (!enabled || !/^\/api\/(buddy|ronin|ladder|account|admin)\b/.test(url.pathname)) return false
    // Operator routes come first: they carry no device key, and the body is only read once the key
    // has matched, so a malformed body on an unauthorised call cannot answer differently either.
    if (url.pathname.startsWith('/api/admin/')) return handleAdmin(req, res, url)
    let body = {}
    if (req.method === 'POST') { try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { sendJson(res, 400, { error: 'Invalid JSON' }); return true } }
    const ownerKey = ownerKeyFrom(req, body)
    if (!ownerKey) { sendJson(res, 400, { error: 'Missing X-Device-Key' }); return true }
    // Per-device hourly ceilings on the state-creating routes. Answered like a post 429 so the
    // client can read `limit` the same way. Host without a rate limiter (unit tests): no ceiling.
    const rateLimit = RATE_LIMITS[`${req.method} ${url.pathname}`]
    if (rateLimit && typeof checkRate === 'function' && typeof recordRate === 'function') {
      const rateKey = deviceKeyFrom(req, body) || ownerKey
      const r = checkRate(rateKey, 'buddy', { limit: rateLimit })
      if (!r.ok) { sendJson(res, 429, { error: `Rate limit: max ${rateLimit}/hour`, limit: rateLimit }); return true }
      recordRate(rateKey, 'buddy')
    }
    const store = load()
    const acc = accountFor(store, ownerKey)
    const active = store.buddies[acc.activeBuddyId] || null
    const p = url.pathname

    if (p === '/api/buddy' && req.method === 'GET') {
      if (active?.hatchedAt) { ensureWish(active, { weather: url.searchParams.get('weather'), hour: url.searchParams.get('hour') }); save(store) }
      // Numeric slots are spelled: a template line that reached a digit would break the voice rule
      // ("no numbers") the moment the trait pools ran dry and `{count}`/`{days}` were filled.
      const greeting = active?.hatchedAt ? await greetingFor(active, url.searchParams.get('weather')) : null
      if (greeting) save(store)
      sendJson(res, 200, payload(store, ownerKey, { greeting })); return true
    }
    if (p === '/api/buddy/egg' && req.method === 'POST') {
      if (active && !active.retiredAt && !active.hatchedAt) { sendJson(res, 200, payload(store, ownerKey)); return true }
      if (acc.buddyIds.length >= BUDDY_CAP) { sendJson(res, 409, { error: 'Too many Axies in the scrapbook' }); return true }
      const egg = newEgg(ownerKey)
      store.buddies[egg.id] = egg; acc.buddyIds.push(egg.id); acc.activeBuddyId = egg.id
      save(store); sendJson(res, 201, payload(store, ownerKey)); return true
    }
    if (p === '/api/buddy/hatch' && req.method === 'POST') {
      if (!active || active.hatchedAt) { sendJson(res, 409, { error: 'No egg to hatch' }); return true }
      if (active.egg.snaps < 5) { sendJson(res, 409, { error: 'Five snaps first', snaps: active.egg.snaps }); return true }
      const name = validName(body.name)
      if (!name) { sendJson(res, 400, { error: 'Name must be 2 to 16 letters and kind' }); return true }
      const roll = rollWild(rng, active.egg.snaps, active.egg.grids.length, catalogue)
      active.descriptor = roll.descriptor; active.class = roll.class; active.rareIds = roll.rareIds; active.mysticId = roll.mysticId ?? null; active.mystic = roll.mystic
      active.traits = rollTraits(rng, { places: active.egg.grids.length, distanceKm: active.egg.distanceKm, foodSnaps: active.egg.foodSnaps, oneSpot: active.egg.grids.length <= 1 && active.egg.snaps >= 10 })
      active.name = name; active.hatchedAt = new Date(now()).toISOString(); active.hatchGrid = active.egg.grids.at(-1) || null
      active.bond = 0
      const conv = addBondIgnoringCap(active, active.egg.snaps)
      const lines = active.traits.map((t) => pickLine({ traits: [t], situation: 'hatch', rng }))
      ensureWish(active)
      save(store); sendJson(res, 200, payload(store, ownerKey, { lines, unlocks: conv.unlocks })); return true
    }
    if (p === '/api/buddy/retire' && req.method === 'POST') {
      if (acc.buddyIds.length >= BUDDY_CAP) { sendJson(res, 409, { error: 'Too many Axies in the scrapbook' }); return true }
      if (active && active.hatchedAt) active.retiredAt = new Date(now()).toISOString()
      const egg = newEgg(ownerKey)
      store.buddies[egg.id] = egg; acc.buddyIds.push(egg.id); acc.activeBuddyId = egg.id
      save(store); sendJson(res, 201, payload(store, ownerKey)); return true
    }
    if (p === '/api/buddy/switch' && req.method === 'POST') {
      const target = store.buddies[String(body.buddyId || '')]
      if (!target || target.ownerKey !== ownerKey) { sendJson(res, 404, { error: 'Not your buddy' }); return true }
      if (active && active !== target && !active.hatchedAt) { acc.buddyIds = acc.buddyIds.filter((id) => id !== active.id); delete store.buddies[active.id] }
      target.retiredAt = null; acc.activeBuddyId = target.id
      save(store); sendJson(res, 200, payload(store, ownerKey)); return true
    }
    if (p === '/api/buddy/wish/done' && req.method === 'POST') {
      if (!active?.hatchedAt) { sendJson(res, 409, { error: 'No Axie yet' }); return true }
      const w = ensureWish(active)
      if (w.done) { sendJson(res, 200, payload(store, ownerKey)); return true }
      const r = addBond(active, w.bonus)
      if (r.granted > 0) { w.done = true; active.firstsDone.push(w.id) }
      save(store); sendJson(res, 200, payload(store, ownerKey, { granted: r.granted, unlocks: r.unlocks, capped: r.granted === 0 })); return true
    }
    /**
     * The opposite of "keep it in the book": a photo the player does not want in the scrapbook.
     * The bond it already earned stays — the snap happened, and taking it back would turn a
     * change of mind about a picture into a punishment. `snapCount` is the true total and is
     * likewise untouched; only the picture and the moment card that points at it go.
     */
    if (p === '/api/buddy/photo/unkeep' && req.method === 'POST') {
      const photoId = String(body.photoId || '')
      const known = Boolean(photoId) && Boolean(active) && (active.photoIds.includes(photoId) || (active.photos || []).some((x) => x.id === photoId))
      // Someone else's photo, an unknown id, or no active buddy all answer the same way: this
      // route can only ever speak about the caller's own active Axie.
      if (!known) { sendJson(res, 404, { error: 'Photo not found' }); return true }
      active.photoIds = active.photoIds.filter((id) => id !== photoId)
      active.photos = (active.photos || []).filter((x) => x.id !== photoId)
      active.moments = active.moments.filter((m) => m.photoId !== photoId)
      active.unkeptCount = (active.unkeptCount || 0) + 1
      save(store)
      // The post and its upload belong to the host's store, not this one.
      if (typeof removePost === 'function') { try { await removePost(photoId) } catch { /* the buddy record is already clean */ } }
      sendJson(res, 200, payload(store, ownerKey)); return true
    }
    if (p === '/api/buddy/wear' && req.method === 'POST') {
      if (!active?.hatchedAt) { sendJson(res, 409, { error: 'No Axie yet' }); return true }
      const item = body.item == null ? null : String(body.item)
      if (item && !active.wardrobe.unlocked.includes(item)) { sendJson(res, 403, { error: 'Locked' }); return true }
      active.wardrobe.worn = item; save(store); sendJson(res, 200, payload(store, ownerKey)); return true
    }
    if (p === '/api/buddy/before' && req.method === 'GET') {
      if (!active?.hatchedAt) { sendJson(res, 200, { line: null }); return true }
      const beforeSlots = {}
      const thingParam = (url.searchParams.get('thing') || '').trim().slice(0, 40)
      const placeParam = (url.searchParams.get('place') || '').trim().slice(0, 40)
      if (thingParam) beforeSlots.thing = thingParam
      if (placeParam) beforeSlots.place = placeParam
      const line = say(active, 'before', beforeSlots)
      save(store); sendJson(res, 200, { line }); return true
    }
    if (p === '/api/buddy/talk' && req.method === 'POST') {
      if (!active?.hatchedAt) { sendJson(res, 409, { error: 'No Axie yet' }); return true }
      const raw = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      const text = raw.toLowerCase()
      if (!raw) { sendJson(res, 400, { error: 'Say something first' }); return true }
      let reply = null
      if (model.enabled) {
        const out = await model.ask({ system: characterBrief(active), user: talkPrompt(active, talkCtx(active, { hour: Number(url.searchParams.get('hour')) || undefined }), active.talkLog || [], raw), schema: REPLY_SCHEMA, maxTokens: 120 })
        reply = ruled(out?.reply)
        if (reply) heard(active, reply)
      }
      if (!reply) reply = libraryReply(active, text)
      active.talkLog = [...(active.talkLog || []), { you: raw, reply }].slice(-12)
      save(store); sendJson(res, 200, { reply }); return true
    }
    if (p === '/api/ronin/nonce' && req.method === 'GET') {
      const address = normalizeAddress(url.searchParams.get('address') || '')
      if (!address) { sendJson(res, 400, { error: 'address required' }); return true }
      // A nonce is a challenge, not an account: anyone can ask for one for any address, so this
      // route must never mint `ronin:<addr>`. The pending map is bounded on both axes.
      const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      const pending = (store.pendingNonces ||= {})
      const bucket = (pending[address] ||= {})
      bucket[nonce] = now()
      prunePendingNonces(pending, address)
      save(store); sendJson(res, 200, { nonce, message: signInMessage(address, nonce) }); return true
    }
    if (p === '/api/ronin/verify' && req.method === 'POST') {
      const address = normalizeAddress(String(body.address || ''))
      const pending = (store.pendingNonces ||= {})
      const bucket = address ? pending[address] : null
      const nonce = bucket && Object.keys(bucket).find((n) => now() - bucket[n] <= NONCE_TTL_MS && recoverAddress(signInMessage(address, n), String(body.signature || '')) === address)
      if (!address || !bucket || !nonce) { sendJson(res, 401, { error: 'Signature does not match' }); return true }
      delete bucket[nonce]
      if (!Object.keys(bucket).length) delete pending[address]
      // Only now, with a signature that actually recovers to this address, does the account exist.
      const verifyAcc = accountFor(store, `ronin:${address}`)
      verifyAcc.session = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
      const dk = deviceKeyFrom(req, body)
      if (dk) mergeAccounts(store, `device:${dk}`, verifyAcc.ownerKey)
      save(store); sendJson(res, 200, { session: verifyAcc.session, address }); return true
    }
    if (p === '/api/ronin/axies' && req.method === 'GET') {
      if (!ownerKey.startsWith('ronin:')) { sendJson(res, 401, { error: 'Sign in first' }); return true }
      const axies = env.BUDDY_TEST_SKIP_CHAIN === '1' ? [{ id: '6', name: 'Axie #6', class: 'Aquatic' }] : (await fetchAllOwnerAxies(ownerKey.slice(6))).map((a) => ({ id: a.id, name: a.name, class: a.class }))
      sendJson(res, 200, { axies }); return true
    }
    if (p === '/api/buddy/claim' && req.method === 'POST') {
      if (!ownerKey.startsWith('ronin:')) { sendJson(res, 401, { error: 'Sign in first' }); return true }
      const axieId = String(body.axieId || '').trim()
      if (!/^\d+$/.test(axieId)) { sendJson(res, 400, { error: 'axieId required' }); return true }
      let rec
      if (env.BUDDY_TEST_SKIP_CHAIN === '1') rec = { id: axieId, class: 'Aquatic', parts: [{ name: 'Tricky' }, { name: 'Catfish' }, { name: 'Clamshell' }, { name: 'Hero' }, { name: 'Iguana' }, { name: 'Ear Breathing' }], genes: '0x0' }
      else {
        const owned = await fetchAllOwnerAxies(ownerKey.slice(6))
        if (!owned.some((a) => String(a.id) === axieId)) { sendJson(res, 403, { error: 'Not in your wallet' }); return true }
        rec = await fetchAxieGenes(axieId)
      }
      if (!rec) { sendJson(res, 404, { error: 'Axie not found' }); return true }
      const existing = acc.buddyIds.map((id) => store.buddies[id]).find((b) => b?.kind === 'owned' && b.axieId === axieId)
      if (existing) { existing.retiredAt = null; acc.activeBuddyId = existing.id; save(store); sendJson(res, 200, payload(store, ownerKey)); return true }
      const b = newEgg(ownerKey)
      b.kind = 'owned'; b.axieId = axieId; b.class = rec.class || null; b.name = (rec.name && !/^Axie #\d+$/.test(rec.name) ? rec.name : `Axie #${axieId}`).slice(0, 16)
      b.traits = traitsForOwned(axieId, rec.class || '', (rec.parts || []).map((x) => x.name))
      b.hatchedAt = b.createdAt; b.mystic = (rec.parts || []).some((x) => x.specialGenes === 'Mystic'); b.rarity = b.mystic ? 0.03 : 0.5
      if (active && !active.hatchedAt) { acc.buddyIds = acc.buddyIds.filter((id) => id !== active.id); delete store.buddies[active.id] }
      store.buddies[b.id] = b; acc.buddyIds.push(b.id); acc.activeBuddyId = b.id
      addBondIgnoringCap(b, 5); ensureWish(b)
      save(store); sendJson(res, 201, payload(store, ownerKey, { lines: b.traits.map((t) => pickLine({ traits: [t], situation: 'hatch', rng })) })); return true
    }
    if (p === '/api/account/recovery' && req.method === 'POST') {
      if (!ownerKey.startsWith('device:')) { sendJson(res, 400, { error: 'Recovery codes are for guest accounts; your wallet already keeps your Axies' }); return true }
      acc.recoveryCode = recoveryCode()
      save(store); sendJson(res, 200, { code: acc.recoveryCode }); return true
    }
    if (p === '/api/account/recover' && req.method === 'POST') {
      const code = String(body.code || '').trim().toUpperCase()
      const from = Object.values(store.accounts).find((a) => a.recoveryCode && a.recoveryCode === code && a.ownerKey.startsWith('device:') && !store.usedRecoveryCodes[code])
      if (!from) { sendJson(res, 404, { error: 'Code not found' }); return true }
      if (from.ownerKey === ownerKey) { sendJson(res, 200, payload(store, ownerKey)); return true }
      store.usedRecoveryCodes[code] = now(); from.recoveryCode = null
      mergeAccounts(store, from.ownerKey, ownerKey)
      save(store); sendJson(res, 200, payload(store, ownerKey)); return true
    }
    if (p === '/api/ladder/monthly' && req.method === 'GET') {
      const key = monthKey()
      const rows = Object.values(store.buddies)
        .filter((b) => b.hatchedAt && !b.retiredAt && b.monthly.key === key && b.monthly.bond > 0)
        .sort((a, b) => b.monthly.bond - a.monthly.bond || Date.parse(a.hatchedAt) - Date.parse(b.hatchedAt))
        .map((b, i) => ({ rank: i + 1, buddyId: b.id, name: b.name, class: b.class, kind: b.kind, traits: b.traits, level: levelFor(b.bond), monthlyBond: b.monthly.bond, rarity: rarityFor(b) }))
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
      const mine = active ? rows.find((r) => r.buddyId === active.id) : null
      const tierAbove = mine ? rows.filter((r) => r.rank < mine.rank).at(-1) : null
      const you = mine ? { rank: mine.rank, monthlyBond: mine.monthlyBond, toNextTier: tierAbove ? tierAbove.monthlyBond - mine.monthlyBond + 1 : 0 } : null
      const [y, m] = key.split('-').map(Number)
      const endsAt = new Date(Date.UTC(y, m, 1) - 8 * 3600 * 1000).toISOString()
      sendJson(res, 200, { month: key, endsAt, rows: rows.slice(0, limit), you }); return true
    }
    if (p === '/api/buddy/diary' && req.method === 'GET') {
      if (!active) { sendJson(res, 200, { entries: [] }); return true }
      sendJson(res, 200, diaryFor(active)); return true
    }
    return false
  }
  function rarityFor(b) {
    if (b.kind === 'owned') return b.rarity ?? 0.5
    const score = 0.6 - b.rareIds.length * 0.2 - (b.mystic ? 0.3 : 0)
    return Math.max(0.02, Math.round(score * 100) / 100) // share of Axies at least this rare; lower is rarer
  }
  function diaryFor(b) {
    const dayLabel = (iso) => manilaDayKey(new Date(Date.parse(iso)))
    const entries = []
    const createdDay = dayLabel(b.createdAt)
    entries.push({ day: 1, dayKey: createdDay, title: 'Found', line: 'Someone picked me up. It was warm and bumpy. I think this is my person.', photoId: b.photoIds[0] || null })
    if (b.hatchedAt) entries.push({ day: Math.max(1, daysSince(b.createdAt) - daysSince(b.hatchedAt) + 1), dayKey: dayLabel(b.hatchedAt), title: 'Hatched', line: pickLine({ traits: b.traits, situation: 'hatch', recent: [], rng }), photoId: b.photoIds[b.egg.snaps] || null })
    for (const m of b.moments.slice(-3)) {
      const def = MOMENTS.find((x) => x.id === m.id)
      if (def) entries.push({ day: Math.max(1, daysSince(b.createdAt) - daysSince(m.at) + 1), dayKey: dayLabel(m.at), title: def.title, line: def.line, photoId: m.photoId })
    }
    const dayN = daysSince(b.createdAt)
    const anniversary = b.hatchedAt && daysSince(b.hatchedAt) === 6 ? 'Tomorrow: one week since you named me.' : null
    const next = b.hatchGrid ? 'I want to go back to where I hatched.' : pickLine({ traits: b.traits, situation: 'wish', recent: [], rng })
    return { week: Math.ceil(dayN / 7), entries: entries.slice(0, 5), anniversary, next }
  }
  function addBondIgnoringCap(b, amount) {
    const before = levelFor(b.bond); b.bond += amount; b.monthly = { key: monthKey(), bond: (b.monthly.key === monthKey() ? b.monthly.bond : 0) + amount }
    const after = levelFor(b.bond); const unlocks = []
    for (const row of LADDER) if (row.level > before && row.level <= after) { unlocks.push(row); if (row.unlock) b.wardrobe.unlocked.push(row.unlock) }
    earnTrait(b, before, after)
    return { unlocks }
  }
  const hoursSince = (iso) => (iso ? (now() - Date.parse(iso)) / 36e5 : 0)
  const daysSince = (iso) => Math.max(1, Math.floor(hoursSince(iso) / 24) + 1)

  return { handle, recordSnap, getActive, ownerKeyFrom, load, save, accountFor, publicBuddy, say, ensureWish, addBond }
}
