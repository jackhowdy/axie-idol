/**
 * Pure HTML renderers for the one-Axie loop (egg, hatch, home, claim, ladder,
 * idol ladder, diary, and the after-the-shot cards).
 *
 * Nothing in here touches the network, the DOM or `import.meta.env` — every
 * function is a string in, string out, so the unit test can import this module
 * under plain Node (`node --experimental-strip-types`). The API calls and the
 * event wiring live in `src/buddyScreens.ts`.
 *
 * Layout follows design/buddy/*.dc.html; classes are prefixed `bd-`.
 */
import type { Buddy, SnapResult } from './buddy'
// Explicit .ts extension so `node --experimental-strip-types` can resolve it in the
// unit test (Node does not guess extensions); Vite and tsc both accept it.
import { icon } from './icons.ts'

type Snap = Extract<SnapResult, { kind: 'snap' }>
export type Moment = Snap['moments'][number]
export type Unlock = Snap['unlocks'][number]
export type OwnedAxie = { id: string; name: string; class: string | null }
export type MonthlyRow = {
  rank: number; buddyId: string; name: string; class: string | null
  kind: 'wild' | 'owned'; traits: string[]; level: number; monthlyBond: number; rarity: number
}
export type Monthly = {
  month: string; endsAt: string; rows: MonthlyRow[]
  you: { rank: number; monthlyBond: number; toNextTier: number } | null
}
export type DiaryEntry = { day: number; dayKey: string; title: string; line: string; photoId: string | null }
export type Diary = { week: number; entries: DiaryEntry[]; anniversary: string | null; next: string }
export type TalkExchange = { you: string; reply: string }

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
/** Every name, line, label and id that reaches the markup goes through this. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
export const pct = (n: number): number => Math.max(0, Math.min(100, Math.round((Number.isFinite(n) ? n : 0) * 100)))
/**
 * Day 1 is the day the egg was found, counted in calendar days on the phone's clock: an egg found
 * at nine in the evening is on day two the next morning, like the wish is. (Counting whole
 * twenty-four-hour spans kept it on "Day 1" until nine the next evening.)
 */
export function dayCount(b: Pick<Buddy, 'createdAt' | 'hatchedAt'>, now: number = Date.now()): number {
  const from = Date.parse(b.createdAt || b.hatchedAt || new Date(now).toISOString())
  if (Number.isNaN(from)) return 1
  const start = new Date(from)
  const today = new Date(now)
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const b2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(1, Math.round((b2 - a) / 864e5) + 1)
}

/**
 * A friendly title for every bond level. The server only names three of them
 * (`LEVEL_NAMES` in server/buddyRules.mjs: 3, 7 and 10), and without the rest the Home hero
 * printed "Bond 1" twice — once on the badge, once as the title. Server value wins when set.
 */
const LEVEL_TITLES: Record<number, string> = {
  1: 'Just hatched',
  2: 'Getting to know you',
  3: 'Good friends',
  4: 'Buddies',
  5: 'Close',
  6: 'Inseparable',
  7: 'Best friends',
  8: 'Legends',
  9: 'Famous',
  10: 'Idol',
}
export function levelTitle(b: Pick<Buddy, 'level' | 'levelName'>): string {
  return b.levelName || LEVEL_TITLES[b.level] || `Bond ${b.level}`
}

/**
 * Axies that are not the active one: set aside by "Start a fresh egg", or replaced by a wallet
 * claim. They stayed in `buddyState.buddies` with no screen offering a way back, so a retired
 * Axie was unreachable — this row is that way back. The server un-retires on switch.
 *
 * Only hatched buddies show: an abandoned egg has no name, no class and nothing to come back to.
 */
export function restingRowHtml(buddies: Buddy[], activeId: string | null): string {
  const resting = (buddies || []).filter((b) => b && b.hatchedAt && b.id !== activeId)
  if (!resting.length) return ''
  const chips = resting.map((b) => `<button type="button" class="bd-rest" data-action="switch" data-id="${esc(b.id)}">
      <span class="bd-rest-art bd-class-${esc(String(b.class || 'wild').toLowerCase())}"></span>
      <span class="bd-hero-text"><b>${esc(b.name || 'Axie')}</b><span class="bd-muted">${esc(b.class || 'Wild')} · Bond ${b.level}</span></span>
      <span class="bd-pill bd-pill-ok">Come back</span>
    </button>`).join('')
  return `
      <div class="bd-card-head"><span class="bd-label">Resting · ${resting.length}</span><span class="bd-link">Tap one to switch</span></div>
      <div class="bd-rests">${chips}</div>`
}

export function chipHtml(label: string, kind: 'plain' | 'rare' | 'mystic' | 'earned' = 'plain'): string {
  const cls = kind === 'rare' ? ' bd-chip-rare' : kind === 'mystic' ? ' bd-chip-mystic' : kind === 'earned' ? ' bd-chip-earned' : ''
  const mark = kind === 'plain' ? '' : icon('star', 10)
  // The earned fourth trait carries its own little marker: it was played for, not rolled.
  const tail = kind === 'earned' ? '<i class="bd-chip-mark">earned</i>' : ''
  return `<span class="bd-chip${cls}">${mark}${esc(label)}${tail}</span>`
}

/**
 * Compact buddy chip for the camera HUD (`#bd-chip`): egg progress before hatching,
 * bond progress after. Named `vfChipHtml` because `chipHtml` above is the part/trait chip.
 */
export function vfChipHtml(b: Buddy): string {
  if (!b.hatchedAt) {
    // Past 100 snaps the odds top out and there is no next tier — "120 of 100" would be nonsense,
    // so the chip just counts.
    const target = b.eggOdds ? b.eggOdds.nextTier : 100
    if (target == null) return `<b>Egg · ${b.egg.snaps} snaps</b><div class="bd-meter mini"><i style="width:100%"></i></div>`
    return `<b>Egg · ${b.egg.snaps} of ${target}</b><div class="bd-meter mini"><i style="width:${pct(b.egg.snaps / Math.max(1, target))}%"></i></div>`
  }
  const floorBond = b.ladder.find((r) => r.level === b.level)?.bond ?? 0
  const width = b.next ? pct((b.bond - floorBond) / Math.max(1, b.next.bond - floorBond)) : 100
  return `<b>${esc(b.name)} · Bond ${b.level}</b><div class="bd-meter mini"><i style="width:${width}%"></i></div>`
}

/**
 * Today's wish. `interactive: false` (the camera HUD) drops the tap-to-complete button:
 * the delegated handler only runs inside `.buddy` / `#buddy-sheet`, and marking a wish
 * done mid-shot would navigate away from the viewfinder.
 */
export function wishPillHtml(b: Buddy, opts: { interactive?: boolean; compact?: boolean } = {}): string {
  if (!b.wish.id) return ''
  const done = b.wish.done
  const tappable = !done && opts.interactive !== false
  const tag = tappable ? 'button' : 'div'
  const extra = tappable ? ' type="button" data-action="wish-done"' : ''
  // compact: the bubble above already says the wish in the Axie's words, so the row is only the
  // action and the bonus, not the wish text a second time
  const text = opts.compact
    ? `${done ? 'Wish done today' : 'Today\'s wish'}<small>${done ? 'It came true' : 'Tap when you have it'}</small>`
    : `${esc(b.wish.text)}<small>${done ? 'Done today' : "Today's wish · tap when you have it"}</small>`
  return `<${tag} class="bd-row bd-wish${done ? ' done' : ''}"${extra}>
    <span class="bd-wish-dot">${icon(done ? 'star' : 'heart', 15)}</span>
    <span class="bd-wish-text">${text}</span>
    <b class="${done ? 'bd-ok' : 'bd-hot'}">+${b.wish.bonus} bond</b>
  </${tag}>`
}

/**
 * The egg's voice: one small line per photo taken with it, so the five silent photos before the
 * hatch are not silent. Keyed by how many photos it has had; past five it rotates.
 */
const EGG_LINES = [
  "It's quiet in there. Take it somewhere.",
  'Something moved in there.',
  "It's warmer than it was.",
  'A tap. From inside.',
  'It rocked. Did you see that?',
  "It's ready. Any time you like.",
]
const EGG_LINES_LATER = ['Still warm. Still waiting for the right place.', 'It likes it here. Keep going.', 'A bigger tap that time.']
export function eggLine(snaps: number): string {
  const n = Math.max(0, Math.floor(snaps))
  if (n < EGG_LINES.length) return EGG_LINES[n]
  return EGG_LINES_LATER[(n - EGG_LINES.length) % EGG_LINES_LATER.length]
}

const EGG_TIERS = [
  { at: 5, text: 'Common Axie, random class' },
  { at: 20, text: 'One rare part guaranteed' },
  { at: 50, text: 'Two rare parts · 5% Mystic chance' },
  { at: 100, text: '15% Mystic chance · keepsake shell' },
]

/** `buddies` is the whole roster from the server — only used for the "Resting Axies" row. */
export function eggHtml(b: Buddy, opts: { buddies?: Buddy[] } = {}): string {
  const snaps = b.egg.snaps
  const places = b.egg.grids.length
  const nextTier = b.eggOdds?.nextTier ?? null
  const rows = EGG_TIERS.map((t) => {
    const reached = snaps >= t.at
    const isNext = nextTier === t.at
    const right = reached
      ? '<span class="bd-pill bd-pill-ok">Reached</span>'
      : isNext
        ? `<b class="bd-hot">${t.at - snaps} to go</b>`
        : `<span class="bd-muted">${t.at} snaps</span>`
    return `<div class="bd-row bd-tier-row${isNext ? ' bd-row-next' : ''}"><b class="bd-tier${reached ? ' bd-ok' : ''}">${t.at}</b><span>${t.text}</span>${right}</div>`
  }).join('')
  const canHatch = snaps >= 5
  const left = Math.max(0, 5 - snaps)
  const leftWord = ['', 'One', 'Two', 'Three', 'Four', 'Five'][left] || String(left)
  const stage = snaps >= 20 ? 3 : snaps >= 5 ? 2 : 1
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <span class="bd-round bd-round-ghost"></span>
        <div class="bd-center bd-grow">
        <p class="bd-eyebrow">Day ${dayCount(b)} · your egg</p>
        <h1>${canHatch ? 'Ready when you are' : snaps === 0 ? 'You found an egg' : 'Keep taking it places'}</h1>
        <p class="bd-muted">${canHatch
          ? 'Hatch now, or keep taking it places. The longer it incubates, the rarer the Axie inside.'
          : snaps === 0
            ? 'Take it places. After five photos together it hatches into an Axie nobody else has.'
            : `${leftWord} more ${left === 1 ? 'photo' : 'photos'} together and it hatches into an Axie nobody else has.`}</p>
        </div>
        <button type="button" class="bd-pill bd-pill-btn" data-action="account" aria-label="Profile">${icon('user', 14)} Profile</button>
      </header>
      <div class="bd-egg-tile">
        <div class="bd-egg stage-${stage}"></div>
        <span class="bd-badge">${icon('star', 11)} Wild egg</span>
        <span class="bd-pill bd-pill-light">${snaps} ${snaps === 1 ? 'snap' : 'snaps'} · ${places} ${places === 1 ? 'place' : 'places'}</span>
      </div>
      <div class="bd-speech bd-speech-home bd-speech-egg">${esc(eggLine(snaps))}</div>
      <div class="bd-card">
        <div class="bd-card-head"><span class="bd-label">Odds if you hatch</span><span class="bd-link">Every ten snaps counts</span></div>
        ${rows}
        <div class="bd-meter"><i style="width:${Math.min(100, snaps)}%"></i></div>
        <p class="bd-small">Odds max out at 100. New places nudge them up. Every egg photo counts as bond once it hatches, so waiting is never wasted.</p>
      </div>${restingRowHtml(opts.buddies || [], b.id)}
    </div>
    <div class="bd-actions">
      ${canHatch ? '<button type="button" class="bd-btn bd-btn-outline" data-action="hatch-now">Hatch now</button>' : ''}
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} ${canHatch ? 'Keep snapping' : snaps === 0 ? 'Take the first photo' : 'Take another photo'}</button>
    </div>
    <p class="bd-small bd-center">Own an Axie on Ronin? <a class="bd-link" data-action="claim">Connect wallet and skip the egg</a></p>`
}

/** `S02_Beast04_L1_Horn` and a descriptor part both reduce to `Beast04_horn`. */
function partKey(id: string): string {
  const m = /^S\d{2}_([A-Za-z]+?)(\d{2})_L\d_([A-Za-z]+)$/.exec(id)
  return m ? `${m[1]}${m[2]}_${m[3].toLowerCase()}` : id
}

export function hatchHtml(b: Buddy, lines: string[]): string {
  const hatched = Boolean(b.hatchedAt)
  const rare = new Set(b.rareIds.map(partKey))
  const mystic = b.mysticId ? partKey(b.mysticId) : null
  const parts = (b.descriptor?.parts || [])
    .map((p) => {
      const key = `${p.class}${String(p.variant).padStart(2, '0')}_${p.type}`
      return chipHtml(`${p.class ?? 'Wild'} ${p.type}`, key === mystic ? 'mystic' : rare.has(key) ? 'rare' : 'plain')
    })
    .join('')
  const speech = lines
    .map((l, i) => `<div class="bd-speech"><span>${esc(l)}</span>${b.traits[i] ? `<span class="bd-pill bd-pill-ok">${esc(b.traits[i])}${lines.length > 1 ? ` · ${i + 1} of ${lines.length}` : ''}</span>` : ''}</div>`)
    .join('')
  const naming = `
    <label class="bd-label" for="bd-name">Name your Axie</label>
    <div class="bd-input-row">
      <input id="bd-name" class="bd-input" maxlength="16" value="${esc(b.name)}" placeholder="Miso" autocomplete="off">
      <button type="button" class="bd-btn bd-btn-ghost" data-action="suggest">Suggest</button>
    </div>`
  const cta = hatched
    ? `<button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="home">Hello, ${esc(b.name)}</button>`
    : `<button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="hatch-confirm">Hello, <span data-name-echo>${esc(b.name || 'Miso')}</span></button>`
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-center">
        <p class="bd-eyebrow">Day ${dayCount(b)} · ${b.kind === 'owned' ? 'your own Axie' : `${b.egg.snaps} snaps together`}</p>
        <h1>${hatched ? (b.kind === 'owned' ? 'Say hello' : 'Your egg hatched!') : 'It is ready to hatch'}</h1>
      </header>
      <div class="bd-speech-stack">${speech}</div>
      <div class="bd-card bd-center bd-hatch-card">
        <div class="bd-hero-3d bd-hero-3d-big" data-face="buddy"></div>
        ${b.class ? `<span class="bd-badge">${b.kind === 'owned' ? 'Owned' : 'Wild'} · ${esc(b.class)}</span>` : ''}
        <div class="bd-chips">${parts}</div>
      </div>
      ${hatched ? '' : naming}
    </div>
    <div class="bd-actions">${cta}</div>
    <p class="bd-small bd-center">Not the one? You can start a fresh egg any time from Home. Only one Axie is active.</p>`
}

const WEARABLES = ['hat', 'scarf', 'shades', 'cape', 'crown']

const FRAME_LABELS: Record<string, string> = {
  none: 'No frame',
  polaroid: 'Polaroid',
  film: 'Film',
  postcard: 'Postcard',
}

/**
 * Wardrobe picker for the camera tray, in place of the legacy "Your crew" cast tray.
 *
 * Unlocked items are tappable (`data-wear`; tapping the worn one takes it off), locked ones are
 * disabled and named with the bond level from the buddy's own ladder. Purely a view: it never
 * decides what is unlocked — `b.wardrobe.unlocked` comes from the server. Nothing before the
 * hatch (an egg wears nothing), which is also why the tray is empty with no active buddy.
 */
export function wardrobeTrayHtml(b: Buddy | null): string {
  if (!b || !b.hatchedAt) return ''
  const levelByUnlock = new Map(b.ladder.map((r) => [r.unlock, r.level]))
  // The Mystic glow is not a worn item — it is always on once bond level 10 grants it, so it shows
  // as a badge with no `data-wear` and nothing to toggle.
  const glow = b.wardrobe.unlocked.includes('glow')
    ? `<span class="prop-chip wardrobe-chip is-badge" title="Mystic glow, on for good">
  <span class="prop-ico" aria-hidden="true">${icon('star', 16)}</span>
  <span class="prop-name">Glow</span>
</span>`
    : ''
  return glow + WEARABLES.map((it) => {
    const unlocked = b.wardrobe.unlocked.includes(it)
    const worn = b.wardrobe.worn === it
    const level = levelByUnlock.get(it)
    const name = it[0].toUpperCase() + it.slice(1)
    const label = unlocked ? name : `Bond ${level ?? '?'}`
    const title = unlocked
      ? worn ? `Take off the ${it}` : `Wear the ${it}`
      : `${name} unlocks at bond ${level ?? '?'}`
    return `<button type="button" class="prop-chip wardrobe-chip${unlocked ? '' : ' is-locked'}${worn ? ' is-worn' : ''}" data-wear="${esc(it)}" aria-pressed="${worn ? 'true' : 'false'}"${unlocked ? '' : ' disabled'} title="${esc(title)}">
  <span class="prop-ico" aria-hidden="true">${icon(it, 16)}</span>
  <span class="prop-name">${esc(label)}</span>
</button>`
  }).join('')
}

/**
 * Photo-frame picker for the camera tray. Frames arrive with the cape at bond level 5, and the
 * choice is a client-side preference (localStorage) in R1 — the buddy record has no frame field.
 */
export function frameTrayHtml(ids: readonly string[], active: string): string {
  return ids
    .map((id) => {
      const on = id === active
      const label = FRAME_LABELS[id] || id
      return `<button type="button" class="prop-chip" data-frame="${esc(id)}" aria-pressed="${on ? 'true' : 'false'}" title="${esc(label)}">
  <span class="prop-ico" aria-hidden="true">${icon(id === 'none' ? 'close' : 'gallery', 16)}</span>
  <span class="prop-name">${esc(label)}</span>
</button>`
    })
    .join('')
}

/**
 * `photoIds` are post ids, and `/api/image/<id>` serves marketplace art — the stored
 * upload path is the only thing that renders the real photo. Older buddy records have
 * no `photos` array, so a miss just leaves the placeholder tile.
 */
function photoPath(b: Buddy, photoId: string | null): string | null {
  if (!photoId) return null
  const hit = (b.photos || []).find((p) => p.id === photoId)
  return hit?.imagePath || null
}

/**
 * `buddies` feeds the "Resting Axies" row; `address` decides how the wallet line reads. Both are
 * optional so the renderer stays a pure string-in/string-out function for the unit test.
 */
export function homeHtml(b: Buddy, greeting: string | null, opts: { buddies?: Buddy[]; address?: string | null; talk?: boolean } = {}): string {
  const filled = Math.ceil(b.level / 2)
  const hearts = Array.from({ length: 5 }, (_, i) => `<span class="bd-heart${i < filled ? ' on' : ''}">${icon(i < filled ? 'heartFilled' : 'heart', 18)}</span>`).join('')
  const floorBond = b.ladder.find((r) => r.level === b.level)?.bond ?? 0
  const meter = b.next
    ? `<div class="bd-meter-row"><span>Bond ${b.next.level} in ${b.next.remaining} snap${b.next.remaining === 1 ? '' : 's'}</span><b class="bd-hot">${esc(b.next.reward)}</b></div>
       <div class="bd-meter"><i style="width:${pct((b.bond - floorBond) / Math.max(1, b.next.bond - floorBond))}%"></i></div>`
    : `<div class="bd-meter-row"><span>Top of the ladder</span><b class="bd-hot">Idol</b></div><div class="bd-meter"><i style="width:100%"></i></div>`
  const ladderByUnlock = new Map(b.ladder.map((r) => [r.unlock, r]))
  const wardrobe = WEARABLES.map((it) => {
    const unlocked = b.wardrobe.unlocked.includes(it)
    const worn = b.wardrobe.worn === it
    const row = ladderByUnlock.get(it)
    const label = unlocked ? (worn ? 'Worn' : it[0].toUpperCase() + it.slice(1)) : `Bond ${row?.level ?? '?'}`
    return `<button type="button" class="bd-item ${unlocked ? 'on' : 'locked'}${worn ? ' worn' : ''}" data-action="wear" data-item="${esc(it)}"${unlocked ? '' : ' disabled'} aria-label="${esc(it)}">${icon(it, 26)}<small>${esc(label)}</small></button>`
  }).join('')
  // `photoIds` is capped server-side (head + tail), so the true count of kept photos is `photoCount`
  // (older payloads: `snapCount`).
  const kept = b.photoCount ?? b.snapCount
  // Every kept photo, newest first, in a strip that scrolls sideways: the count on the label and
  // the thumbnails under it are the same set. (Only the last four used to show, under a label
  // that said eight.) Old photos past the server's cap have no thumbnail but keep their number.
  const book = b.photoIds.slice().reverse()
    .map((id, i) => {
      const path = photoPath(b, id)
      const art = path ? `<img class="bd-thumb-img" src="${esc(path)}" alt="" loading="lazy">` : ''
      return `<button type="button" class="bd-thumb" data-action="photo" data-id="${esc(id)}" aria-label="Photo ${kept - i}">${art}<small>${kept - i}</small></button>`
    }).join('')
    || '<span class="bd-small bd-muted">No photos yet. The first one starts the book.</span>'
  const who = b.kind === 'owned' ? `${esc(b.name)} · owned${b.axieId ? ` #${esc(b.axieId)}` : ''}` : `Wild ${esc(b.class ?? 'Axie')}`
  // The Mystic glow arrives at bond level 10 and stays on: the hero box glows in the CSS, the
  // camera layer and the capture get the same treatment from main.ts.
  const glow = b.level >= 10 ? ' bd-glow' : ''
  // One bubble: the Axie asking for today's wish in its words (the greeting), else the wish itself.
  const line = greeting || (b.wish.id && !b.wish.done ? `${b.wish.text}.` : '')
  // The only wallet entry point once the egg has hatched — the egg screen's version is gone by then.
  const wallet = opts.address
    ? '<a class="bd-link" data-action="claim">Wallet connected · pick another Axie</a>'
    : 'Own an Axie on Ronin? <a class="bd-link" data-action="claim">Bring it</a>'
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <div><p class="bd-eyebrow">Day ${dayCount(b)} · my Axie</p><h1>${esc(b.name)}</h1></div>
        <span class="bd-head-actions"><span class="bd-pill bd-pill-light">${icon('heartFilled', 14)} ${b.streak}-day streak</span><button type="button" class="bd-pill bd-pill-btn" data-action="account" aria-label="Profile">${icon('user', 14)} Profile</button></span>
      </header>
      <div class="bd-card bd-ask">
        <div class="bd-speech-row">${line
          ? `<div class="bd-speech bd-speech-home">${esc(line)}</div>${opts.talk ? '<button type="button" class="bd-link" data-action="talk">Talk</button>' : ''}`
          : `<div class="bd-speech bd-speech-home bd-speech-quiet">${esc(b.name)}</div>${opts.talk ? `<button type="button" class="bd-link" data-action="talk">Talk to ${esc(b.name)}</button>` : ''}`
        }</div>
        ${wishPillHtml(b, { compact: true })}
      </div>
      <div class="bd-card bd-hero">
        <div class="bd-hero-row">
          <div class="bd-hero-3d${glow}" data-face="buddy"${opts.talk ? ' data-action="talk"' : ''}><span class="bd-badge">${icon('star', 11)} Bond ${b.level}</span></div>
          <div class="bd-hero-text">
            <b>${esc(levelTitle(b))}</b>
            <span class="bd-muted">${who} · ${b.snapCount} snaps · ${b.moments.length} of ${b.momentsTotal} moments</span>
            <div class="bd-chips">${b.traits.map((t) => chipHtml(t)).join('')}${b.earnedTrait ? chipHtml(b.earnedTrait, 'earned') : ''}${b.mystic ? chipHtml('Mystic', 'mystic') : ''}</div>
            <div class="bd-hearts">${hearts}</div>
          </div>
        </div>
        ${meter}
      </div>
      <div class="bd-card-head"><span class="bd-label">Wardrobe · ${b.wardrobe.unlocked.filter((u) => WEARABLES.includes(u)).length} of ${WEARABLES.length}</span><a class="bd-link" data-action="ladder">Growth ladder</a></div>
      <div class="bd-items">${wardrobe}</div>${restingRowHtml(opts.buddies || [], b.id)}
      <div class="bd-card-head"><a class="bd-label bd-link" data-action="scrapbook">Scrapbook · ${kept} ${icon('chevron', 12)}</a><span><a class="bd-link" data-action="diary">Diary</a> <a class="bd-link" data-action="monthly">Idol ladder</a></span></div>
      <div class="bd-book">${book}</div>
      <p class="bd-small bd-center">Want another Axie? <a class="bd-link" data-action="fresh-egg">Hatch another egg</a> · ${esc(b.name)} rests, switch back any time in <a class="bd-link" data-action="account">Profile</a></p>
      <p class="bd-small bd-center">${wallet}</p>
    </div>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Snap with ${esc(b.name)}</button>
    </div>`
}

/**
 * Boot could not reach the server. Without this the app painted an empty document — every screen
 * hidden, nothing to tap — and looked broken rather than offline. Rendered into `#buddy-egg`.
 */
export function bootErrorHtml(): string {
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-center">
        <p class="bd-eyebrow">Offline</p>
        <h1>Couldn't reach the server</h1>
        <p class="bd-muted">Your Axie is safe. Check the connection and try again.</p>
      </header>
    </div>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="retry-boot">Retry</button>
    </div>`
}

/**
 * Account: who this phone is playing as, how to keep the Axies for good, and every Axie on the
 * account. A guest sees the Ronin sign-in and the recovery code (guest-only, the wallet is the
 * account otherwise); a signed-in player sees the wallet and the owned-Axie shortcut. Reached from
 * the person button on the egg and Home screens.
 */
export function accountHtml(b: Buddy | null, opts: { buddies?: Buddy[]; address?: string | null } = {}): string {
  const address = opts.address || null
  const short = address ? (address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address) : ''
  const identity = address
    ? `
      <div class="bd-card bd-wallet">
        <span class="bd-wallet-mark">R</span>
        <span class="bd-hero-text"><b>Ronin Wallet</b><span class="bd-muted">${esc(short)} · every Axie here stays on this wallet, on any phone</span></span>
        <span class="bd-pill bd-pill-ok">Signed</span>
      </div>
      <div class="bd-actions"><button type="button" class="bd-btn bd-btn-ghost bd-grow" data-action="claim">Bring an Axie you own</button></div>`
    : `
      <div class="bd-card bd-wallet">
        <span class="bd-wallet-mark">?</span>
        <span class="bd-hero-text"><b>Guest on this phone</b><span class="bd-muted">Sign in with Ronin to keep every Axie, wild or owned, on your account for good.</span></span>
      </div>
      <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="ronin-account">Sign in with Ronin</button></div>
      <p class="bd-small bd-center"><a class="bd-link" data-action="claim">Bring an Axie you own</a> · <a class="bd-link" data-action="recover">I have a recovery code</a></p>
      <div class="bd-card">
        <div class="bd-card-head"><span class="bd-label">Moving phones?</span></div>
        <p class="bd-small">A recovery code moves this account to another phone. It works once.</p>
        <div class="bd-actions"><button type="button" class="bd-btn bd-btn-ghost bd-grow" data-action="recovery">Show recovery code</button></div>
      </div>`
  const active = b
    ? b.hatchedAt
      ? `<div class="bd-row"><b>${esc(b.name)}</b><span class="bd-muted">${esc(b.kind === 'owned' ? 'owned' : `Wild ${b.class ?? 'Axie'}`)} · Bond ${b.level}</span><span class="bd-pill bd-pill-ok">Active</span></div>`
      : `<div class="bd-row"><b>Your egg</b><span class="bd-muted">${b.egg.snaps} ${b.egg.snaps === 1 ? 'snap' : 'snaps'} so far</span><span class="bd-pill bd-pill-ok">Active</span></div>`
    : '<p class="bd-small bd-muted">No Axie yet.</p>'
  // Another Axie is an egg, not a replacement: the active one rests and comes back with one tap.
  const another = b?.hatchedAt
    ? `<p class="bd-small">${esc(b.name)} rests while you raise a new egg, and comes back with one tap.</p>
      <div class="bd-actions"><button type="button" class="bd-btn bd-btn-ghost bd-grow" data-action="fresh-egg">Hatch another egg</button></div>`
    : b ? '<p class="bd-small bd-muted">Hatch this egg first, then you can raise another.</p>' : ''
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <button type="button" class="bd-round" data-action="back" aria-label="Back">${icon('back', 18)}</button>
        <p class="bd-eyebrow">Profile</p>
        <span class="bd-round bd-round-ghost"></span>
      </header>
      <div class="bd-card">
        <div class="bd-card-head"><span class="bd-label">Your Axies</span><span class="bd-link">One is active at a time</span></div>
        ${active}
        ${restingRowHtml(opts.buddies || [], b?.id || null)}
        ${another}
      </div>
      ${identity}
    </div>
    <p class="bd-small bd-center"><a class="bd-link" data-action="about">About Axie Idol</a></p>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="back">Back to ${b?.hatchedAt ? esc(b.name) : 'the egg'}</button></div>`
}

/** A photo's place in the story: "Day 3 · Thu 11 Sep". Day 1 is the day the egg was found. */
function photoDayLabel(b: Buddy, at: string): string {
  const t = Date.parse(at)
  if (Number.isNaN(t)) return ''
  const day = dayCount(b, t)
  const d = new Date(t)
  return `Day ${day} · ${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`
}

/**
 * Every kept photo, newest first, in a grid. Photos older than the server keeps thumbnails for
 * (sixty) are counted on the label but not shown; the count is the true size of the book.
 */
export function scrapbookHtml(b: Buddy): string {
  const kept = b.photoCount ?? b.snapCount
  const photos = (b.photos || []).slice().reverse()
  const tiles = photos.map((p, i) => `
      <button type="button" class="bd-tile" data-action="photo" data-id="${esc(p.id)}" aria-label="Photo ${kept - i}">
        ${p.imagePath ? `<img class="bd-thumb-img" src="${esc(p.imagePath)}" alt="" loading="lazy">` : ''}<small>${kept - i}</small>
      </button>`).join('')
  const missing = kept - photos.length
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <button type="button" class="bd-round" data-action="home" aria-label="Back">${icon('back', 18)}</button>
        <p class="bd-eyebrow">Scrapbook · ${kept}</p>
        <span class="bd-round bd-round-ghost"></span>
      </header>
      ${tiles ? `<div class="bd-grid3">${tiles}</div>` : '<p class="bd-small bd-muted bd-center">No photos yet. The first one starts the book.</p>'}
      ${missing > 0 ? `<p class="bd-small bd-muted bd-center">${missing} older ${missing === 1 ? 'photo is' : 'photos are'} counted but not shown here.</p>` : ''}
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Add a photo</button></div>`
}

/** One photo, full width, with its day and the way out of the book. */
export function photoViewHtml(b: Buddy, photoId: string): string {
  const p = (b.photos || []).find((x) => x.id === photoId) || null
  const index = b.photoIds.indexOf(photoId)
  const number = index >= 0 ? (b.photoCount ?? b.snapCount) - (b.photoIds.length - 1 - index) : null
  return `
    <p class="bd-eyebrow">${number ? `Photo ${number}` : 'Photo'}${p ? ` · ${esc(photoDayLabel(b, p.at))}` : ''}</p>
    ${p?.imagePath ? `<img class="bd-photo-full" src="${esc(p.imagePath)}" alt="">` : '<p class="bd-small bd-muted">This one is older than the book keeps pictures for.</p>'}
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-ghost" data-action="unkeep-photo" data-id="${esc(photoId)}">Don't keep</button>
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="close-sheet">Close</button>
    </div>`
}

/**
 * The front door. Shown only to a phone with no egg and no Axie: what this is, the one thing to
 * do, and the two ways a returning player gets their Axie back. Reached later from Profile as
 * About, where the start button gives way to a way back.
 */
/**
 * The mark: a star cut from paper, in the hand of the Axie logo it sits beside: a coral to yellow
 * fade, a dark red edge below and to the right, a white sticker border. No face. The game is
 * about raising an Axie into a star, so the mark is where it ends up. Same drawing as
 * public/icon.svg. Drawn from scratch; none of the Axie Infinity letterforms are reused.
 */
const MARK_STAR = 'M46 5 56 3 64 33 95 33 97 42 72 60 82 88 74 95 50 76 25 95 17 89 28 59 3 43 5 34 37 33Z'
const MARK_FADE = '<stop offset="0" stop-color="#FF5A5F"/><stop offset=".55" stop-color="#FF9A3C"/><stop offset="1" stop-color="#FFDD3B"/>'

export function logoSvg(size = 28): string {
  return `<svg class="lp-mark" width="${size}" height="${size}" viewBox="-10 -10 124 124" aria-hidden="true">
    <defs><linearGradient id="lp-fade-m" x1="0" y1="0" x2="0" y2="1">${MARK_FADE}</linearGradient></defs>
    <g fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"><path d="${MARK_STAR}"/><path transform="translate(4 6)" d="${MARK_STAR}"/></g>
    <path transform="translate(4 6)" d="${MARK_STAR}" fill="#B5213B"/>
    <path d="${MARK_STAR}" fill="url(#lp-fade-m)"/>
  </svg>`
}

/** The name, set in the same cut-paper hand: AXIE in the fade, IDOL in blue blocks beside it. */
export function wordmarkSvg(height = 22): string {
  const axie = `<path transform="rotate(-3 36 50)" fill-rule="evenodd" d="M0 100 22 0 50 4 72 100 48 100 44 78 26 80 22 100ZM30 60 40 59 35 32Z"/>
      <path transform="translate(80 0) rotate(2 36 50)" d="M0 4 24 0 36 30 50 2 72 6 50 50 74 98 48 100 36 68 22 100-2 96 22 50Z"/>
      <path transform="translate(162 0) rotate(-2 14 50)" d="M2 2 28 0 26 100 0 98Z"/>
      <path transform="translate(198 0) rotate(3 28 50)" d="M0 0 56 4 54 26 26 24 26 40 48 40 47 60 26 59 26 76 58 78 56 100 0 98Z"/>`
  const idol = `<g transform="translate(284 8) scale(2.7)" fill-rule="evenodd"><path d="M0 0H10V34H0Z"/>
      <path transform="translate(18 0)" d="M0 0H20L30 8V26L20 34H0ZM10 9V25H17L20 22V12L17 9Z"/>
      <path transform="translate(56 0)" d="M8 0H24L32 8V26L24 34H8L0 26V8ZM12 10 10 12V22L12 24H20L22 22V12L20 10Z"/>
      <path transform="translate(96 0)" d="M0 0H10V24H26V34H0Z"/></g>`
  const width = Math.round(height * (650 / 132))
  return `<svg class="lp-wordmark" width="${width}" height="${height}" viewBox="-12 -12 650 132" role="img" aria-label="Axie Idol">
    <defs><linearGradient id="lp-fade-w" x1="0" y1="0" x2="0" y2="1">${MARK_FADE}</linearGradient></defs>
    <g fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="round">${axie}<g transform="translate(4 6)">${axie}</g>${idol}</g>
    <g transform="translate(4 6)" fill="#B5213B">${axie}</g>
    <g fill="url(#lp-fade-w)">${axie}</g>
    <g fill="#1E90FF">${idol}</g>
  </svg>`
}

/**
 * The front door, as a landing page: a header with the mark, a hero with a real photo and real
 * lines, then the sections a stranger needs in the order they ask them: how it works, what it
 * says, how it grows, what hatches, the honest rules. On a phone it is one clean column inside
 * the frame; on a wide screen the frame opens and it is a page. As About it leads back instead.
 */
export function welcomeHtml(opts: { hasAxie?: boolean; axieName?: string | null; address?: string | null } = {}): string {
  const about = Boolean(opts.hasAxie)
  const name = esc(opts.axieName || 'your Axie')
  const primary = about
    ? `<button type="button" class="bd-btn bd-btn-primary" data-action="back">Back to ${name}</button>`
    : `<button type="button" class="bd-btn bd-btn-primary" data-action="start-egg">Find an egg</button>`
  const heroLines = ['That bench is far. Let us climb all those stairs to get to it.', 'We were right here before. What is past the top this time?', 'Grey steps go up. Can we climb every single one?']
  const bubbles = heroLines.map((l, i) => `<div class="bd-w-bubble" style="--i:${i}">${esc(l)}</div>`).join('')
  const said = [
    { photo: '/welcome/playground.jpg', who: 'The egg, photo two', line: 'Something moved in there.' },
    { photo: '/welcome/rug.jpg', who: 'Happy, at home', line: 'That white shoe is neat. Can I poke it?' },
    { photo: '/welcome/aisle.jpg', who: 'In a shop', line: 'So many yellow bags. Can we open one?' },
  ]
  const saidCards = said.map((c) => `
        <figure class="lp-said">
          <img src="${c.photo}" alt="" loading="lazy">
          <figcaption><span class="lp-said-line">${esc(c.line)}</span><span class="lp-said-who">${esc(c.who)}</span></figcaption>
        </figure>`).join('')
  const wardrobe: Array<[string, string]> = [['hat', 'Party hat'], ['scarf', 'Scarf'], ['shades', 'Shades'], ['cape', 'Cape'], ['crown', 'Crown']]
  const wearRow = wardrobe.map(([id, label]) => `<span class="lp-wear">${icon(id, 22)}<small>${label}</small></span>`).join('')
  const odds = [['5', 'photos', 'A common Axie, any class'], ['20', 'photos', 'One rare part, guaranteed'], ['50', 'photos', 'Two rare parts'], ['100', 'photos', 'A shot at Mystic']]
  // Three parts, in the order people ask: what is real today, what the next round adds, what comes after.
  const road: Array<{ when: string; title: string; state: string; items: string[] }> = [
    { when: 'Done', title: 'Round one', state: 'Live now', items: [
      'An egg that rides in your camera and hatches an Axie nobody else has',
      'A voice that looks at each photo and writes its line on the picture',
      'Memory: it knows when you are back somewhere, and it answers your caption',
      'Ten steps of growth: hat, scarf, shades, cape, crown, the Mystic glow',
      'A wish every day, a scrapbook, and the monthly Idol ladder',
      'Ronin sign-in: bring an Axie you own, and keep more than one',
    ] },
    { when: 'Next', title: 'Round two', state: 'Next stage of the Vibeathon', items: [
      'Talk back: a real conversation with your Axie, not only one line',
      'Duo photos: pair with a friend and both Axies are in the frame',
      'Parts that evolve as bond grows: horn, then back, then tail',
      'A feed to share photos and cheer for other Axies',
      'A morning nudge, when your Axie wants to go out',
    ] },
    { when: 'After', title: 'After the Vibeathon', state: 'Planned', items: [
      'Seasons on the Idol ladder, with something to win',
      'A collectible card for every Axie that reaches Idol',
      'More to wear, more tricks, more moments to find',
      'An app you can install, with notifications',
      'Closer ties to Ronin for players who own their Axies',
    ] },
  ]
  const roadCards = road.map((r, i) => `
          <li class="lp-road-card${i === 0 ? ' lp-road-done' : ''}">
            <span class="lp-road-when">${r.when}</span>
            <b>${r.title}</b>
            <span class="lp-road-state">${r.state}</span>
            <ul>${r.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          </li>`).join('')
  const oddsRow = odds.map(([n, unit, what]) => `<div class="lp-odd"><b>${n}</b><small>${unit}</small><span>${what}</span></div>`).join('')
  return `
    <div class="bd-scroll bd-welcome lp">
      <header class="lp-header">
        <a class="lp-brand" data-action="${about ? 'back' : 'about'}">${logoSvg(34)}${wordmarkSvg(24)}</a>
        <nav class="lp-nav" aria-label="Sections">
          <a href="#lp-how">How it works</a><a href="#lp-voice">The voice</a><a href="#lp-grow">Grow</a><a href="#lp-road">Roadmap</a><a href="#lp-faq">Questions</a>
        </nav>
        <div class="lp-header-cta">${primary}</div>
      </header>

      <section class="lp-hero">
        <div class="lp-hero-copy">
          <p class="bd-eyebrow">Axie Vibeathon 2026 · Round one</p>
          <h1 class="lp-h1">Your Axie. In your camera. With opinions.</h1>
          <p class="lp-lede">Find an egg and take it places. When it hatches, it talks: one line after every photo, about what it actually sees, and where it wants to go next.</p>
          <div class="lp-cta">${primary}${about ? '' : '<span class="lp-cta-note">Free. No wallet needed.</span>'}</div>
          ${about ? '' : `<p class="bd-small lp-alt">Played before? ${opts.address ? '<a class="bd-link" data-action="claim">Bring an Axie you own</a>' : '<a class="bd-link" data-action="ronin-welcome">Sign in with Ronin</a>'} · <a class="bd-link" data-action="recover">I have a recovery code</a></p>`}
        </div>
        <div class="bd-w-shot lp-hero-shot" aria-hidden="true">
          <img class="bd-w-photo" src="/welcome/stairs.jpg" alt="">
          <div class="bd-w-bubbles">${bubbles}</div>
          <img class="bd-w-axie" src="/stickers/kotaro.png" alt="">
          <span class="bd-w-tag">A real photo, a real line</span>
        </div>
      </section>

      <section class="lp-section" id="lp-how">
        <p class="bd-eyebrow">How it works</p>
        <h2 class="lp-h2">Three steps, and the third one talks back</h2>
        <ol class="lp-steps">
          <li><b>Find an egg</b><span>It rides along in your camera, in every photo you take.</span></li>
          <li><b>Take it places</b><span>Five photos and it can hatch. Carry it further for a rarer Axie.</span></li>
          <li><b>It hatches, and it talks</b><span>A one-of-a-kind Axie with a voice. It says one line after every photo, and its words go on the picture.</span></li>
        </ol>
      </section>

      <section class="lp-section" id="lp-voice">
        <p class="bd-eyebrow">The voice</p>
        <h2 class="lp-h2">It sees. It remembers. It wants things.</h2>
        <p class="lp-sub">Every line is about the photo it is on. It names what it can see, notices when you are somewhere again, and asks for the next place. Write a caption and it answers that too.</p>
        <div class="lp-said-row">${saidCards}</div>
      </section>

      <section class="lp-section" id="lp-grow">
        <p class="bd-eyebrow">Grow</p>
        <h2 class="lp-h2">Every photo builds bond. Bond opens the wardrobe.</h2>
        <div class="lp-grow">
          <div class="bd-card lp-grow-card">
            <b>Ten steps on the growth ladder</b>
            <div class="lp-wear-row">${wearRow}</div>
            <span>A name and a voice first. Then the hat, the scarf, the shades, a signature pose, the cape, a trick, the crown, another trick, and the Mystic glow at the top.</span>
          </div>
          <div class="bd-card lp-grow-card">
            <b>The Idol ladder</b>
            <span>Bond earned this month ranks every Axie in the game. The crown rotates monthly, so a new Axie is never out of the race.</span>
          </div>
        </div>
      </section>

      <section class="lp-section" id="lp-hatch">
        <p class="bd-eyebrow">What hatches</p>
        <h2 class="lp-h2">The longer you carry the egg, the rarer the Axie</h2>
        <div class="lp-odds">${oddsRow}</div>
        <p class="lp-sub">No two hatched Axies share the same parts. Already own one on Ronin? Sign in and bring it instead of an egg.</p>
      </section>

      <section class="lp-section" id="lp-road">
        <p class="bd-eyebrow">Roadmap</p>
        <h2 class="lp-h2">What is done, what is next, what comes after</h2>
        <ol class="lp-road">${roadCards}
        </ol>
        <p class="lp-sub">Round one is what you can play today. The rest are plans, in the order we mean to build them.</p>
      </section>

      <section class="lp-section" id="lp-faq">
        <p class="bd-eyebrow">Questions</p>
        <h2 class="lp-h2">The honest rules</h2>
        <dl class="lp-faq">
          <div><dt>Is it free?</dt><dd>Yes. There is nothing to buy and no ads.</dd></div>
          <div><dt>Do I need a wallet?</dt><dd>No. A wallet only matters if you want to bring an Axie you already own, or keep your Axies on an account across phones.</dd></div>
          <div><dt>How many photos count?</dt><dd>Ten a day build bond. Wishes and moments add a little on top. The rest still go in the book.</dd></div>
          <div><dt>Where do my photos go?</dt><dd>Into your Axie's scrapbook. Your Axie looks at each one to find its line. Nothing is sold.</dd></div>
        </dl>
      </section>

      <footer class="lp-footer">
        <a class="lp-brand" data-action="${about ? 'back' : 'about'}">${logoSvg(26)}${wordmarkSvg(18)}</a>
        <span class="bd-muted">Built for the Axie Vibeathon 2026 · axieidol.com</span>
        <div class="lp-footer-cta">${primary}</div>
      </footer>
    </div>`
}

export function claimHtml(axies: OwnedAxie[], selectedId: string | null, address: string | null): string {
  const head = `
    <header class="bd-head bd-head-row">
      <button type="button" class="bd-round" data-action="back" aria-label="Back">${icon('back', 18)}</button>
      <p class="bd-eyebrow">Bring your own Axie</p>
      <span class="bd-round bd-round-ghost"></span>
    </header>
    <div class="bd-head">
      <h1>Pick your buddy</h1>
      <p class="bd-muted">One of your Axies becomes your buddy and skips the egg. Bond starts at Hatch and grows the same way.</p>
    </div>`
  if (!address) {
    return `
      <div class="bd-scroll">
        ${head}
        <div class="bd-card bd-note">${icon('lock', 18)}<p class="bd-small">You sign a message to prove ownership. No transaction, no gas, nothing leaves your wallet. Owned buddies get a badge in every photo.</p></div>
      </div>
      <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="ronin">Connect Ronin Wallet</button></div>
      <p class="bd-small bd-center"><a class="bd-link" data-action="back">Use a wild Axie instead</a> · <a class="bd-link" data-action="recover">I have a recovery code</a></p>`
  }
  const short = address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
  const picked = axies.find((a) => a.id === selectedId) || axies[0] || null
  const grid = axies.map((a) => {
    const on = picked && a.id === picked.id
    return `<button type="button" class="bd-axie${on ? ' on' : ''}" data-action="select-axie" data-id="${esc(a.id)}">
      <span class="bd-axie-art bd-class-${esc(String(a.class || 'wild').toLowerCase())}">${on ? `<span class="bd-axie-tick">${icon('star', 12)}</span>` : ''}</span>
      <b>${esc(a.name || `Axie #${a.id}`)}</b><small>${esc(a.class || 'Axie')}</small>
    </button>`
  }).join('') || '<p class="bd-small bd-muted">No Axies in this wallet yet. A wild egg works just as well.</p>'
  return `
    <div class="bd-scroll">
      ${head}
      <div class="bd-card bd-wallet">
        <span class="bd-wallet-mark">R</span>
        <span class="bd-hero-text"><b>Ronin Wallet connected</b><span class="bd-muted">${esc(short)} · ${axies.length} ${axies.length === 1 ? 'Axie' : 'Axies'} found</span></span>
        <span class="bd-pill bd-pill-ok">Signed</span>
      </div>
      <div class="bd-card-head"><span class="bd-label">Your Axies</span></div>
      <div class="bd-axies">${grid}</div>
      <div class="bd-card bd-note">${icon('lock', 18)}<p class="bd-small">You signed a message to prove ownership. No transaction, no gas, nothing leaves your wallet. Owned buddies get a badge in every photo.</p></div>
    </div>
    <div class="bd-actions">
      ${picked
        ? `<button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="pick-axie" data-id="${esc(picked.id)}">Make ${esc(picked.name || `Axie #${picked.id}`)} my buddy</button>`
        : '<button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="back">Start a wild egg instead</button>'}
    </div>
    <p class="bd-small bd-center"><a class="bd-link" data-action="back">Use a wild Axie instead</a></p>`
}

export function reactionHtml(r: Snap): string {
  const chips = r.labels.slice(0, 3).map((l) => chipHtml(l)).join('')
  const bits = [
    r.isNewPlace ? 'New place' : '',
    r.granted ? `+${r.granted} bond` : `Today's ${r.dailyCap} photos are counted, this one still goes in the book`,
    r.wishDone ? `wish done +${r.wishDone.bonus}` : '',
    `${Math.min(r.snapsToday ?? r.bondToday, r.dailyCap)} of ${r.dailyCap} photos today`,
  ].filter(Boolean).join(' · ')
  return `
    <p class="bd-eyebrow">After the shot</p>
    <div class="bd-speech">${esc(r.line)}</div>
    <div class="bd-chips">${chips}</div>
    <p class="bd-small">${esc(bits)}</p>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-ghost" data-action="retake">Retake</button>
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="save">Save</button>
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-ghost bd-grow" data-action="unkeep">Don't keep this one</button></div>`
}

export function momentHtml(m: Moment, b: Buddy): string {
  const share = pct(m.rarity)
  return `
    <div class="bd-moment">
      <span class="bd-moment-mark">${icon('star', 24)}</span>
      <div class="bd-hero-text">
        <p class="bd-eyebrow">New moment${m.rarity <= 0.2 ? ' · rare' : ''}</p>
        <h2>${esc(m.title)}</h2>
        <p class="bd-small">${esc(m.line)} Only ${share}% of Axies have one.</p>
      </div>
    </div>
    <p class="bd-small">Moments · ${b.moments.length} of ${b.momentsTotal}</p>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-ghost" data-action="unkeep">Skip</button>
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="sheet-next">Keep it in the book</button>
    </div>`
}

export function unlockHtml(u: Unlock, b: Buddy): string {
  return `
    <p class="bd-eyebrow">Bond ${u.level} reached</p>
    <h2>${esc(b.name)}: ${esc(u.reward)}</h2>
    <div class="bd-speech">${esc(u.line)}</div>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-ghost" data-action="sheet-next">Later</button>
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Snap the new look</button>
    </div>`
}

/**
 * Rewards that grant the unlock and show on the ladder, but change nothing about the character
 * in R1. Said out loud on the row rather than left for the player to discover.
 */
const R2_UNLOCKS = new Set(['pose-1', 'trick-1', 'trick-2', 'trail'])

export function ladderHtml(b: Buddy): string {
  const rows = b.ladder.map((r) => {
    const done = b.level >= r.level
    const isNext = b.next?.level === r.level
    const later = r.unlock && R2_UNLOCKS.has(r.unlock) ? '<small class="bd-muted">coming in R2</small>' : ''
    return `<div class="bd-step${done ? ' done' : ''}${isNext ? ' next' : ''}">
      <span class="bd-step-dot">${done ? icon('star', 14) : r.level}</span>
      <div class="bd-step-body">
        <b>${esc(r.reward)}</b>
        <small class="bd-muted">${r.unlock ? `Unlocks ${esc(r.unlock)}` : 'Milestone'}</small>
        ${later}
      </div>
      <b class="${isNext ? 'bd-hot' : 'bd-muted'}">${r.bond} bond</b>
    </div>`
  }).join('')
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <button type="button" class="bd-round" data-action="home" aria-label="Back">${icon('back', 18)}</button>
        <p class="bd-eyebrow">Growth ladder</p>
        <span class="bd-round bd-round-ghost"></span>
      </header>
      <div class="bd-head"><h1>Egg to Idol in 120 snaps</h1><p class="bd-muted">Every level changes the next photo. Wishes add bond on top, so a daily player reaches Idol in about a month.</p></div>
      <div class="bd-steps">${rows}</div>
      <div class="bd-card">
        <div class="bd-card-head"><span class="bd-label">Rules</span></div>
        <p class="bd-small">One photo is one bond, and only the first ${b.dailyCap} photos of a day count, so nobody grinds to Idol in an afternoon. Wishes add one or two and moments add two, on top.</p>
        <p class="bd-small">Wallet owners skip the egg and start at Hatch with their own Axie.</p>
      </div>
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Snap with ${esc(b.name || 'your Axie')}</button></div>`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
/** `2026-09` is a storage key, not a headline: the ladder says "September Idols". */
export function monthLabel(key: string): string {
  const m = /^\d{4}-(\d{2})$/.exec(String(key || ''))
  return (m && MONTH_NAMES[Number(m[1]) - 1]) || String(key || '')
}

export function monthlyHtml(data: Monthly): string {
  const rows = data.rows.map((r) => `
    <div class="bd-rank${data.you && data.you.rank === r.rank ? ' me' : ''}">
      <b class="bd-rank-n">${r.rank}</b>
      <span class="bd-rank-art bd-class-${esc(String(r.class || 'wild').toLowerCase())}"></span>
      <span class="bd-hero-text"><b>${esc(r.name)}${r.kind === 'owned' ? ' <span class="bd-badge">Owned</span>' : ''}</b><span class="bd-muted">Bond ${r.level} · rarity top ${pct(r.rarity)}%</span></span>
      <b>${r.monthlyBond}</b>
    </div>`).join('') || '<p class="bd-small bd-muted">Nobody has earned bond this month yet. Be first.</p>'
  const days = Math.max(0, Math.ceil((Date.parse(data.endsAt) - Date.now()) / 864e5))
  const you = data.you
    ? `<p class="bd-small">You are ${data.you.rank === 1 ? 'first' : `number ${data.you.rank}`} with ${data.you.monthlyBond} bond this month${data.you.toNextTier > 0 ? ` · ${data.you.toNextTier} more to pass the one above` : ''}.</p>`
    : '<p class="bd-small bd-muted">Take a photo this month to join the ladder.</p>'
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <button type="button" class="bd-round" data-action="home" aria-label="Back">${icon('back', 18)}</button>
        <p class="bd-eyebrow">${esc(monthLabel(data.month))} Idols · ends in ${days} day${days === 1 ? '' : 's'}</p>
        <span class="bd-round bd-round-ghost"></span>
      </header>
      <div class="bd-card bd-note">${icon('trophy', 18)}<p class="bd-small">The month's Idol wears the crown in every photo until the next month ends. Only bond earned this month counts, so a new Axie can win.</p></div>
      <div class="bd-card-head"><span class="bd-label">Ladder · ${data.rows.length} axies</span><span class="bd-link">Bond this month</span></div>
      <div class="bd-ranks">${rows}</div>
      ${you}
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Climb one snap</button></div>`
}

export function diaryHtml(d: Diary, b: Buddy): string {
  const entries = d.entries.map((e) => {
    const path = photoPath(b, e.photoId)
    return `
    <div class="bd-diary-row">
      <span class="bd-diary-art"${e.photoId ? ` data-photo-id="${esc(e.photoId)}"` : ''}>${path ? `<img class="bd-thumb-img" src="${esc(path)}" alt="" loading="lazy">` : ''}</span>
      <div class="bd-hero-text">
        <p class="bd-eyebrow">Day ${e.day} · ${esc(e.title)}</p>
        <p class="bd-diary-line">${esc(e.line)}</p>
      </div>
    </div>`
  }).join('') || '<p class="bd-small bd-muted">The first page is written after the first photo.</p>'
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <button type="button" class="bd-round" data-action="home" aria-label="Back">${icon('back', 18)}</button>
        <p class="bd-eyebrow">${esc(b.name)}'s diary · week ${d.week}</p>
        <span class="bd-round bd-round-ghost"></span>
      </header>
      <div class="bd-diary">${entries}
        <div class="bd-diary-foot"><span>${b.photoCount ?? b.snapCount} photos · ${b.moments.length} moments</span></div>
      </div>
      <div class="bd-card bd-note">${icon('bell', 18)}<p class="bd-small">${esc(d.anniversary || `Next: ${d.next}`)}</p></div>
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Write the next page</button></div>`
}

/** You on the right, the Axie on the left — the last three exchanges only, oldest first. */
export function talkHtml(b: Buddy, exchanges: TalkExchange[]): string {
  const bubbles = exchanges.slice(-3)
    .map((x) => `
      <div class="bd-talk-row bd-talk-you"><div class="bd-bubble bd-bubble-you">${esc(x.you)}</div></div>
      <div class="bd-talk-row bd-talk-buddy"><div class="bd-bubble bd-bubble-buddy">${esc(x.reply)}</div></div>`)
    .join('')
    || `<p class="bd-small bd-muted">Say something to ${esc(b.name || 'your Axie')}.</p>`
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <button type="button" class="bd-round" data-action="home" aria-label="Back">${icon('back', 18)}</button>
        <p class="bd-eyebrow">Talk with ${esc(b.name || 'your Axie')}</p>
        <span class="bd-round bd-round-ghost"></span>
      </header>
      <div class="bd-talk">${bubbles}</div>
    </div>
    <div class="bd-actions">
      <div class="bd-input-row bd-talk-input-row">
        <input id="bd-talk-input" class="bd-input" maxlength="200" placeholder="Say something" autocomplete="off">
        <button type="button" class="bd-btn bd-btn-primary" data-action="talk-send" aria-label="Send">${icon('chevron', 18)}</button>
      </div>
    </div>`
}

const NAMES: Record<string, string[]> = {
  Beast: ['Miso', 'Tofu', 'Biscuit', 'Rumble'],
  Aquatic: ['Bubbles', 'Pip', 'Kelp', 'Mochi'],
  Plant: ['Sprout', 'Fern', 'Pudding', 'Moss'],
  Bird: ['Chirp', 'Nimbus', 'Kite', 'Waffle'],
  Bug: ['Dot', 'Zip', 'Clover', 'Pebble'],
  Reptile: ['Sol', 'Ember', 'Ziggy', 'Onyx'],
}
export function suggestName(cls: string | null | undefined): string {
  const pool = NAMES[cls || ''] || Object.values(NAMES).flat()
  return pool[Math.floor(Math.random() * pool.length)]
}
