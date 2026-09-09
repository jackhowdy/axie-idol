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

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
/** Every name, line, label and id that reaches the markup goes through this. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
export const pct = (n: number): number => Math.max(0, Math.min(100, Math.round((Number.isFinite(n) ? n : 0) * 100)))
/** Day 1 is the day the egg was found. */
export function dayCount(b: Pick<Buddy, 'createdAt' | 'hatchedAt'>): number {
  const from = Date.parse(b.createdAt || b.hatchedAt || new Date().toISOString())
  if (Number.isNaN(from)) return 1
  return Math.max(1, Math.floor((Date.now() - from) / 864e5) + 1)
}

export function chipHtml(label: string, kind: 'plain' | 'rare' | 'mystic' = 'plain'): string {
  const cls = kind === 'rare' ? ' bd-chip-rare' : kind === 'mystic' ? ' bd-chip-mystic' : ''
  const mark = kind === 'plain' ? '' : icon('star', 10)
  return `<span class="bd-chip${cls}">${mark}${esc(label)}</span>`
}

/**
 * Compact buddy chip for the camera HUD (`#bd-chip`): egg progress before hatching,
 * bond progress after. Named `vfChipHtml` because `chipHtml` above is the part/trait chip.
 */
export function vfChipHtml(b: Buddy): string {
  if (!b.hatchedAt) {
    const target = b.eggOdds?.nextTier ?? 100
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
export function wishPillHtml(b: Buddy, opts: { interactive?: boolean } = {}): string {
  if (!b.wish.id) return ''
  const done = b.wish.done
  const tappable = !done && opts.interactive !== false
  const tag = tappable ? 'button' : 'div'
  const extra = tappable ? ' type="button" data-action="wish-done"' : ''
  return `<${tag} class="bd-row bd-wish${done ? ' done' : ''}"${extra}>
    <span class="bd-wish-dot">${icon(done ? 'star' : 'heart', 15)}</span>
    <span class="bd-wish-text">${esc(b.wish.text)}<small>${done ? 'Done today' : "Today's wish · tap when you have it"}</small></span>
    <b class="${done ? 'bd-ok' : 'bd-hot'}">+${b.wish.bonus} bond</b>
  </${tag}>`
}

const EGG_TIERS = [
  { at: 5, text: 'Common Axie, random class' },
  { at: 20, text: 'One rare part guaranteed' },
  { at: 50, text: 'Two rare parts · 5% Mystic chance' },
  { at: 100, text: '15% Mystic chance · keepsake shell' },
]

export function eggHtml(b: Buddy): string {
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
  const stage = snaps >= 20 ? 3 : snaps >= 5 ? 2 : 1
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-center">
        <p class="bd-eyebrow">Day ${dayCount(b)} · your egg</p>
        <h1>${canHatch ? 'Ready when you are' : 'You found an egg'}</h1>
        <p class="bd-muted">${canHatch
          ? 'Hatch now, or keep taking it places. The longer it incubates, the rarer the Axie inside.'
          : 'Take it places. After five photos together it hatches into an Axie nobody else has.'}</p>
      </header>
      <div class="bd-egg-tile">
        <div class="bd-egg stage-${stage}"></div>
        <span class="bd-badge">${icon('star', 11)} Wild egg</span>
        <span class="bd-pill bd-pill-light">${snaps} snaps · ${places} places</span>
      </div>
      <div class="bd-card">
        <div class="bd-card-head"><span class="bd-label">Odds if you hatch</span><span class="bd-link">Every ten snaps counts</span></div>
        ${rows}
        <div class="bd-meter"><i style="width:${Math.min(100, snaps)}%"></i></div>
        <p class="bd-small">Odds max out at 100. New places nudge them up. Every egg photo counts as bond once it hatches, so waiting is never wasted.</p>
      </div>
    </div>
    <div class="bd-actions">
      ${canHatch ? '<button type="button" class="bd-btn bd-btn-outline" data-action="hatch-now">Hatch now</button>' : ''}
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} ${canHatch ? 'Keep snapping' : 'Take the first photo'}</button>
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
    .map((l, i) => `<div class="bd-speech"><span>${esc(l)}</span>${b.traits[i] ? `<span class="bd-pill bd-pill-ok">${esc(b.traits[i])} · ${i + 1} of ${lines.length}</span>` : ''}</div>`)
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

export function homeHtml(b: Buddy, greeting: string | null): string {
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
  const book = b.photoIds.slice(-4).reverse()
    .map((id, i) => {
      const path = photoPath(b, id)
      const art = path ? `<img class="bd-thumb-img" src="${esc(path)}" alt="" loading="lazy">` : ''
      return `<span class="bd-thumb" data-photo-id="${esc(id)}">${art}<small>${b.photoIds.length - i}</small></span>`
    }).join('')
    || '<span class="bd-small bd-muted">No photos yet. The first one starts the book.</span>'
  const who = b.kind === 'owned' ? `${esc(b.name)} · owned${b.axieId ? ` #${esc(b.axieId)}` : ''}` : `Wild ${esc(b.class ?? 'Axie')}`
  return `
    <div class="bd-scroll">
      <header class="bd-head bd-head-row">
        <div><p class="bd-eyebrow">Day ${dayCount(b)} · my Axie</p><h1>${esc(b.name)}</h1></div>
        <span class="bd-pill bd-pill-light">${icon('heartFilled', 14)} ${b.streak}-day streak</span>
      </header>
      ${greeting ? `<div class="bd-speech-row"><div class="bd-speech bd-speech-home">${esc(greeting)}</div><button type="button" class="bd-link" data-action="talk">Talk</button></div>` : ''}
      <div class="bd-card bd-hero">
        <div class="bd-hero-row">
          <div class="bd-hero-3d" data-face="buddy"><span class="bd-badge">${icon('star', 11)} Bond ${b.level}</span></div>
          <div class="bd-hero-text">
            <b>${esc(b.levelName || `Bond ${b.level}`)}</b>
            <span class="bd-muted">${who} · ${b.snapCount} snaps · ${b.moments.length} of ${b.momentsTotal} moments</span>
            <div class="bd-chips">${b.traits.map((t) => chipHtml(t)).join('')}${b.mystic ? chipHtml('Mystic', 'mystic') : ''}</div>
            <div class="bd-hearts">${hearts}</div>
          </div>
        </div>
        ${meter}
      </div>
      <div class="bd-card-head"><span class="bd-label">${esc(b.name)}'s wishes</span><span class="bd-link">Wishes add extra bond</span></div>
      ${wishPillHtml(b) || '<p class="bd-small bd-muted">A new wish arrives each morning.</p>'}
      <div class="bd-card-head"><span class="bd-label">Wardrobe · ${b.wardrobe.unlocked.filter((u) => WEARABLES.includes(u)).length} of ${WEARABLES.length}</span><a class="bd-link" data-action="ladder">Growth ladder</a></div>
      <div class="bd-items">${wardrobe}</div>
      <div class="bd-card-head"><span class="bd-label">Scrapbook · ${b.photoIds.length}</span><span><a class="bd-link" data-action="diary">Diary</a> <a class="bd-link" data-action="monthly">Idol ladder</a></span></div>
      <div class="bd-book">${book}</div>
      <p class="bd-small bd-center">Not the one? <a class="bd-link" data-action="fresh-egg">Start a fresh egg</a> · ${esc(b.name)} stays in your scrapbook · <a class="bd-link" data-action="recovery">Recovery code</a></p>
    </div>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Snap with ${esc(b.name)}</button>
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
    r.granted ? `+${r.granted} bond` : "Today's ten are done, this one still goes in the book",
    r.wishDone ? `wish done +${r.wishDone.bonus}` : '',
    `${r.bondToday} of ${r.dailyCap} today`,
  ].filter(Boolean).join(' · ')
  return `
    <p class="bd-eyebrow">After the shot</p>
    <div class="bd-speech">${esc(r.line)}</div>
    <div class="bd-chips">${chips}</div>
    <p class="bd-small">${esc(bits)}</p>
    <div class="bd-actions">
      <button type="button" class="bd-btn bd-btn-ghost" data-action="retake">Retake</button>
      <button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="save">Save</button>
    </div>`
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
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="sheet-next">Keep it in the book</button></div>`
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

export function ladderHtml(b: Buddy): string {
  const rows = b.ladder.map((r) => {
    const done = b.level >= r.level
    const isNext = b.next?.level === r.level
    return `<div class="bd-step${done ? ' done' : ''}${isNext ? ' next' : ''}">
      <span class="bd-step-dot">${done ? icon('star', 14) : r.level}</span>
      <div class="bd-step-body">
        <b>${esc(r.reward)}</b>
        <small class="bd-muted">${r.unlock ? `Unlocks ${esc(r.unlock)}` : 'Milestone'}</small>
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
        <p class="bd-small">One snap is one bond. Wishes add one or two. Only ${b.dailyCap} snaps count each day, so nobody grinds to Idol in an afternoon.</p>
        <p class="bd-small">Wallet owners skip the egg and start at Hatch with their own Axie.</p>
      </div>
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Snap with ${esc(b.name || 'your Axie')}</button></div>`
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
        <p class="bd-eyebrow">${esc(data.month)} idols · ends in ${days} day${days === 1 ? '' : 's'}</p>
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
        <div class="bd-diary-foot"><span>${b.photoIds.length} photos · ${b.moments.length} moments</span></div>
      </div>
      <div class="bd-card bd-note">${icon('bell', 18)}<p class="bd-small">${esc(d.anniversary || `Next: ${d.next}`)}</p></div>
    </div>
    <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="snap">${icon('camera', 20)} Write the next page</button></div>`
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
