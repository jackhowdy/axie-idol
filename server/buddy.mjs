// One-Axie loop: egg, hatch, claim, snaps, wishes, moments, ladder, diary. Server is the authority.
import catalogueJson from './partCatalogue.json' with { type: 'json' }
import {
  LADDER, LEVEL_NAMES, levelFor, nextStep, eggOdds, rollWild, rollTraits, traitsForOwned,
  wishForToday, detectMoments, MOMENTS, hashInt,
} from './buddyRules.mjs'
import { pickLine } from './voiceLines.mjs'
import { signInMessage, recoverAddress } from './roninSig.mjs'

const NAME_RE = /^[\p{L}\p{N} '’-]{2,16}$/u
const BAD_WORDS = ['shit', 'fuck', 'cunt', 'nigg', 'fag', 'bitch', 'dick', 'porn', 'nazi']
const DAILY_CAP = 10
const PLACE_GRID_DEG = 0.003 // ~300 m
/** Scrapbook keeps the last N photo records (id + upload path); photoIds stays uncapped. */
const PHOTO_CAP = 60
/** Spells small counts in words so a talk reply never carries a digit (voice rule). */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const wordsFor = (n) => (n >= 0 && n < ONES.length ? ONES[n] : 'a lot of')

export function createBuddyModule({ storage, helpers, env = {}, catalogue = catalogueJson, now = () => Date.now(), rng = Math.random }) {
  const { sendJson, readBody, deviceKeyFrom, manilaDayKey, fetchAxieGenes, fetchAllOwnerAxies, normalizeAddress } = helpers
  const enabled = env.BUDDY !== '0'

  const emptyStore = () => ({ accounts: {}, buddies: {}, usedRecoveryCodes: {} })
  const load = () => storage.get('buddies', emptyStore)
  const save = (s) => storage.set('buddies', s)
  const monthKey = () => manilaDayKey().slice(0, 7)
  const uid = () => crypto.randomUUID()

  function accountFor(store, ownerKey) {
    return (store.accounts[ownerKey] ||= { ownerKey, activeBuddyId: null, buddyIds: [], recoveryCode: null, nonces: {} })
  }
  /** Session (Task 8) wins over device key. */
  function ownerKeyFrom(req, body, url) {
    const session = req.headers?.get?.('x-buddy-session') || url?.searchParams?.get('session')
    const addr = session ? verifySession(load(), session) : null
    if (addr) return `ronin:${addr}`
    const dk = deviceKeyFrom(req, body || {})
    return dk ? `device:${dk}` : null
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

  function newEgg(ownerKey) {
    return {
      id: uid(), ownerKey, kind: 'wild', axieId: null, class: null, descriptor: null,
      name: '', traits: [], earnedTrait: null, createdAt: new Date(now()).toISOString(), hatchedAt: null, retiredAt: null,
      egg: { snaps: 0, grids: [], distanceKm: 0, foodSnaps: 0, lastLatLng: null },
      bond: 0, bondByDay: {}, monthly: { key: monthKey(), bond: 0 },
      wish: { day: null, id: null, text: '', bonus: 1, done: false }, firstsDone: [],
      wardrobe: { unlocked: [], worn: null }, moments: [], places: {},
      photoIds: [], photos: [], snapCount: 0, lastSnapAt: null, recentLines: [], hatchGrid: null, rareIds: [], mysticId: null, mystic: false,
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
      eggOdds: b.hatchedAt ? null : eggOdds(b.egg.snaps, b.egg.grids.length),
      momentsTotal: MOMENTS.length, ladder: LADDER, bondToday: b.bondByDay[manilaDayKey()] || 0, dailyCap: DAILY_CAP,
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
  function getActive(ownerKey) {
    const store = load(); const acc = store.accounts[ownerKey]
    return acc ? store.buddies[acc.activeBuddyId] || null : null
  }

  function say(b, situation, slots = {}) {
    const line = pickLine({ traits: b.traits, situation, slots, recent: b.recentLines, rng })
    b.recentLines = [...b.recentLines.filter((l) => l !== line), line].slice(-60)
    return line
  }

  /** A memory sentence built from the buddy's own records (`places`, `moments`, `hatchedAt`) — never a digit. */
  function memoryLine(b) {
    const placeCount = Object.keys(b.places || {}).length
    if (!placeCount || rng() < 0.5) return 'This is where I came out. It looked bigger from inside.'
    return `We went to ${wordsFor(placeCount)} places. The first one was warm.`
  }

  function validName(raw) {
    const name = String(raw || '').trim().replace(/\s+/g, ' ')
    if (!NAME_RE.test(name)) return null
    const low = name.toLowerCase().replace(/[^a-z]/g, '')
    if (BAD_WORDS.some((w) => low.includes(w))) return null
    return name
  }

  function addBond(b, amount) {
    const day = manilaDayKey()
    const today = b.bondByDay[day] || 0
    const room = Math.max(0, DAILY_CAP - today)
    const granted = Math.min(room, amount)
    if (granted <= 0) return { granted: 0, unlocks: [] }
    const before = levelFor(b.bond)
    b.bond += granted
    b.bondByDay[day] = today + granted
    if (b.monthly.key !== monthKey()) b.monthly = { key: monthKey(), bond: 0 }
    b.monthly.bond += granted
    const after = levelFor(b.bond)
    const unlocks = []
    for (const row of LADDER) if (row.level > before && row.level <= after) { unlocks.push(row); if (row.unlock && !b.wardrobe.unlocked.includes(row.unlock)) b.wardrobe.unlocked.push(row.unlock) }
    return { granted, unlocks }
  }

  /** Called by core after a post is stored. Returns the snap result for the client or null. */
  function recordSnap(post, ctx) {
    if (!enabled || !ctx.buddy) return null
    const store = load()
    const b = getActive(ctx.ownerKey)
    if (!b || b.retiredAt) return null
    const grid = gridOf(ctx.lat, ctx.lng)
    const hour = Number(ctx.hour ?? new Date(now()).getUTCHours() + 8) % 24
    const labels = Array.isArray(ctx.labels) ? ctx.labels.slice(0, 12).map(String) : []
    b.photoIds.push(post.id); b.snapCount += 1; b.lastSnapAt = new Date(now()).toISOString()
    // `photoIds` are post ids; /api/image/<id> serves marketplace art, so the scrapbook needs the
    // stored upload path too. Kept alongside photoIds (never instead of it) and capped at the last 60.
    b.photos = [...(b.photos || []), { id: post.id, imagePath: post.imagePath || '', at: b.lastSnapAt }].slice(-PHOTO_CAP)
    const isNewPlace = Boolean(grid && !b.places[grid])
    if (grid) { const p = (b.places[grid] ||= { first: b.lastSnapAt, count: 0, district: ctx.district || null }); p.count += 1 }

    if (!b.hatchedAt) {
      const e = b.egg
      const day = manilaDayKey(); const today = b.bondByDay[day] || 0
      if (today < DAILY_CAP) { e.snaps += 1; b.bondByDay[day] = today + 1 }
      if (grid && !e.grids.includes(grid)) e.grids.push(grid)
      if (typeof ctx.lat === 'number' && typeof ctx.lng === 'number') {
        if (e.lastLatLng) e.distanceKm += kmBetween(e.lastLatLng, { lat: ctx.lat, lng: ctx.lng })
        e.lastLatLng = { lat: ctx.lat, lng: ctx.lng }
      }
      if (labels.some((l) => /noodle|food|tart|bun|rice|coffee|tea|cake/i.test(l))) e.foodSnaps += 1
      save(store)
      return { kind: 'egg', snaps: e.snaps, odds: eggOdds(e.snaps, e.grids.length), canHatch: e.snaps >= 5 }
    }

    const { granted, unlocks } = addBond(b, 1)
    let wishDone = null
    if (b.wish.day === manilaDayKey() && !b.wish.done && wishMatches(b.wish.id, { hour, weather: ctx.weather, placeType: ctx.placeType, labels, isNewPlace })) {
      b.wish.done = true; b.firstsDone.push(b.wish.id); wishDone = b.wish
      const w = addBond(b, b.wish.bonus); unlocks.push(...w.unlocks)
    }
    const districtsToday = new Set(Object.values(b.places).filter((p) => p.district && p.count).map((p) => p.district)).size
    const found = detectMoments({ hour, weather: ctx.weather, placeType: ctx.placeType, labels, isNewPlace, isNewDistrict: Boolean(ctx.district), districtsToday, snapCount: b.snapCount, hatchGrid: b.hatchGrid, grid }, b.moments.map((m) => m.id))
    for (const id of found) { b.moments.push({ id, at: b.lastSnapAt, photoId: post.id }); const m = addBond(b, 2); unlocks.push(...m.unlocks) }
    const thing = labels[0] || (ctx.placeType ? `the ${ctx.placeType}` : 'that')
    const line = say(b, 'after', { thing, place: ctx.placeName || ctx.placeType || 'here' })
    const momentLines = found.map((id) => MOMENTS.find((m) => m.id === id)).filter(Boolean)
    save(store)
    return {
      kind: 'snap', granted, bond: b.bond, level: levelFor(b.bond), next: nextStep(b.bond), line, labels, isNewPlace,
      wishDone, unlocks: unlocks.map((u) => ({ level: u.level, reward: u.reward, unlock: u.unlock, line: say(b, 'big') })),
      moments: momentLines.map((m) => ({ ...m, rarity: m.rarityHint })), bondToday: b.bondByDay[manilaDayKey()] || 0, dailyCap: DAILY_CAP,
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

  async function handle(req, res, url) {
    if (!enabled || !/^\/api\/(buddy|ronin|ladder|account)\b/.test(url.pathname)) return false
    let body = {}
    if (req.method === 'POST') { try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { sendJson(res, 400, { error: 'Invalid JSON' }); return true } }
    const ownerKey = ownerKeyFrom(req, body, url)
    if (!ownerKey) { sendJson(res, 400, { error: 'Missing X-Device-Key' }); return true }
    const store = load()
    const acc = accountFor(store, ownerKey)
    const active = store.buddies[acc.activeBuddyId] || null
    const p = url.pathname

    if (p === '/api/buddy' && req.method === 'GET') {
      if (active?.hatchedAt) { ensureWish(active, { weather: url.searchParams.get('weather'), hour: url.searchParams.get('hour') }); save(store) }
      const greeting = active?.hatchedAt ? say(active, hoursSince(active.lastSnapAt) >= 48 ? 'return' : 'morning', { count: daysSince(active.hatchedAt), days: Math.floor(hoursSince(active.lastSnapAt) / 24), weather: url.searchParams.get('weather') || 'fine' }) : null
      if (greeting) save(store)
      sendJson(res, 200, payload(store, ownerKey, { greeting })); return true
    }
    if (p === '/api/buddy/egg' && req.method === 'POST') {
      if (active && !active.retiredAt && !active.hatchedAt) { sendJson(res, 200, payload(store, ownerKey)); return true }
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
      w.done = true; active.firstsDone.push(w.id); const r = addBond(active, w.bonus)
      save(store); sendJson(res, 200, payload(store, ownerKey, { granted: r.granted, unlocks: r.unlocks })); return true
    }
    if (p === '/api/buddy/wear' && req.method === 'POST') {
      if (!active?.hatchedAt) { sendJson(res, 409, { error: 'No Axie yet' }); return true }
      const item = body.item == null ? null : String(body.item)
      if (item && !active.wardrobe.unlocked.includes(item)) { sendJson(res, 403, { error: 'Locked' }); return true }
      active.wardrobe.worn = item; save(store); sendJson(res, 200, payload(store, ownerKey)); return true
    }
    if (p === '/api/buddy/before' && req.method === 'GET') {
      if (!active?.hatchedAt) { sendJson(res, 200, { line: null }); return true }
      const line = say(active, 'before', { thing: url.searchParams.get('thing') || 'the whole street', place: url.searchParams.get('place') || 'here' })
      save(store); sendJson(res, 200, { line }); return true
    }
    if (p === '/api/buddy/talk' && req.method === 'POST') {
      if (!active?.hatchedAt) { sendJson(res, 409, { error: 'No Axie yet' }); return true }
      const text = String(body.text || '').slice(0, 200).toLowerCase()
      let reply
      if (/sad|tired|rough|bad day|lonely/.test(text)) reply = say(active, 'talk-warm')
      else if (/remember|hatch|first|where|place|park|noodle/.test(text)) reply = memoryLine(active)
      else if (text.includes('?')) reply = say(active, 'talk-curious')
      else reply = say(active, 'talk', { thing: 'the sky' })
      save(store); sendJson(res, 200, { reply }); return true
    }
    if (p === '/api/ronin/nonce' && req.method === 'GET') {
      const address = normalizeAddress(url.searchParams.get('address') || '')
      if (!address) { sendJson(res, 400, { error: 'address required' }); return true }
      const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      const nonceAcc = accountFor(store, `ronin:${address}`)
      nonceAcc.nonces[nonce] = now(); for (const k of Object.keys(nonceAcc.nonces)) if (now() - nonceAcc.nonces[k] > 10 * 60_000) delete nonceAcc.nonces[k]
      save(store); sendJson(res, 200, { nonce, message: signInMessage(address, nonce) }); return true
    }
    if (p === '/api/ronin/verify' && req.method === 'POST') {
      const address = normalizeAddress(String(body.address || ''))
      const verifyAcc = address ? store.accounts[`ronin:${address}`] : null
      const nonce = verifyAcc && Object.keys(verifyAcc.nonces).find((n) => now() - verifyAcc.nonces[n] <= 10 * 60_000 && recoverAddress(signInMessage(address, n), String(body.signature || '')) === address)
      if (!address || !verifyAcc || !nonce) { sendJson(res, 401, { error: 'Signature does not match' }); return true }
      delete verifyAcc.nonces[nonce]
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
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const chunk = () => Array.from({ length: 4 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('')
      acc.recoveryCode = `${chunk()}-${chunk()}-${chunk()}`
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
    return { unlocks }
  }
  const hoursSince = (iso) => (iso ? (now() - Date.parse(iso)) / 36e5 : 0)
  const daysSince = (iso) => Math.max(1, Math.floor(hoursSince(iso) / 24) + 1)

  return { handle, recordSnap, getActive, ownerKeyFrom, load, save, accountFor, publicBuddy, say, ensureWish, addBond }
}
