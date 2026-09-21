# Field UI Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Axie Idol client around the six approved mockup ideas (bottom tab bar, light camera theme, pinned quest HUD, unlock modal that names the next quest, first-minute onboarding, Crew screen with identity badges) without touching the server API.

**Architecture:** The client stays a single Vite + vanilla TypeScript app (`index.html`, `src/main.ts`, `src/style.css`). New behaviour goes into three small modules that `main.ts` imports: `src/quests.ts` (static unlock table + helpers), `src/questHud.ts` (renders the pinned quest card from a `CastCrewPayload`), and `src/icons.ts` (inline SVG strings, replacing every emoji glyph). Screens keep their ids so existing handlers keep working; navigation is centralised in one `setActiveTab()` call inside each `showX()` function. The mockups in `design/*.dc.html` are the visual reference: copy their inline values (sizes, radii, colours) rather than inventing new ones.

**Tech Stack:** Vite 6, TypeScript 5.7, vanilla DOM, three.js sticker (unchanged), existing `node:test` API suite (`npm test`), Browser pane for visual verification, `npm run deploy` to workers.dev.

## Global Constraints

- Server API, request bodies and responses do not change. `npm test` (12 tests) must stay green after every task.
- `npm run build` (tsc + vite) must pass after every task. Zero new `any`.
- Tokens are the existing `:root` values in `src/style.css` (`--bg #E8F6FF`, `--surface-soft #DFF5C8`, `--accent #2B8CEE`, `--accent-hot #FF6B2C`, `--success #3ECF8E`, `--text #1A2B3C`, `--muted #5A6F82`, `--border #C5D6E5`, radii 16/20/pill). No new colours.
- Nunito becomes the body font: change `--font-ui` to `"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. The Google Fonts link in `index.html` already loads weights 600/700/800; add 900.
- Screen labels are **Feed, Snap, Ladder, Crew**. The brand string "Axie Idol" appears only in `<title>`, the onboarding kicker, and the noscript text, so a rename is one grep.
- No emoji or dingbat glyphs as icons anywhere in the UI; use `src/icons.ts`.
- Every tap target is at least 44px tall. Bottom bar respects `env(safe-area-inset-bottom)`.
- Locked decisions stay: Kotaro free at L0, 24 levels, seeds off unless `SEED_POSTS=1`, burns UI hidden.
- Deploy with `npm run deploy` at the end of Tasks 2, 5 and 8, then check the live URL on a phone-sized viewport.

---

### Task 1: Icons module and unlock table

**Files:**
- Create: `src/icons.ts`, `src/quests.ts`
- Test: `tests/quests.test.mjs`

**Interfaces:**
- Produces: `icons.ts` exports `ICON: Record<'home'|'camera'|'trophy'|'user'|'heart'|'heartFilled'|'comment'|'lock'|'flip'|'gallery'|'back'|'chevron'|'sword'|'bell'|'rotateL'|'rotateR'|'plus'|'minus', string>` where each value is an inline `<svg>` string (24px grid, `stroke="currentColor"`, `stroke-width="2.2"`, no fill except `heartFilled`). `icon(name, size = 20): string` returns the svg with `width`/`height` set.
- Produces: `quests.ts` exports `UNLOCK_LEVEL: Record<string, number>` (cast ids and prop ids → the level that unlocks them), `unlockLevelFor(id: string): number | null`, and `CAST_ORDER: string[]` (18 cast ids in ladder order, Kotaro first).

- [ ] **Step 1: Write the failing test for the unlock table**

`tests/quests.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNLOCK_LEVEL, unlockLevelFor, CAST_ORDER } from '../src/quests.ts'

test('unlock table matches the R1 quest ladder', () => {
  assert.equal(UNLOCK_LEVEL.kotaro, 0)
  assert.equal(UNLOCK_LEVEL.bing, 1)
  assert.equal(UNLOCK_LEVEL['kotaro-sword'], 2)
  assert.equal(UNLOCK_LEVEL.buba, 14)
  assert.equal(UNLOCK_LEVEL.puffy, 16)
  assert.equal(UNLOCK_LEVEL['agonia-echo'], 24)
  assert.equal(unlockLevelFor('nope'), null)
  assert.equal(CAST_ORDER.length, 18)
  assert.equal(CAST_ORDER[0], 'kotaro')
  assert.equal(CAST_ORDER.at(-1), 'agonia-echo')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test tests/quests.test.mjs`
Expected: FAIL, cannot find module `../src/quests.ts`.

(Node 24 strips TypeScript types natively with that flag. Update `package.json`: `"test": "node --experimental-strip-types --test tests/*.test.mjs"`.)

- [ ] **Step 3: Write `src/quests.ts`**

```ts
/** Level that unlocks each cast face / prop. Mirrors QUEST_DEFS in server/core.mjs (server stays the authority). */
export const UNLOCK_LEVEL: Record<string, number> = {
  kotaro: 0,
  bing: 1,
  'kotaro-sword': 2,
  kibo: 3,
  'bing-cannon': 4,
  paladill: 5,
  'kibo-hammer': 6,
  pomodoro: 7,
  'paladill-axe': 8,
  tripp: 9,
  'pomodoro-staff': 10,
  xia: 11,
  'tripp-sword': 12,
  'xia-axe': 13,
  buba: 14,
  olek: 15,
  puffy: 16,
  '4154': 17,
  '4155': 18,
  '4156': 19,
  '991': 20,
  '35': 21,
  '1367': 22,
  '2660': 23,
  'agonia-echo': 24,
}

export const CAST_ORDER: string[] = [
  'kotaro', 'bing', 'kibo', 'paladill', 'pomodoro', 'tripp', 'xia',
  'buba', 'olek', 'puffy', '4154', '4155', '4156', '991', '35', '1367', '2660', 'agonia-echo',
]

export function unlockLevelFor(id: string): number | null {
  const n = UNLOCK_LEVEL[id]
  return typeof n === 'number' ? n : null
}
```

- [ ] **Step 4: Write `src/icons.ts`**

```ts
const P = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'

const RAW: Record<string, string> = {
  home: `<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`,
  camera: `<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>`,
  trophy: `<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3a2 2 0 0 1-2 4M7 6H4a2 2 0 0 0 2 4"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,
  heart: `<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>`,
  comment: `<path d="M4 5h16v11H9l-5 4z"/>`,
  lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  flip: `<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/>`,
  gallery: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>`,
  back: `<path d="M15 6l-6 6 6 6"/>`,
  chevron: `<path d="M9 6l6 6-6 6"/>`,
  sword: `<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>`,
  bell: `<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>`,
  rotateL: `<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>`,
  rotateR: `<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  minus: `<path d="M5 12h14"/>`,
}

export function icon(name: keyof typeof RAW | string, size = 20): string {
  const body = RAW[name] || RAW.chevron
  const attrs = name === 'heartFilled'
    ? 'fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"'
    : P
  const d = name === 'heartFilled' ? RAW.heart : body
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs} aria-hidden="true">${d}</svg>`
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: 13 tests PASS (12 API + 1 quests).

- [ ] **Step 6: Commit**

```bash
git add src/icons.ts src/quests.ts tests/quests.test.mjs package.json
git commit -m "feat(ui): icons module and client unlock table"
```

---

### Task 2: Bottom tab bar and screen navigation

**Files:**
- Modify: `index.html` (add `<nav id="tabbar">` before `</div>` of `#app`; add `900` to the Nunito link weights; retitle headers)
- Modify: `src/style.css` (`:root --font-ui`, tab bar styles, screen bottom padding)
- Modify: `src/main.ts` (`setActiveTab`, wiring in `showFeed`, `showBoard`, `showProfile`, `showViewfinderFromFeed`, `hideAllScreens`)

**Interfaces:**
- Produces: `type TabName = 'feed' | 'snap' | 'ladder' | 'crew'`; `function setActiveTab(tab: TabName | null): void` (null hides the bar, used on Snap and Preview). `showCrew()` is introduced in Task 7; until then the Crew tab calls `showProfile()`.

- [ ] **Step 1: Markup**

In `index.html`, replace the Nunito link with weights `600;700;800;900`. Immediately before the closing `</div>` of `<div id="app">` (the line before `<div id="img-lightbox"`), insert:

```html
      <nav id="tabbar" class="tabbar" aria-label="Main">
        <button type="button" class="tab" data-tab="feed" aria-current="page">
          <span class="tab-ico" data-icon="home"></span><span class="tab-label">Feed</span>
        </button>
        <button type="button" class="tab tab-snap" data-tab="snap">
          <span class="tab-shutter" data-icon="camera"></span><span class="tab-label">Snap</span>
        </button>
        <button type="button" class="tab" data-tab="ladder">
          <span class="tab-ico" data-icon="trophy"></span><span class="tab-label">Ladder</span>
        </button>
        <button type="button" class="tab" data-tab="crew">
          <span class="tab-ico" data-icon="user"></span><span class="tab-label">Crew</span>
        </button>
      </nav>
```

Change the three screen titles: `#feed .feed-title` text to `Feed`, `#board-title` to `Ladder`, `#profile .feed-title` to `Crew`. Hide the now-redundant header buttons by adding the `hidden` attribute to `#btn-feed-back`, `#btn-to-board`, `#btn-feed-to-profile`, `#btn-board-back`, `#btn-profile-back`, `#btn-to-feed`, `#btn-to-profile` (their click handlers in `main.ts` stay; the tab bar becomes the way to move).

- [ ] **Step 2: Styles**

Append to `src/style.css`:

```css
/* ===== Field revamp: tab bar ===== */
.tabbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  height: calc(70px + var(--safe-bottom));
  padding: 0 8px var(--safe-bottom);
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
}
.tabbar[hidden] { display: none !important; }
.tab {
  appearance: none;
  border: 0;
  background: none;
  font: inherit;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--muted);
  cursor: pointer;
}
.tab[aria-current="page"] { color: var(--accent); }
.tab-label { font-family: var(--font-display); font-size: 11px; font-weight: 800; }
.tab-ico svg { width: 24px; height: 24px; }
.tab-snap .tab-label { color: var(--accent-hot); }
.tab-shutter {
  width: 56px;
  height: 56px;
  margin-top: -26px;
  border-radius: var(--radius-pill);
  background: var(--accent-hot);
  border: 4px solid var(--bg-2);
  box-shadow: 0 6px 18px rgba(255, 107, 44, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.tab-shutter svg { width: 26px; height: 26px; }
/* Screens with the bar need room for it */
#feed.screen.active .feed-list,
#board.screen.active,
#profile.screen.active,
#owner.screen.active { padding-bottom: calc(76px + var(--safe-bottom)); }
```

And change `--font-ui` in `:root` to `"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

- [ ] **Step 3: Wire it in `main.ts`**

Near the other DOM refs (after `const ownerScreen = ...`), add:

```ts
import { icon } from './icons'

type TabName = 'feed' | 'snap' | 'ladder' | 'crew'
const tabbar = document.querySelector<HTMLElement>('#tabbar')!

function setActiveTab(tab: TabName | null): void {
  if (!tab) {
    tabbar.hidden = true
    return
  }
  tabbar.hidden = false
  for (const b of tabbar.querySelectorAll<HTMLButtonElement>('.tab')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  }
}

// Paint icons once
for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  el.innerHTML = icon(el.dataset.icon || 'chevron', el.classList.contains('tab-shutter') ? 26 : 24)
}

tabbar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab')
  if (!b) return
  const t = b.dataset.tab as TabName
  if (t === 'feed') void showFeed('global')
  else if (t === 'snap') showViewfinderFromFeed()
  else if (t === 'ladder') void showBoard()
  else if (t === 'crew') void showProfile()
})
```

Then add one line to each screen function, right after its `hideAllScreens()` call:
- `showFeed`: `setActiveTab('feed')`
- `showBoard`: `setActiveTab('ladder')`
- `showProfile` (after the `if (!roninAddress) ...` guard for now): `setActiveTab('crew')`
- `showViewfinderFromFeed`: `setActiveTab(null)`
- `openOwnerHouse` / `loadOwnerHouse` (whichever calls `hideAllScreens`): `setActiveTab('feed')`
- The function that shows `#preview` after capture (search `previewScreen.hidden = false`): `setActiveTab(null)`

- [ ] **Step 4: Build, run tests, check in the browser**

```bash
npm run build && npm test
```

Then `node server.mjs`, open http://localhost:5174 at 375px wide and confirm with `read_page`: the tab bar is present with four tabs; clicking Ladder shows `#board`; clicking Snap hides the bar and shows `#viewfinder`; clicking Feed returns. Screenshot for the record.

- [ ] **Step 5: Commit and deploy (milestone 1a)**

```bash
git add index.html src/style.css src/main.ts
git commit -m "feat(ui): bottom tab bar (Feed / Snap / Ladder / Crew)"
```

---

### Task 3: Light camera theme on Snap

**Files:**
- Modify: `index.html` (viewfinder top chrome, toolbar icons, camera gate copy)
- Modify: `src/style.css` (viewfinder chrome, cast chips, toolbar, gate)
- Modify: `src/main.ts` (`renderCreateTrays` renders locked faces; toolbar icons)

**Interfaces:**
- Consumes: `icon()` from Task 1, `unlockLevelFor()` from Task 1.
- Produces: `#vf-quest-chip` element (filled by Task 4's HUD), `#btn-vf-back` (returns to Feed).

- [ ] **Step 1: Replace the viewfinder top chrome markup**

Replace the whole `<div class="chrome top">…</div>` block in `#viewfinder` with:

```html
        <div class="chrome top vf-top">
          <button type="button" id="btn-vf-back" class="btn icon vf-round" title="Back to Feed" aria-label="Back to Feed"><span data-icon="back"></span></button>
          <div id="vf-quest-chip" class="vf-quest-chip"><span class="vf-dot"></span><span id="vf-quest-text">Post to unlock Bing</span></div>
          <button type="button" id="btn-flip" class="btn icon vf-round" title="Flip camera" aria-label="Flip camera"><span data-icon="flip"></span></button>
          <div id="auth-bar" class="auth-bar" hidden>
            <p id="guest-badge" class="guest-badge auth-identity" hidden></p>
            <button type="button" id="btn-connect-ronin" class="btn auth-btn" hidden>Bring your Axies</button>
            <button type="button" id="btn-disconnect-ronin" class="btn auth-btn auth-disconnect" hidden>Disconnect</button>
          </div>
          <form id="axie-id-form" class="axie-id-bar" autocomplete="off" hidden>
            <label for="axie-id-input" class="axie-id-label">Axie ID</label>
            <input id="axie-id-input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 90" enterkeyhint="go" />
            <button type="submit" id="btn-axie-id" class="btn secondary axie-id-go">Go</button>
          </form>
        </div>
```

(`#btn-flip` moves up here; delete it from the toolbar. `#auth-bar` keeps its ids so `refreshIdentityChrome()` still finds them, but stays hidden on Snap; the Crew screen becomes the place to connect.)

Replace the bottom chrome's `.toolbar` with:

```html
          <div class="tray-head">
            <span class="tray-label">Your crew</span>
            <button type="button" id="btn-tray-connect" class="tray-link">Bring my Axies</button>
          </div>
          <div class="toolbar vf-toolbar">
            <button type="button" id="btn-upload" class="btn icon vf-round" title="Upload from gallery" aria-label="Upload from gallery"><span data-icon="gallery"></span></button>
            <div class="vf-adjust">
              <button type="button" id="btn-rotate-ccw" class="btn icon vf-round small" title="Rotate left" aria-label="Rotate left"><span data-icon="rotateL"></span></button>
              <button type="button" id="btn-zoom-out" class="btn icon vf-round small" title="Zoom out" aria-label="Zoom out"><span data-icon="minus"></span></button>
              <button type="button" id="btn-zoom-in" class="btn icon vf-round small" title="Zoom in" aria-label="Zoom in"><span data-icon="plus"></span></button>
              <button type="button" id="btn-rotate-cw" class="btn icon vf-round small" title="Rotate right" aria-label="Rotate right"><span data-icon="rotateR"></span></button>
            </div>
            <button type="button" id="btn-capture" class="btn capture" title="Capture" aria-label="Capture"><span class="shutter"></span></button>
          </div>
```

Place `.tray-head` above `#inventory-tray`. Camera gate copy becomes: title `Snap your world`, sub `Enable Camera opens the live viewfinder. Use phone camera takes a still, then you place your Axie.`, buttons `Enable camera` / `Use phone camera`, note `Live viewfinder needs Safari or Chrome over HTTPS. Gallery upload always works.`

- [ ] **Step 2: Styles**

Append to `src/style.css`:

```css
/* ===== Field revamp: light Snap chrome ===== */
#viewfinder { --vf-text: var(--text); --vf-muted: var(--muted); background: var(--bg); }
#viewfinder .chrome.top { background: none; padding: calc(12px + var(--safe-top)) 16px 0; }
#viewfinder .chrome.bottom { background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(10px); border-radius: 24px 24px 0 0; padding: 14px 16px calc(18px + var(--safe-bottom)); }
#viewfinder .brand, #viewfinder .hint, #viewfinder .btn, #viewfinder .cast-chip, #viewfinder .prop-chip, #viewfinder .inv-chip, #viewfinder .cast-name, #viewfinder .prop-name, #viewfinder .inv-name { color: var(--text); }
.vf-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.vf-round { width: 44px; height: 44px; min-width: 44px; padding: 0; border-radius: var(--radius-pill); background: rgba(255, 255, 255, 0.86); border: 0; box-shadow: none; }
.vf-round.small { width: 40px; height: 40px; min-width: 40px; }
.vf-round svg { width: 20px; height: 20px; }
.vf-quest-chip { pointer-events: auto; height: 40px; padding: 0 14px; border-radius: var(--radius-pill); background: rgba(255, 255, 255, 0.86); display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--text); min-width: 0; }
.vf-quest-chip #vf-quest-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vf-dot { width: 8px; height: 8px; border-radius: var(--radius-pill); background: var(--accent-hot); flex: 0 0 auto; }
.tray-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tray-label { font-family: var(--font-display); font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.tray-link { pointer-events: auto; appearance: none; border: 0; background: none; font: inherit; font-weight: 800; font-size: 12px; color: var(--accent); cursor: pointer; min-height: 44px; }
#viewfinder .cast-chip { background: none; border: 0; box-shadow: none; min-width: 60px; height: auto; padding: 0; gap: 4px; }
#viewfinder .cast-thumb { width: 56px; height: 56px; border-radius: var(--radius-pill); background: var(--bg-2); border: 3px solid var(--bg-2); object-fit: cover; }
#viewfinder .cast-chip[aria-pressed="true"] .cast-thumb { border-color: var(--accent-hot); box-shadow: none; }
#viewfinder .cast-chip.is-locked .cast-thumb { opacity: 0.35; filter: grayscale(1); background: var(--bg); }
#viewfinder .cast-chip.is-locked { position: relative; }
#viewfinder .cast-chip.is-locked .cast-lock { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); color: var(--text); }
#viewfinder .cast-chip.is-locked .cast-name { color: var(--muted); }
#viewfinder .cast-name { font-family: var(--font-display); font-size: 11px; font-weight: 800; }
.vf-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 6px; }
.vf-adjust { display: flex; gap: 6px; }
#viewfinder .btn.capture { width: 76px; height: 76px; background: var(--accent-hot); border: 5px solid var(--bg-2); box-shadow: 0 6px 18px rgba(255, 107, 44, 0.4); }
#viewfinder .btn.capture .shutter { width: 52px; height: 52px; border: 3px solid rgba(255, 255, 255, 0.7); background: none; }
#viewfinder .camera-gate { background: rgba(255, 255, 255, 0.92); color: var(--text); border-radius: 20px; }
#viewfinder .camera-gate-title { color: var(--text); font-family: var(--font-display); font-size: 1.25rem; font-weight: 900; }
```

Also delete (or override with `display: none`) the old dark rules under `/* Camera viewfinder: keep translucent dark chrome */` that set `--vf-text: #f7fbff`.

- [ ] **Step 3: `renderCreateTrays` renders all faces with locks**

Replace the cast tray builder inside `renderCreateTrays()`:

```ts
  const castHtml = CAST_MASCOTS.map((c) => {
    const src = castPreviewSrc(c.id)
    const locked = !unlockedCast.has(c.id)
    const pressed = !locked && !customAxieId && activeCast === c.id
    const lvl = unlockLevelFor(c.id)
    const sub = locked && lvl != null ? `Lv ${lvl}` : escapeHtml(c.label)
    return `<button type="button" class="cast-chip${locked ? ' is-locked' : ''}" data-cast="${c.id}" aria-pressed="${pressed ? 'true' : 'false'}" title="${escapeHtml(c.label)}${locked && lvl != null ? ` · unlocks at level ${lvl}` : ''}">
  <img class="cast-thumb" src="${escapeHtml(src)}" alt="" draggable="false" onerror="this.src='/previews/kotaro.png'" />
  ${locked ? `<span class="cast-lock">${icon('lock', 18)}</span>` : ''}
  <span class="cast-name">${sub}</span>
</button>`
  }).join('')
  castTray.innerHTML = castHtml
```

Import `unlockLevelFor` from `./quests`. Replace the `propIcons` emoji map with `icon('sword', 16)` for every prop (the tray shows the prop's short name beside it), and keep locked props out of the tray as today. Wire `#btn-vf-back` to `void showFeed('global')` and `#btn-tray-connect` to `void connectRonin()`. The existing locked-chip click handler already toasts "Keep questing to unlock…"; confirm it still fires for `.is-locked` chips.

- [ ] **Step 4: Build, test, look**

```bash
npm run build && npm test
```

In the browser at 375px: Snap shows the back button, the quest chip, the flip button on a light background, the crew tray with Kotaro in colour and locked faces greyed with `Lv N` labels, the orange shutter. Screenshot.

- [ ] **Step 5: Commit and deploy (milestone 1)**

```bash
git add index.html src/style.css src/main.ts
git commit -m "feat(ui): light field theme on Snap, locked faces in the crew tray"
npm run deploy
```

Open the workers.dev URL at 375px and confirm the same screens.

---

### Task 4: Quest HUD pinned on Feed, Snap and Ladder

**Files:**
- Create: `src/questHud.ts`
- Modify: `index.html` (`<div id="feed-quest-hud">` under the feed header; `<div id="board-you-row">` above `#board-list`)
- Modify: `src/main.ts` (`syncQuestHud()` called from `cacheCastCrew`)
- Modify: `src/style.css`
- Test: `tests/questHud.test.mjs`

**Interfaces:**
- Produces: `questHudHtml(p: QuestHudInput): string` where `QuestHudInput = { level: number; nextQuest: { level: number; description: string; progress: number; target: number; unlockLabel?: string } | null; nextUnlock?: { castId?: string; propId?: string; label?: string } | null; previewSrc: (castId: string) => string }`. Returns the green card HTML, or a "Ladder complete" card when `nextQuest` is null and `level >= 24`.
- Produces: `questChipText(p: QuestHudInput): string` for the Snap chip, e.g. `Post to unlock Bing`, `Leave 1 comment to unlock Kotaro's sword`.

- [ ] **Step 1: Failing test**

`tests/questHud.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { questHudHtml, questChipText } from '../src/questHud.ts'

const base = { level: 1, previewSrc: (id) => `/previews/${id}.png` }

test('HUD shows next quest, progress and unlock', () => {
  const html = questHudHtml({ ...base, nextQuest: { level: 2, description: 'Leave 1 comment', progress: 0, target: 1, unlockLabel: "Kotaro's sword" }, nextUnlock: { propId: 'kotaro-sword', label: "Kotaro's sword" } })
  assert.match(html, /Next: leave 1 comment/)
  assert.match(html, /0 \/ 1/)
  assert.match(html, /unlocks Kotaro's sword/)
  assert.match(html, /width: 0%/)
})

test('HUD progress bar is proportional and capped', () => {
  const html = questHudHtml({ ...base, nextQuest: { level: 3, description: 'Give 10 likes', progress: 12, target: 10 }, nextUnlock: { castId: 'kibo', label: 'Kibo' } })
  assert.match(html, /width: 100%/)
  assert.match(html, /\/previews\/kibo\.png/)
})

test('chip text reads as an instruction', () => {
  assert.equal(questChipText({ ...base, nextQuest: { level: 1, description: 'Make your first post', progress: 0, target: 1, unlockLabel: 'Bing' } }), 'Post to unlock Bing')
  assert.equal(questChipText({ ...base, nextQuest: { level: 2, description: 'Leave 1 comment', progress: 0, target: 1, unlockLabel: "Kotaro's sword" } }), "Leave 1 comment to unlock Kotaro's sword")
  assert.equal(questChipText({ ...base, level: 24, nextQuest: null }), 'Ladder complete')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL, module not found.

- [ ] **Step 3: Write `src/questHud.ts`**

```ts
export type QuestHudInput = {
  level: number
  nextQuest: { level: number; description: string; progress: number; target: number; unlockLabel?: string } | null
  nextUnlock?: { castId?: string; propId?: string; label?: string } | null
  previewSrc: (castId: string) => string
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c)
}

function lowerFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s
}

export function questChipText(p: QuestHudInput): string {
  const q = p.nextQuest
  if (!q) return p.level >= 24 ? 'Ladder complete' : 'Keep questing'
  const unlock = q.unlockLabel || p.nextUnlock?.label || ''
  if (/first post/i.test(q.description)) return unlock ? `Post to unlock ${unlock}` : 'Post to level up'
  return unlock ? `${q.description} to unlock ${unlock}` : q.description
}

export function questHudHtml(p: QuestHudInput): string {
  const q = p.nextQuest
  if (!q) {
    return `<div class="quest-hud is-done"><div class="quest-hud-text"><div class="quest-hud-title">${p.level >= 24 ? 'Ladder complete' : 'Keep questing'}</div></div></div>`
  }
  const pct = Math.max(0, Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100)))
  const unlock = q.unlockLabel || p.nextUnlock?.label || ''
  const castId = p.nextUnlock?.castId || ''
  const thumb = castId
    ? `<img class="quest-hud-thumb" src="${esc(p.previewSrc(castId))}" alt="" />`
    : `<span class="quest-hud-thumb is-prop"></span>`
  return `<div class="quest-hud" role="status">
  <div class="quest-hud-avatar">${thumb}</div>
  <div class="quest-hud-text">
    <div class="quest-hud-title">Next: ${esc(lowerFirst(q.description))}</div>
    <div class="quest-hud-bar"><div class="quest-hud-fill" style="width: ${pct}%"></div></div>
    <div class="quest-hud-sub">${q.progress} / ${q.target}${unlock ? ` · unlocks ${esc(unlock)}` : ''}</div>
  </div>
</div>`
}
```

- [ ] **Step 4: Run the test, then mount the HUD**

`npm test` → PASS.

`index.html`: after `</header>` of `#feed` insert `<div id="feed-quest-hud" class="quest-hud-slot"></div>`; in `#board`, replace `<p id="board-meta" ...>` position so the order is: range tabs, podium, `<div id="board-you-row" class="quest-hud-slot"></div>`, list. Keep `#board-meta` but move it into the header as a right-aligned small text (`Resets midnight PH · 5h 12m`).

`main.ts`: import `{ questHudHtml, questChipText }` and add:

```ts
const feedQuestHud = document.querySelector<HTMLElement>('#feed-quest-hud')
const boardYouRow = document.querySelector<HTMLElement>('#board-you-row')
const vfQuestText = document.querySelector<HTMLElement>('#vf-quest-text')

function questHudInput(): QuestHudInput | null {
  const d = myCastCrew || loadCachedCastCrew()
  if (!d) return null
  return {
    level: d.level ?? 0,
    nextQuest: d.nextQuest || null,
    nextUnlock: d.nextUnlock || null,
    previewSrc: castPreviewSrc,
  }
}

function syncQuestHud(): void {
  const p = questHudInput()
  if (!p) return
  const html = questHudHtml(p)
  if (feedQuestHud) feedQuestHud.innerHTML = html
  if (boardYouRow) boardYouRow.innerHTML = `<div class="you-row"><span class="you-rank">You</span>${html}</div>`
  if (vfQuestText) vfQuestText.textContent = questChipText(p)
}
```

Call `syncQuestHud()` at the end of `cacheCastCrew()` and once in `boot()` after `myCastCrew = loadCachedCastCrew()`. Tapping the feed HUD opens Snap: `feedQuestHud?.addEventListener('click', () => showViewfinderFromFeed())`.

Styles:

```css
.quest-hud-slot { padding: 0 16px 10px; }
.quest-hud { padding: 12px 14px; border-radius: var(--radius-card); background: var(--surface-soft); display: flex; align-items: center; gap: 12px; cursor: pointer; }
.quest-hud-avatar { width: 44px; height: 44px; border-radius: 12px; background: var(--bg-2); display: flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 auto; }
.quest-hud-thumb { width: 40px; height: 40px; object-fit: cover; }
.quest-hud-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.quest-hud-title { font-family: var(--font-display); font-size: 13px; font-weight: 800; }
.quest-hud-bar { height: 6px; border-radius: var(--radius-pill); background: rgba(26, 43, 60, 0.12); overflow: hidden; }
.quest-hud-fill { height: 6px; background: var(--accent); }
.quest-hud-sub { font-size: 12px; font-weight: 700; color: var(--muted); }
.you-row { display: flex; align-items: center; gap: 10px; }
.you-rank { font-family: var(--font-display); font-weight: 900; font-size: 13px; width: 40px; height: 40px; border-radius: var(--radius-pill); background: var(--bg-2); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
```

- [ ] **Step 5: Build, test, look, commit**

```bash
npm run build && npm test
git add src/questHud.ts tests/questHud.test.mjs index.html src/main.ts src/style.css
git commit -m "feat(ui): pinned quest HUD on Feed, Snap chip and Ladder You-row"
```

In the browser: fresh guest sees "Next: make your first post · 0 / 1 · unlocks Bing" on Feed and "Post to unlock Bing" on Snap.

---

### Task 5: Unlock modal names the next quest

**Files:**
- Modify: `src/main.ts` (`showSparkVictory` castFollow and propUnlock branches), `index.html` (`#spark-victory` gets a `#spark-victory-next` line), `src/style.css`

**Interfaces:**
- Consumes: `questChipText()` from Task 4.

- [ ] **Step 1: Markup**

Inside `#spark-victory .spark-victory-card`, after `#spark-victory-sub`, add:

```html
        <p id="spark-victory-next" class="spark-victory-next" hidden><strong>Next up:</strong> <span id="spark-victory-next-text"></span></p>
```

- [ ] **Step 2: Copy and CTA**

In the `castFollow` branch of `showSparkVictory`, replace the kicker/title/body/sub/CTA assignments with:

```ts
    if (sparkVictoryKicker) sparkVictoryKicker.textContent = `LEVEL ${myCastCrew?.level ?? ''} REACHED`.trim()
    if (sparkVictoryTitle) sparkVictoryTitle.textContent = `${label} joined your crew`
    if (sparkVictoryBody) {
      const extra = more.length === 1 ? ` ${castLabelName(more[0]!)} joined too.` : more.length > 1 ? ` Plus ${more.length} more cast mates.` : ''
      sparkVictoryBody.innerHTML = `<strong>${escapeHtml(label)}</strong> follows you now and will show up in your comments.${extra} Take ${escapeHtml(label)} out for a photo whenever you like.`
    }
    if (sparkVictorySub) sparkVictorySub.textContent = guestNeedsSave ? 'Connect Ronin on the Crew tab to keep your crew across devices.' : ''
    const nextP = questHudInput()
    const nextEl = document.querySelector<HTMLElement>('#spark-victory-next')
    const nextTxt = document.querySelector<HTMLElement>('#spark-victory-next-text')
    if (nextEl && nextTxt && nextP && nextP.nextQuest) {
      nextTxt.textContent = questChipText(nextP)
      nextEl.hidden = false
    } else if (nextEl) nextEl.hidden = true
    if (btnSparkVictoryOk) {
      btnSparkVictoryOk.textContent = `Snap with ${label}`
      btnSparkVictoryOk.dataset.snapCast = castId
    }
```

In the existing OK-button handler (search `btnSparkVictoryOk?.addEventListener('click'`), add at the top:

```ts
  const snapCast = btnSparkVictoryOk?.dataset.snapCast
  if (snapCast) {
    delete btnSparkVictoryOk!.dataset.snapCast
    hideSparkVictory()
    showViewfinderFromFeed()
    void selectCast(snapCast as CastId)
    return
  }
```

Do the same "Next up" line in the `propUnlock` branch (title `You unlocked ${label}`, CTA `Equip it on Snap`, which opens Snap and calls `equipProp(propId)`).

Style: `.spark-victory-next { margin: 4px 0 0; padding: 10px 12px; border-radius: 12px; background: var(--bg); font-size: 13px; font-weight: 700; text-align: left; }`.

- [ ] **Step 3: Build, test, verify, commit, deploy (milestone 2a)**

```bash
npm run build && npm test
```

Browser: post as a fresh guest (upload the 1×1 PNG via `#file-input` or use the API then reload); the modal reads "Bing joined your crew", shows "Next up: Leave 1 comment to unlock Kotaro's sword", and its button reads "Snap with Bing" and opens Snap with Bing selected.

```bash
git add index.html src/main.ts src/style.css
git commit -m "feat(ui): unlock modal names the next quest and opens Snap with the new cast mate"
```

---

### Task 6: First-minute onboarding

**Files:**
- Modify: `index.html` (new `<section id="onboard">`), `src/main.ts` (`shouldOnboard()`, `showOnboard()`, boot routing), `src/style.css`

**Interfaces:**
- Produces: `localStorage` key `axieIdol.onboarded = '1'`. `showOnboard()` hides the tab bar.

- [ ] **Step 1: Markup**

Insert as the first `<section>` inside `#app`:

```html
      <section id="onboard" class="screen onboard" aria-label="Welcome" hidden>
        <svg class="onboard-hills" viewBox="0 0 375 200" fill="none" aria-hidden="true">
          <ellipse cx="60" cy="150" rx="190" ry="70" fill="#CDEFB0"></ellipse>
          <ellipse cx="330" cy="170" rx="210" ry="80" fill="#BFE79E"></ellipse>
          <ellipse cx="200" cy="215" rx="260" ry="80" fill="#DFF5C8"></ellipse>
        </svg>
        <div class="onboard-copy">
          <div class="onboard-kicker">AXIE IDOL</div>
          <h1 class="onboard-title">Take Kotaro somewhere today.</h1>
          <p class="onboard-sub">Snap him into your world, post the moment, and the rest of the cast will start following you.</p>
        </div>
        <div class="onboard-hero">
          <img src="/stickers/kotaro.png" alt="Kotaro" class="onboard-kotaro" />
          <div class="onboard-hints">
            <div class="onboard-hint"><span data-icon="lock"></span>Bing · after your first post</div>
            <div class="onboard-hint"><span data-icon="lock"></span>Kibo · 10 likes given</div>
          </div>
        </div>
        <div class="onboard-sheet">
          <button type="button" id="btn-onboard-snap" class="btn primary onboard-cta"><span data-icon="camera"></span>Open the camera</button>
          <button type="button" id="btn-onboard-feed" class="btn secondary onboard-secondary">See what the cast is up to</button>
          <p class="onboard-note">No account needed. Bring your own Axies any time.</p>
        </div>
      </section>
```

- [ ] **Step 2: Styles** (values from `design/Onboarding.dc.html`)

```css
#onboard.screen.active { display: flex; flex-direction: column; background: linear-gradient(180deg, var(--bg) 0%, var(--bg) 55%, var(--surface-soft) 100%); overflow: hidden; }
.onboard-hills { position: absolute; left: 0; top: 46%; width: 100%; height: 200px; }
.onboard-copy { position: relative; padding: calc(56px + var(--safe-top)) 28px 0; display: flex; flex-direction: column; gap: 10px; }
.onboard-kicker { font-family: var(--font-display); font-size: 12px; font-weight: 800; letter-spacing: 0.1em; color: var(--muted); }
.onboard-title { margin: 0; font-family: var(--font-display); font-size: 32px; font-weight: 900; line-height: 1.08; }
.onboard-sub { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--muted); }
.onboard-hero { position: relative; flex: 1 1 auto; display: flex; align-items: flex-end; justify-content: center; }
.onboard-kotaro { width: min(250px, 62vw); height: auto; filter: drop-shadow(0 12px 18px rgba(26, 43, 60, 0.22)); margin-bottom: 8px; }
.onboard-hints { position: absolute; right: 20px; top: 24px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.onboard-hint { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-radius: var(--radius-pill); background: var(--bg-2); box-shadow: var(--shadow); font-family: var(--font-display); font-size: 12px; font-weight: 800; }
.onboard-hint svg { width: 14px; height: 14px; color: var(--muted); }
.onboard-sheet { position: relative; padding: 16px 20px calc(24px + var(--safe-bottom)); display: flex; flex-direction: column; gap: 10px; background: var(--bg-2); border-radius: 24px 24px 0 0; box-shadow: 0 -6px 24px rgba(26, 43, 60, 0.1); }
.onboard-cta { width: 100%; height: 56px; background: var(--accent-hot); font-family: var(--font-display); font-size: 17px; font-weight: 900; gap: 10px; box-shadow: 0 6px 18px rgba(255, 107, 44, 0.35); }
.onboard-secondary { width: 100%; height: 48px; font-weight: 800; }
.onboard-note { margin: 0; text-align: center; font-size: 12px; font-weight: 700; color: var(--muted); }
```

- [ ] **Step 3: Routing in `main.ts`**

```ts
const onboardScreen = document.querySelector<HTMLElement>('#onboard')!
const ONBOARDED_LS = 'axieIdol.onboarded'

function shouldOnboard(): boolean {
  try {
    if (localStorage.getItem(ONBOARDED_LS) === '1') return false
  } catch { return false }
  if (roninAddress) return false
  const lvl = (myCastCrew || loadCachedCastCrew())?.level ?? 0
  return lvl === 0
}

function markOnboarded(): void {
  try { localStorage.setItem(ONBOARDED_LS, '1') } catch { /* ignore */ }
}

function showOnboard(): void {
  hideAllScreens()
  setActiveTab(null)
  onboardScreen.hidden = false
  onboardScreen.classList.add('active')
}

document.querySelector('#btn-onboard-snap')?.addEventListener('click', () => { markOnboarded(); showViewfinderFromFeed() })
document.querySelector('#btn-onboard-feed')?.addEventListener('click', () => { markOnboarded(); void showFeed('global') })
```

Add `onboardScreen.classList.remove('active'); onboardScreen.hidden = true` to `hideAllScreens()`. In `boot()`, replace the final `await showFeed('global')` with `if (shouldOnboard()) showOnboard(); else await showFeed('global')`.

- [ ] **Step 4: Build, test, verify, commit**

Browser with cleared storage: the welcome screen appears; "Open the camera" lands on Snap; reload lands on Feed.

```bash
git add index.html src/main.ts src/style.css
git commit -m "feat(ui): first-minute onboarding for new guests"
npm run deploy
```

---

### Task 7: Crew screen replaces Profile

**Files:**
- Modify: `index.html` (`#profile` section rebuilt), `src/main.ts` (`showProfile` → works for guests; `renderCastCrewStrip` → full 18-face grid with locks; props with locks; guest "My moments"), `src/style.css`

**Interfaces:**
- Consumes: `CAST_ORDER`, `unlockLevelFor`, `icon`.
- Produces: `showProfile()` no longer requires a wallet; the tab bar's Crew tab calls it for everyone.

- [ ] **Step 1: Markup**

Replace `#profile`'s header and strip with:

```html
        <header class="feed-header profile-header">
          <div class="crew-avatar"><span data-icon="user"></span></div>
          <div class="crew-identity">
            <p id="profile-address" class="profile-address">—</p>
            <p id="profile-today-points" class="profile-today-points">Lv 0</p>
          </div>
          <button type="button" id="btn-profile-bell" class="btn icon profile-bell" title="Inbox" aria-label="Notifications"><span data-icon="bell"></span><span id="profile-bell-badge" class="bell-badge" hidden>0</span></button>
        </header>
        <div id="crew-connect-card" class="crew-connect">
          <div class="crew-connect-text">
            <strong>Own Axies on Ronin?</strong>
            <span>Connect once and they join the crew tray. Posts show their real name.</span>
          </div>
          <button type="button" id="btn-crew-connect" class="btn primary crew-connect-btn">Connect</button>
        </div>
        <div id="crew-wallet-row" class="crew-wallet" hidden>
          <span id="crew-wallet-name"></span>
          <button type="button" id="btn-profile-disconnect" class="btn secondary">Disconnect</button>
          <button type="button" id="btn-profile-post" class="btn primary">Snap with an Axie I own</button>
        </div>
```

Keep `#profile-cast-crew` (rename the head to `Crew` + `#profile-cast-crew-count`), add a props block `<div id="crew-props" class="crew-props"></div>` after the grid, and keep the three tabs but relabel `My Axies` / `My moments` / `My ladder`. `#profile-tab-axies` gains `hidden` by default and is shown only when connected.

- [ ] **Step 2: `showProfile` for guests**

Replace the guard at the top of `showProfile()`:

```ts
async function showProfile(): Promise<void> {
  hideAllScreens()
  setActiveTab('crew')
  profileScreen.hidden = false
  profileScreen.classList.add('active')
  const connected = Boolean(roninAddress)
  const connectCard = document.querySelector<HTMLElement>('#crew-connect-card')
  const walletRow = document.querySelector<HTMLElement>('#crew-wallet-row')
  if (connectCard) connectCard.hidden = connected
  if (walletRow) walletRow.hidden = !connected
  profileAddressEl.textContent = connected ? ownerDisplayName(roninAddress) : authorLabel
  const lvl = (myCastCrew || loadCachedCastCrew())?.level ?? 0
  profileTodayPoints.textContent = `Lv ${lvl}`
  renderCastCrewStrip(myCastCrew)
  if (!connected) {
    setProfileTab('posts')
    await loadGuestMoments()
    return
  }
  // existing connected flow continues from `profileAddressEl.title = roninAddress` onward
```

Add `loadGuestMoments()`:

```ts
async function loadGuestMoments(): Promise<void> {
  const list = document.querySelector<HTMLElement>('#profile-posts-list')
  const empty = document.querySelector<HTMLElement>('#profile-posts-empty')
  if (!list || !empty) return
  try {
    const res = await fetch(`/api/feed?guestId=${encodeURIComponent(guestId)}&deviceKey=${encodeURIComponent(deviceKey)}`)
    const data = (await res.json()) as { posts?: FeedPost[] }
    const mine = (data.posts || []).filter((p) => p.authorGuestId === guestId)
    empty.hidden = mine.length > 0
    empty.textContent = 'No moments yet. Snap one with Kotaro.'
    list.innerHTML = mine.map((p) => `<button type="button" class="moment-tile" data-post-id="${p.id}"><img src="${escapeHtml(p.imagePath)}" alt="" loading="lazy" /></button>`).join('')
  } catch {
    empty.hidden = false
  }
}
```

(Guest moments come from the global feed's latest 50 posts filtered client-side. This is a known R1 limit; note it in README.)

Wire `#btn-crew-connect` to `connectRonin()`. `#btn-profile-post` opens Snap with the inventory tray open (existing behaviour).

- [ ] **Step 3: Full crew grid with locks**

Rewrite the face loop in `renderCastCrewStrip`:

```ts
  profileCastCrewGrid.innerHTML = CAST_ORDER.map((id) => {
    const c = CAST_MASCOTS.find((m) => m.id === id)
    if (!c) return ''
    const on = unlocked.has(id)
    const lvl = unlockLevelFor(id) ?? 0
    const src = castPreviewSrc(id)
    const isVillain = id === 'agonia-echo'
    const name = on ? escapeHtml(c.label) : isVillain ? '???' : escapeHtml(c.label)
    return `<div class="crew-slot${on ? ' is-unlocked' : ' is-locked'}${isVillain ? ' is-villain' : ''}" role="listitem" title="${escapeHtml(c.label)}${on ? '' : ` · level ${lvl}`}">
  <div class="crew-face"><img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.src='/previews/kotaro.png'" />${on ? '' : `<span class="crew-lvl">LV ${lvl}</span>`}</div>
  <span class="crew-slot-name">${name}</span>
</div>`
  }).join('')
  if (profileCastCrewCount) profileCastCrewCount.textContent = `${unlocked.size} of ${CAST_ORDER.length}`
  const propsEl = document.querySelector<HTMLElement>('#crew-props')
  if (propsEl) {
    propsEl.innerHTML = EQUIPMENT_PROPS.map((p) => {
      const on = unlockedProps.has(p.id)
      const lvl = unlockLevelFor(p.id) ?? 0
      return `<span class="crew-prop${on ? ' is-unlocked' : ''}">${on ? icon('sword', 16) : icon('lock', 16)}${escapeHtml(p.label)}${on ? '' : ` · Lv ${lvl}`}</span>`
    }).join('')
  }
```

Remove the 🎁 prop tiles and the `profileCastCrewHint` text (the HUD replaces it; leave the element hidden).

Styles (from `design/Crew.dc.html`):

```css
.crew-avatar { width: 52px; height: 52px; border-radius: var(--radius-pill); background: var(--surface-soft); display: flex; align-items: center; justify-content: center; }
.crew-identity { flex: 1 1 auto; min-width: 0; }
.crew-identity .profile-address { margin: 0; font-size: 20px; font-weight: 900; }
.crew-identity .profile-today-points { margin: 0; font-size: 12px; font-weight: 700; color: var(--muted); }
.crew-connect { margin: 0 16px 14px; padding: 12px 14px; border-radius: var(--radius-card); background: var(--bg-2); border: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
.crew-connect-text { flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; font-size: 12px; font-weight: 700; color: var(--muted); }
.crew-connect-text strong { font-family: var(--font-display); font-size: 14px; font-weight: 900; color: var(--text); }
.crew-connect-btn { height: 40px; min-width: 0; padding: 0 14px; font-size: 13px; }
.crew-wallet { margin: 0 16px 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 700; }
.cast-crew-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 0 16px; }
.crew-slot { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.crew-face { position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--radius-card); background: var(--bg-2); border: 2px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.crew-face img { width: 94%; height: 94%; object-fit: cover; }
.crew-slot.is-unlocked .crew-face { border-color: var(--success); }
.crew-slot.is-locked .crew-face img { opacity: 0.3; filter: grayscale(1); }
.crew-slot.is-villain .crew-face { background: var(--text); border-color: var(--text); }
.crew-lvl { position: absolute; left: 0; right: 0; bottom: 0; padding: 3px 0; background: rgba(26, 43, 60, 0.78); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 900; text-align: center; }
.crew-slot.is-villain .crew-lvl { background: rgba(255, 107, 44, 0.9); }
.crew-slot-name { font-family: var(--font-display); font-size: 11px; font-weight: 800; }
.crew-slot.is-locked .crew-slot-name { color: var(--muted); }
.crew-props { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px 0; }
.crew-prop { height: 40px; padding: 0 14px; border-radius: var(--radius-pill); background: var(--bg-2); border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--muted); }
.crew-prop.is-unlocked { border-color: var(--success); color: var(--text); }
.profile-posts-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0 16px; }
.moment-tile { appearance: none; border: 0; padding: 0; border-radius: 12px; overflow: hidden; aspect-ratio: 1; background: var(--surface-soft); }
.moment-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
```

- [ ] **Step 4: Build, test, verify, commit**

Browser as guest: Crew tab shows the guest label, `Lv 0`, the connect card, 18 faces with Kotaro in colour and the rest greyed with LV tags, Agonia Echo as `???` on a dark tile, props all locked, moments empty state. As a connected wallet (paste address `0x4e61563e29a7b84710bab6a422bc865d2bf40b29`): the wallet row replaces the connect card and My Axies loads.

```bash
git add index.html src/main.ts src/style.css
git commit -m "feat(ui): Crew screen for guests and owners with locked faces and props"
```

---

### Task 8: Feed cards with identity badges, and Ladder podium

**Files:**
- Modify: `src/main.ts` (`identityChipHtml` Owned badge; `renderFeed` template; `renderBoard` podium/list; like button icon), `src/style.css`, `index.html` (`#board` header)

**Interfaces:**
- Consumes: `icon()`.

- [ ] **Step 1: Owned badge**

In `identityChipHtml`, replace the `badge` line with:

```ts
  const badge =
    opts.kind === 'cast' ? '<span class="id-chip-badge is-cast">Cast</span>'
    : opts.kind === 'axie' ? '<span class="id-chip-badge is-owned">Owned</span>'
    : ''
```

Styles: `.id-chip-badge.is-cast { background: var(--text); color: #fff; } .id-chip-badge.is-owned { background: var(--success); color: #0e3d2a; }` (both `height: 20px; padding: 0 8px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 800; display: inline-flex; align-items: center;`).

- [ ] **Step 2: Feed card template** (photo first, chips overlaid, actions row)

Replace the article template in `renderFeed` with:

```ts
      return `<article class="feed-card" data-post-id="${p.id}"${seedMark}>
  <div class="feed-card-img-wrap">
    <img class="feed-card-img" src="${escapeHtml(p.imagePath)}" alt="${escapeHtml(p.axieLabel || p.axieId)} post" loading="lazy" />
    <div class="feed-chip-tl">${axieChip}</div>
    <div class="feed-chip-tr">by ${authorChip}</div>
  </div>
  <div class="feed-card-body">
    <p class="feed-caption">${cap}</p>
    <div class="feed-like-row">
      <button type="button" class="btn like-btn${liked ? ' is-liked' : ''}" data-post-id="${p.id}" aria-pressed="${liked ? 'true' : 'false'}">${icon(liked ? 'heartFilled' : 'heart', 18)}<span class="like-count" data-like-count="${p.id}">${p.likes || 0}</span></button>
      <span class="btn comment-count">${icon('comment', 18)}${(p.comments || []).length}</span>
      <span class="feed-spacer"></span>
      <button type="button" class="btn follow-chip" data-follow-axie="${escapeHtml(p.axieId)}">Follow ${escapeHtml(castLabelFor(p.axieId))}</button>
    </div>
    ${burnsHtml}
    ${commentsHtml}
    <form class="comment-form" data-post-id="${p.id}">
      <input type="text" class="comment-input" name="text" maxlength="140" placeholder="Add a comment…" autocomplete="off" enterkeyhint="send" />
      <button type="submit" class="btn comment-submit">Comment</button>
    </form>
  </div>
</article>`
```

Update `toggleLike` where it rewrites the button text (`'♥ Liked'`/`'♡ Like'`) to swap the icon and count instead: `btn.innerHTML = `${icon(liked ? 'heartFilled' : 'heart', 18)}<span class="like-count" data-like-count="${postId}">${likes}</span>``. Wire `.follow-chip` clicks to `toggleFollowCostume(axieId)` (address required; guests get the existing toast). Cast comments render with the Cast badge already via `renderCommentsHtml`.

Styles:

```css
.feed-card { border: 0; }
.feed-card-img-wrap { max-height: none; }
.feed-card-img { max-height: 60vh; object-fit: cover; }
.feed-chip-tl { position: absolute; left: 12px; top: 12px; }
.feed-chip-tr { position: absolute; right: 12px; top: 12px; height: 34px; padding: 0 12px; border-radius: var(--radius-pill); background: rgba(255, 255, 255, 0.92); font-size: 12px; font-weight: 800; color: var(--muted); display: flex; align-items: center; gap: 4px; }
.feed-chip-tl .id-chip { height: 34px; background: rgba(255, 255, 255, 0.92); }
.feed-card-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.feed-caption { font-size: 15px; font-weight: 700; line-height: 1.4; }
.feed-like-row { display: flex; align-items: center; gap: 8px; }
.feed-spacer { flex: 1 1 auto; }
.btn.like-btn, .btn.comment-count { height: 40px; padding: 0 14px; background: var(--bg-2); border: 1px solid var(--border); gap: 6px; font-size: 13px; font-weight: 800; box-shadow: none; }
.btn.like-btn.is-liked { color: var(--accent-hot); }
.btn.like-btn svg { color: var(--accent-hot); }
.btn.follow-chip { height: 40px; padding: 0 12px; background: rgba(43, 140, 238, 0.12); border: 1px solid rgba(43, 140, 238, 0.45); color: var(--accent); font-size: 13px; font-weight: 800; box-shadow: none; }
```

- [ ] **Step 3: Ladder podium and rows**

In `renderBoard`, replace the medal emoji with a place number and a "TOP CLIMBER" tag on rank 1:

```ts
      const tag = place === 1 ? '<span class="board-top-tag">Top climber</span>' : ''
      return `<div class="board-podium-card place-${place}" ...>
  <button type="button" class="board-podium-main" ...>
    ${tag}
    <img class="board-avatar" src="${img}" alt="" loading="lazy" />
    <span class="board-name">${escapeHtml(r.label)}</span>
    <span class="board-step"><span class="board-place">#${place}</span><strong class="board-points">${boardLevelLabel(r)}</strong></span>
  </button>
  ...share button unchanged...
</div>`
```

In the list rows, keep the identity chip and replace `${nextBlurb}` text with `next: ${description}` (already produced by `nextBlurb`, just drop the `L${level}:` prefix) and render `${boardLevelLabel(r)}` inside a green pill (`.board-lvl-pill { height: 28px; padding: 0 10px; border-radius: var(--radius-pill); background: var(--surface-soft); font-weight: 900; font-size: 12px; }`). Board range tabs become a segmented control: `.board-range-tabs { margin: 0 16px 12px; height: 40px; padding: 4px; border-radius: var(--radius-pill); background: var(--bg-2); border: 1px solid var(--border); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; } .board-range-tab { border-radius: var(--radius-pill); font-weight: 800; } .board-range-tab.is-active { background: var(--text); color: #fff; }` with labels `Today` / `All time`. Podium: `.board-podium { margin: 0 16px; height: 210px; border-radius: var(--radius-card); background: linear-gradient(180deg, #CFE9FF 0%, var(--bg) 60%, var(--surface-soft) 61%, #CDEFB0 100%); }` and steps of 76/56/44px in white with `border-radius: 12px 12px 0 0`. `.board-top-tag { height: 22px; padding: 0 10px; border-radius: var(--radius-pill); background: var(--accent-hot); color: #fff; font-size: 11px; font-weight: 900; text-transform: uppercase; }`.

- [ ] **Step 4: Build, test, verify, commit, deploy (milestone 3)**

```bash
npm run build && npm test
```

Browser: a feed card shows the photo with `Kotaro · Cast` top-left and `by Guest-XXXX` top-right, heart and comment counts, a Follow chip; an owned post shows the green Owned badge. Ladder shows the podium with Top climber, the You row, and level pills.

```bash
git add src/main.ts src/style.css index.html
git commit -m "feat(ui): feed cards with identity badges, ladder podium and level pills"
npm run deploy
```

Open the workers.dev URL at 375px; walk Feed → Snap → Ladder → Crew and screenshot each for the submission thumbnail candidates.

---

### Task 9: Sweep leftovers and document

**Files:**
- Modify: `src/main.ts`, `index.html`, `README.md`, `docs/AUDIT-2026-09-05.md`

- [ ] **Step 1: Grep for stale copy and glyphs**

```bash
grep -nE "Idol Points|Daily Climbers|Keep chatting|🥇|🥈|🥉|🔔|🎁|⚔|🖼|🔄|↺|↻|♡|♥|✨" index.html src/main.ts
```

Replace each hit: emoji → `icon()`; "Idol Points" → "level"; "Keep chatting" → "Back to the feed"; `Posted! ✨` → `Posted`. Re-run until the grep is empty.

- [ ] **Step 2: README**

Add a "Screens" section listing Feed, Snap, Ladder, Crew and what each shows, the onboarding rule (`axieIdol.onboarded`), and the guest-moments limitation from Task 7.

- [ ] **Step 3: Final checks and commit**

```bash
npm run build && npm test
git add -A
git commit -m "chore(ui): remove stale Idol Points copy and emoji glyphs; document screens"
npm run deploy
```
