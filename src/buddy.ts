// src/buddy.ts
import type { AxieDescriptor } from '@jaatster/threejs-axie-mixer3d-public'

export const buddyEnabled = import.meta.env.VITE_BUDDY === '1'
/** Talk mode (typed chat) is off for R1: the Axie speaks after photos. VITE_TALK=1 brings the screen back. */
export const talkEnabled = import.meta.env.VITE_TALK === '1'
/** Eggs (hatch your own) are off in Round 1: every Axie is a real one. VITE_EGGS=1 brings them back. */
export const eggsEnabled = import.meta.env.VITE_EGGS === '1'
/** Ronin sign-in and "bring your own Axie". Off for the first prototype; `VITE_RONIN=1` turns it on. */
export const roninEnabled = import.meta.env.VITE_RONIN === '1'
const SESSION_LS = 'axieIdol.buddySession'
const ADDRESS_LS = 'axieIdol.buddyAddress'

/** localStorage can throw (private browsing, some in-app browsers incl. Ronin Wallet's) — never let a read/write crash the module. */
export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export type Buddy = {
  id: string
  /** wild = hatched here; owned = proven with a Ronin signature; visit = a real Axie played by its number. */
  kind: 'wild' | 'owned' | 'visit'
  axieId: string | null
  class: string | null
  descriptor: AxieDescriptor | null
  name: string
  traits: string[]
  /** The fourth trait, earned at bond level 10 from how the Axie was actually played. */
  earnedTrait: string | null
  createdAt: string
  hatchedAt: string | null
  retiredAt: string | null
  egg: { snaps: number; grids: string[] }
  eggOdds: { tier: number; rareParts: number; mysticChance: number; nextTier: number | null } | null
  bond: number
  level: number
  levelName: string | null
  next: { level: number; bond: number; reward: string; remaining: number } | null
  wish: { id: string | null; text: string; bonus: number; done: boolean }
  wardrobe: { unlocked: string[]; worn: string | null }
  moments: { id: string; at: string; photoId: string }[]
  momentsTotal: number
  photoIds: string[]
  /** Post id + the stored upload path, newest last, capped server-side at 60. Real scrapbook thumbnails. */
  photos: { id: string; imagePath: string; at: string }[]
  snapCount: number
  /** Photos still in the book: counted snaps minus the ones the owner chose not to keep. */
  photoCount?: number
  bondToday: number
  /** Photos counted today; only the first `dailyCap` of a day count for bond. */
  snapsToday: number
  dailyCap: number
  streak: number
  ladder: { level: number; bond: number; reward: string; unlock: string | null }[]
  mystic: boolean
  mysticId: string | null
  rareIds: string[]
  /** The game: how happy it is right now (time alone wears it down), and the joy days so far. */
  happy?: Happy | null
  joy?: Joy
  /** The name on chain, when it has one, whatever nickname it goes by here. */
  realName?: string | null
  /** A real Axie's facts from Sky Mavis. */
  core?: {
    level: number | null; birthYear: number | null; breedCount: number | null
    /** Rookie, Trained, Veteran or Master, from its Axie Core level. */
    rank?: string | null
    /** How many of its six parts have evolved (stage two), and which special genes it carries. */
    evolved?: number; special?: string[]
    parts: { type: string; name: string; class: string | null; special: string | null; stage?: number }[]
  } | null
  /** What its class loves ("water", "small things"): a photo with some is worth more happiness. */
  loves?: string | null
  /** Today is its real birthday on Ronin. */
  birthday?: boolean
}
/** Stardom: joy days, the live streak, and the title that streak holds (for as long as it lasts). */
export type Joy = {
  days: number; streak: number; best: number
  title?: { id: 'newcomer' | 'rising' | 'star' | 'idol'; name: string }
  shining?: boolean
  /** What a joy day is worth in bond at this title: a star's is worth more than a newcomer's. */
  joyBonus?: number
  /** The best title it ever held, when the streak that held it has ended: what there is to win back. */
  fallen?: string | null
  next?: { id: string; name: string; needStreak: number; haveStreak: number } | null
}
export type Happy = { value: number; mood: string; moodId: string; talksLeft: number; petsLeft: number; treatsLeft?: number; playsLeft?: number; overjoyedToday: boolean }
/** What one action did to its happiness. `overjoyed` is the win: the first time in a day it gets there. */
export type HappyChange = { delta: number; value: number; mood: string; reasons: string[]; overjoyed: boolean; joyBonus: number; joyStreak: number; joy?: Joy; newTitle?: { id: string; name: string; line: string } | null }
export type SnapResult =
  | { kind: 'egg'; snaps: number; odds: Buddy['eggOdds']; canHatch: boolean }
  | {
      kind: 'snap'
      granted: number
      bond: number
      level: number
      next: Buddy['next']
      line: string
      labels: string[]
      isNewPlace: boolean
      happy?: HappyChange
      wishDone: Buddy['wish'] | null
      unlocks: { level: number; reward: string; unlock: string | null; line: string }[]
      moments: { id: string; title: string; line: string; rarity: number }[]
      bondToday: number
      snapsToday: number
      dailyCap: number
    }

export const buddyState = {
  active: null as Buddy | null,
  buddies: [] as Buddy[],
  greeting: null as string | null,
  session: lsGet(SESSION_LS),
  address: lsGet(ADDRESS_LS),
}

let deviceKeyProvider: () => string = () => ''
export function bindDeviceKey(fn: () => string): void { deviceKeyProvider = fn }

export function buddyHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'X-Device-Key': deviceKeyProvider() }
  if (buddyState.session) h['X-Buddy-Session'] = buddyState.session
  return h
}

async function call<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(path, { method, headers: buddyHeaders(), body: body === undefined ? undefined : JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `${path} ${res.status}`)
  return data
}
type Payload = { active: Buddy | null; buddies: Buddy[]; greeting?: string | null; lines?: string[] }
function apply(p: Payload): void { buddyState.active = p.active; buddyState.buddies = p.buddies; if ('greeting' in p) buddyState.greeting = p.greeting ?? null }

export async function loadBuddy(): Promise<void> { apply(await call<Payload>(`/api/buddy?hour=${new Date().getHours()}`)) }
export async function startEgg(): Promise<void> { apply(await call<Payload>('/api/buddy/egg', {})) }
export async function hatch(name: string): Promise<{ lines: string[] }> { const p = await call<Payload>('/api/buddy/hatch', { name }); apply(p); return { lines: p.lines || [] } }
export async function retire(): Promise<void> { apply(await call<Payload>('/api/buddy/retire', {})) }
export async function switchTo(buddyId: string): Promise<void> { apply(await call<Payload>('/api/buddy/switch', { buddyId })) }
export async function wear(item: string | null): Promise<void> { apply(await call<Payload>('/api/buddy/wear', { item })) }
export async function wishDone(): Promise<void> { apply(await call<Payload>('/api/buddy/wish/done', {})) }
/** A pat on the head: a line back, and a little happiness (five times a day). */
export async function pet(): Promise<{ line: string; happy: HappyChange }> { const p = await call<Payload & { line: string; happy: HappyChange }>('/api/buddy/pet', {}); apply(p); return { line: p.line, happy: p.happy } }
/** A treat from the jar: twice a day. */
export async function treat(): Promise<{ line: string; happy: HappyChange }> { const p = await call<Payload & { line: string; happy: HappyChange }>('/api/buddy/treat', {}); apply(p); return { line: p.line, happy: p.happy } }
/** The catching game is played on the phone; the server hears how many stars were caught. */
export async function playResult(catches: number): Promise<{ line: string; happy: HappyChange; catches: number; rounds: number; counted: boolean }> {
  const p = await call<Payload & { line: string; happy: HappyChange; catches: number; rounds: number; counted: boolean }>('/api/buddy/play', { catches }); apply(p)
  return { line: p.line, happy: p.happy, catches: p.catches, rounds: p.rounds, counted: p.counted }
}
/** Play as any real Axie by its number. No wallet: it is a visit until a Ronin sign-in proves it is yours. */
export async function visitAxie(axieId: string, nickname?: string): Promise<{ lines: string[] }> { const p = await call<Payload>('/api/buddy/visit', nickname ? { axieId, nickname } : { axieId }); apply(p); return { lines: p.lines || [] } }
export type MeetCard = { id: string; name: string; class: string | null; level: number | null; image: string; rank?: string | null; evolved?: number; special?: string[]; loves?: string | null; players?: number }
/** Fame belongs to the Axie: everyone who plays this Axie number adds to the same name. */
export type Fame = { axieId: string; players: number; joyDays: number; photos: number; bestStreak: number; titles: { idol: number; star: number; rising: number }; names: string[] }
export async function axieFame(axieId?: string): Promise<Fame> { return call<Fame>(`/api/buddy/fame${axieId ? `?axieId=${encodeURIComponent(axieId)}` : ''}`) }
/** Three real Axies to choose from; a new call is a new three. */
export async function meetCards(): Promise<MeetCard[]> { return (await call<{ cards: MeetCard[] }>('/api/buddy/meet')).cards }
/** What you call a real Axie, on top of its name on chain. */
export async function nickname(name: string): Promise<void> { apply(await call<Payload>('/api/buddy/nickname', { name })) }
/** The opposite of keeping it: drops the photo from the scrapbook and the feed. Bond already earned stays. */
export async function unkeepPhoto(photoId: string): Promise<void> { apply(await call<Payload>('/api/buddy/photo/unkeep', { photoId })) }
export async function beforeLine(ctx: { thing?: string; place?: string }): Promise<string | null> {
  const q = new URLSearchParams(); if (ctx.thing) q.set('thing', ctx.thing); if (ctx.place) q.set('place', ctx.place)
  return (await call<{ line: string | null }>(`/api/buddy/before?${q}`)).line
}

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
function provider(): Eip1193 | null {
  const w = window as Window & { ronin?: { provider?: Eip1193 }; ethereum?: Eip1193 }
  return w.ronin?.provider || w.ethereum || null
}
export async function roninSignIn(): Promise<string> {
  const p = provider()
  if (!p) throw new Error('Open this page in the Ronin Wallet browser, or install the Ronin extension')
  const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
  const address = accounts[0]?.toLowerCase()
  if (!address) throw new Error('No account')
  const { message } = await call<{ message: string }>(`/api/ronin/nonce?address=${address}`)
  const signature = (await p.request({ method: 'personal_sign', params: [message, address] })) as string
  const v = await call<{ session: string; address: string }>('/api/ronin/verify', { address, signature })
  buddyState.session = v.session; buddyState.address = v.address
  lsSet(SESSION_LS, v.session); lsSet(ADDRESS_LS, v.address)
  await loadBuddy()
  return v.address
}
export async function ownedAxies(): Promise<{ id: string; name: string; class: string | null }[]> { return (await call<{ axies: { id: string; name: string; class: string | null }[] }>('/api/ronin/axies')).axies }
export async function claim(axieId: string): Promise<{ lines: string[] }> { const p = await call<Payload>('/api/buddy/claim', { axieId }); apply(p); return { lines: p.lines || [] } }
export async function issueRecovery(): Promise<string> { return (await call<{ code: string }>('/api/account/recovery', {})).code }
export async function redeemRecovery(code: string): Promise<void> { apply(await call<Payload>('/api/account/recover', { code })) }

/** Location once per snap; never blocks the shutter. placeType/district are reserved for a later task and never set here. */
export async function snapContext(): Promise<{ lat?: number; lng?: number; hour: number; placeType?: string; district?: string }> {
  const hour = new Date().getHours()
  if (!('geolocation' in navigator)) return { hour }
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve({ hour }), 2500)
    navigator.geolocation.getCurrentPosition(
      (pos) => { window.clearTimeout(t); resolve({ hour, lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => { window.clearTimeout(t); resolve({ hour }) },
      { maximumAge: 60_000, timeout: 2000 },
    )
  })
}

export function faceIdForBuddy(): 'buddy' | 'egg' { return buddyState.active?.hatchedAt ? 'buddy' : 'egg' }
