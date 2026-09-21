# Developer notes (history)
These are the working notes kept while the project grew. They describe screens and client modules from the earlier prototype (a feed, quests, a mascot crew, `sticker3d.ts`, `propOverlay.ts`, `roninWaypoint.ts`) that have since been **deleted from the client, and their routes from the server**; the `VITE_BUDDY` flag they mention no longer switches anything in `src/`. The README at the top of the repository is the current description.

## Quick start

Install deps, then run the Vite dev server on port 5174 with host binding.
Open the local URL in a browser. Use the build script for production assets.

Exact scripts: see package.json (dev on 5174, build, preview).

## One Axie (R1)

Round 1 is a single-Axie game, not a feed. Under the flag the legacy Feed / Ladder / Crew screens,
the tab bar, the onboarding card and the crew and prop trays are unreachable; the camera tray holds
the buddy's wardrobe and (from bond 5) the photo frames instead.

**The loop**

1. You find an egg. Taking photos with it is the only thing that grows it.
2. Five photos in, it hatches into a wild Axie nobody else has — you name it, it says three lines.
3. Every snap is one bond and the day's wish adds one or two, up to ten bond a day, no further.
4. Each level unlocks something: in R1 the worn items and the Mystic glow change the photo, the
   pose and trick levels are labels for now (see the ladder table below).
5. Bond earned this month ranks you on the monthly Idol ladder; the month's Idol wears the crown.

Own an Axie on Ronin? Sign a message and it skips the egg, starting at bond level 1 with a badge.

**Growth ladder** (`LADDER` in `server/buddyRules.mjs` — the server is the authority on unlocks)

| Level | Bond | Reward | Unlocks |
|-------|------|--------|---------|
| 1 | 5 | Name and party hat | `hat` |
| 2 | 10 | Scarf | `scarf` |
| 3 | 16 | Shades ("Good friends") | `shades` |
| 4 | 24 | Signature pose * | `pose-1` |
| 5 | 34 | Cape and frames | `cape` |
| 6 | 46 | First trick * | `trick-1` |
| 7 | 60 | Crown ("Best friends") | `crown` |
| 8 | 76 | Second trick * | `trick-2` |
| 9 | 95 | Sparkle trail * | `trail` |
| 10 | 120 | Mystic glow and Idol card ("Idol") | `glow` |

\* label only in R1, animation rewards land in R2. The four starred levels grant the unlock and show
on the ladder, but nothing about the character changes yet. Levels 1, 2, 3, 5 and 7 are worn items
that really appear in the photo, and level 10's Mystic glow is a real effect in the live view and in
the capture.

Ten bond a day is the cap, so the 120 bond to Idol is twelve days of hitting the cap every single
day, and a few weeks at any realistic pace. Buddy posts are rate limited at
40/hour per device (legacy posts stay at 10) — the extra snaps past the daily cap still go in the
scrapbook, they just earn no bond. A post only counts as a buddy post when the caller actually has
an active buddy; the flag alone does not buy the higher ceiling.

The state-creating buddy routes share a second per-device hourly bucket: `egg` and `retire` 5/hour,
`/api/account/recovery` and `/api/account/recover` 10/hour, `/api/ronin/nonce` and
`/api/ronin/verify` 20/hour, each answered with a 429 and a `limit`. One account holds at most 20
Axies; past that `egg` and `retire` answer 409.

**Flags**

- `VITE_BUDDY=1` — client. Baked in at build time; the buddy screens replace the feed as the app.
- `BUDDY` — server (`wrangler.toml` `[vars]`, or the environment for `node server.mjs`). Default on;
  set it to `0` to turn the buddy endpoints off.

**Endpoints** (all keyed by `X-Device-Key`, or `X-Buddy-Session` after a Ronin sign-in)

| Endpoint | What it does |
|----------|--------------|
| `GET /api/buddy` | The account: active buddy, retired ones, today's wish and greeting |
| `POST /api/buddy/egg` | Start a fresh wild egg |
| `POST /api/buddy/hatch` | Hatch the egg under a name; returns the three personality lines |
| `POST /api/buddy/claim` | Make an owned Ronin Axie the buddy instead (skips the egg) |
| `POST /api/buddy/retire` | Retire the active Axie into the scrapbook and start a new egg |
| `POST /api/buddy/switch` | Make a retired buddy active again |
| `POST /api/buddy/wear` | Wear a wardrobe item, or `null` to take it off |
| `POST /api/buddy/wish/done` | Mark today's wish done for its bonus bond |
| `GET /api/buddy/before` | The before-the-shot line for the viewfinder |
| `POST /api/buddy/talk` | One conversational reply, answered from the Axie's own memories |
| `GET /api/buddy/diary` | This week's diary pages |
| `GET /api/ladder/monthly` | The monthly Idol ladder plus your own row |
| `GET /api/ronin/nonce`, `POST /api/ronin/verify`, `GET /api/ronin/axies` | Wallet sign-in and inventory |
| `POST /api/account/recovery`, `POST /api/account/recover` | One-shot code to move a guest account to a new phone |

`POST /api/posts` with `buddy: true` is the snap itself: it returns the egg or bond result
(`granted`, `unlocks`, `moments`, `wishDone`) alongside the post.

**Seeding the ladder**

```bash
npm run seed:ladder -- --base http://127.0.0.1:5174 --yes
npm run seed:ladder -- --base http://127.0.0.1:5174 --admin-key <key> --yes   # with a podium
```

Creates eight device accounts, hatches each one, takes 12–40 tiny snaps per account at scattered
coordinates (so places and moments differ), then prints the top of `/api/ladder/monthly`. It refuses
to run without `--yes`. Everything goes over the public API, so point it only at a server you are
happy to fill with fake Axies. The eight device ids are remembered in `scripts/.seed-devices.json`
(git-ignored, keyed by base URL), so re-running tops up the same eight Axies instead of adding
eight more.

`--admin-key <key>` gives the ladder a real podium. Snaps alone cannot: the daily cap of ten bond
applies to seeded accounts too, so without it every seeded Axie ties at ten bond and the script
says so. With it, the script calls the operator-only `POST /api/admin/seed-bond` after hatching to
write a stepped bond per account. That route only exists when the server itself was started with a
matching `ADMIN_KEY` — on the live Worker, `npx wrangler secret put ADMIN_KEY` — and without the
secret, or with the wrong key, it answers the same plain 404 as any unknown route.

**Resetting local state**

```bash
npm run reset:local              # dry run — lists what it would remove
npm run reset:local -- --yes     # removes it
```

Stop `node server.mjs` first (it holds the stores in memory and writes them back). It removes
`data/posts.json`, `data/buddies.json`, `data/castCrew.json` and everything in `data/uploads/`,
and prints each path. Nothing else in `data/` is touched. `DATA_DIR` overrides the directory.

**Resetting the live store**

Redeploying does **not** clear anything: the Worker keeps `buddies` in the same `IdolStore` Durable
Object as `posts`, `castCrew` and the uploaded photos, and a Durable Object outlives every deploy.
Two ways to empty it:

- **Rename the object (recommended).** In `worker/index.mjs`, change both `env.STORE.idFromName('main')`
  calls to a new name (`'main-r1'`, say) and deploy. The Worker then talks to a brand-new Durable
  Object, so every store starts empty. This also empties `posts` and the photos — the old object is
  still there under the old name if you ever need it back.
- **Delete the storage.** Clear the existing object's keys through wrangler's Durable Object storage
  API instead, if you want to keep the same object id.

Either way, clear the browser too: the device key, the recovery code and the chosen photo frame live
in `localStorage`, so a phone that is not cleared walks back in as the same account.

## Phone testing (iPhone Safari)

Phones need a **secure context (HTTPS)** for live `getUserMedia`. Proxy the Vite
port securely (e.g. Cloudflare tunnel), then open in **Safari** (not an in-app browser).

**iPhone flow**
1. Tap **Enable Camera** (live AR viewfinder). Camera + DeviceOrientation permission
   are requested on this tap — iOS requires a user gesture; we do not auto-start on mobile.
2. If the Camera API is missing / blocked, tap **Use iPhone Camera** — opens the
   native camera (`capture="environment"`), returns a still, then place the
   sticker on that photo.
3. Gallery upload (toolbar 🖼️) still works without live camera.

For a true live viewfinder, prefer **Safari + solid HTTPS**. In-app browsers
(WeChat, Instagram, etc.) often hide `mediaDevices`. The on-screen banner shows
`isSecureContext` when the API is unavailable.

Default live camera faces the **world** (`facingMode: environment`) for Idol.

## Controls

Pick a mascot from the **cast tray**, then drag Axie, pinch/scroll to scale,
two-finger or buttons to rotate. Matching weapon auto-highlights in the **prop
tray**; tap any chip to equip/unequip. Props render on a **separate overlay**
(hand-ish default) so you can drag the prop independently. Offset persists while
equipped and resets on unequip. Flip camera (after live stream is on), Capture,
Download, Post (demo). Gyro parallax when available. Capture composites video/
photo + 3D (or PNG) sticker + moved prop into one PNG.

## Assets

- `public/models/mascots/*.glb` — 7 animated kit mascots (Kotaro default; Bing,
  Kibo, Paladill, Pomodoro, Tripp ~7MB, Xia). Loaded **on demand** from the cast
  tray; previous GLB is disposed on switch. Idle preferred. No Sapidae.
- `public/previews/*.png` — cast-tray thumbnails from the same kit.
- `public/stickers/*.png` — still **fallback** if WebGL/GLB fails (Kotaro cutout;
  others use kit previews).
- `public/models/equipment/*.glb` — 7 optional static props. Matching weapon is
  highlighted/auto-equipped per cast; any prop still selectable. On-demand load.

**Rights:** limited Vibeathon / Sky Mavis-approved use only. See `RIGHTS.md`
and `vendor/axie-3d-assets/` (upstream README + RIGHTS + notices).

## Ronin login + owned inventory

**Guests** keep free-cast only (session guest id).

**Connect** (top chrome) — Ronin Waypoint when configured, else paste / injected wallet:
1. Tap **Connect Waypoint** (label when `VITE_WAYPOINT_CLIENT_ID` is set) or **Connect Ronin**.
2. With a client ID, the app calls Waypoint authorize (popup first; scopes openid + wallet) via `@sky-mavis/waypoint`. On success it gets address + token, saves the address (same as today), optionally stores the token in `sessionStorage`, then loads inventory.
3. **iOS Safari:** popups are often blocked. The SDK retries redirect mode with redirectUrl = current page URL. On return, parseRedirectUrl is consumed at boot.
4. If Waypoint is cancelled / errors, or **no client ID** is set, the paste-address modal opens (toast: *Waypoint client ID not configured* when unset). Injected wallet providers still work when Waypoint is unset.
5. Address is saved in `localStorage` (`axieIdol.roninAddress`). A remembered guest id is also stored for free-cast voice while connected.
6. **Inventory** tray loads owned Axies from `/api/inventory` — tap a thumb to use that PNG sticker. Free-cast chips still work.
7. Posts as an owned Axie send `ownerAddress`; server verifies ownership via GraphQL and sets author to `{name} #{id}`.
8. **Disconnect** clears the address + Waypoint token (guest display again); `deviceKey` is kept.

### Developer Console setup (Waypoint)

1. Open Ronin Developer Console (developer.roninchain.com) then your app, then Wallet, Wallet and Authentication, Initialize.
2. Set Origin URI and Redirect URI for local + tunnel:
   - http://localhost:5174
   - your Cloudflare trycloudflare HTTPS URL (same origin as the live composer)
3. Copy CLIENT ID (PROJECT ID) into composer env (never commit the real value).

See composer .env.example for Waypoint env vars.
Rebuild then restart server.mjs after env changes.
iPhone Safari may block popups; redirect fallback is automatic.

## Stack

Vite + vanilla TypeScript + **three** (GLTFLoader). Small WebGL canvas overlaid
on the viewfinder (pixel ratio capped at 2). No backend. Relative asset base for
HTTPS hosting. `allowedHosts: true` on the Vite server for tunnel hostnames.

## Hosting (Cloudflare) and local dev

The API lives in `server/core.mjs` (runtime-agnostic). Two hosts wrap it:

| Host | Command | State | Uploads | Static |
|------|---------|-------|---------|--------|
| Node (local dev) | `npm run build && node server.mjs` | `data/*.json` | `data/uploads/` | `dist/` |
| Cloudflare Worker (production) | `npm run deploy` | one Durable Object (`IdolStore`, SQLite-backed) | R2 bucket `axie-idol-uploads` | Workers static assets from `dist/` |

Local Worker (same code path as production, everything simulated on your machine):

```bash
npm run build
npm run dev:worker          # http://127.0.0.1:8788
```

Tests (12 characterization tests, run against either host):

```bash
npm test                                          # starts node server.mjs on a temp data dir
BASE_URL=http://127.0.0.1:8788 npm test           # against wrangler dev
```

Secrets and variables:

- `.env` (git-ignored) — `VITE_WAYPOINT_CLIENT_ID` (baked into the client at build time) and `SKYMAVIS_API_KEY` (Node host reads it at boot).
- `.dev.vars` (git-ignored) — `SKYMAVIS_API_KEY` for `wrangler dev`.
- Production — `npx wrangler secret put SKYMAVIS_API_KEY`; `SEED_POSTS` lives in `wrangler.toml` `[vars]`.

First deploy: `npx wrangler r2 bucket create axie-idol-uploads`, then `npm run deploy`. The game lives at https://axieidol.com (custom domains on the Worker via `routes` in wrangler.toml; the workers.dev address still answers). Both origins are on the Ronin Waypoint allowlist in the Ronin Developer Console; a new origin must be added there or Connect will fail.

## Screens (field revamp, September 2026)

- **Feed** — global feed with the pinned quest card (next quest, progress, what it unlocks). Cards show the Axie chip (Cast or Owned badge) and the human ("by Guest-XXXX" or the owner name).
- **Snap** — light camera composer. Top: back, quest chip, flip. Bottom: crew tray (locked faces show the level that unlocks them), gallery, adjust, orange shutter.
- **Ladder** — Today / All time, podium with the top climber, a "You" row carrying the same quest card, then rows with level pills.
- **Crew** — guest or owner identity, connect card (guests) or wallet row (owners), the 18-face crew grid with LV tags on locked faces, props, and moments.
- **First minute** — new guests see a one-screen welcome once (`localStorage axieIdol.onboarded`); "Open the camera" goes straight to Snap.
- **Unlock modal** — every cast or prop unlock ends with "Next up: …" and a button that opens Snap with the new cast mate selected.

Known R1 limit: guest "My moments" is filtered client-side from the latest 50 global posts.

## Group photos

From quest level 3 a second squad mate can join a Snap, and from level 7 a third (`squadPhotoSlots()` in `src/groupPhoto.ts`). On Snap, tapping an unlocked face adds it to the photo (tap again to remove; double-tap makes it the lead). Extra squad mates are transparent PNG stickers with their own drag and pinch, composited into the capture after the lead and before the prop. `public/stickers/*.png` for the kit mascots and starters are transparent renders of the official GLBs.

## Animated 3D Axies (mixer)

Every face on Snap is an animated 3D model. The seven starter mascots use the official kit GLBs in `public/models/mascots/`. Everything else (the numeric cast Axies, Olek, the Agonia Echo villain, the Golden Axie, and any owned Axie from a linked Ronin wallet) is assembled at runtime by the Three.js Axie Mixer 3D public alpha (`vendor/axie-mixer3d`, wrapped in `src/axie3d.ts`).

- Genes for a numeric Axie come from `GET /api/axie/:id` (Sky Mavis gateway, cached server-side in the `axies` store).
- Olek, the villain and the golden face are descriptors in `src/castDescriptors.ts` (Olek is a creator-built stand-in; the villain is the Nightmare showcase set on a dark spiky body; golden is the villain under a gold material).
- Genes do not carry part stage and the mixer decoder emits every part at stage 1, so `/api/axie/:id` also returns the marketplace stage per slot and the client applies it (all Nightmare and Nightmare-shiny parts are stage 2). Nightmare-body Axies use the pack's white `<class>-nightmare` palette on the normal body, as the mixer's own showcase does; the pack has no Nightmare body mesh, so `addNightmareSpikes` adds eight curved class-coloured toon thorns (crown, flanks, low front, rear) on an ellipsoid fitted from the part joints, parented to the spine bone so they follow the idle animation. The body shader skins in its own space, so mesh vertices cannot be read back for placement.
- Render look follows the mixer demo: neutral tone mapping, hemisphere plus warm key plus camera-side fill (so white Nightmare bodies read white), the mixer's `MysticGammaCompositor` for Mystic parts' transparent streams, and a front-left three-quarter camera framed on the real bounds, matching the angle of Sky Mavis's 2D art.
- The public pack ships 576 of the 606 part/stage/skin variants. The other 30 are built by `scripts/build_missing_parts.py` (run it after the copy script; needs Pillow + numpy): the 24 Nightmare-shiny parts (skin 13) reuse the Nightmare (skin 12) mesh and take their colours from Sky Mavis's own marketplace part icons: the normal and shiny icons of each part are aligned, the paint is clustered, and each cluster's hue/saturation/value change is applied to the S12 texture, so accents (yellow drips, teal ribbons, orange eyes that stay orange) carry over (icons are fetched into `scripts/.cache/parts/`, git-ignored); the 6 Agamo parts (skin 2) reuse the normal mesh with a teal/violet palette. These are approximations of the real art and are listed in `public/assets/axie/provenance/derived-parts.json`. The mixer validates the pack against fixed counts, so `src/axie3d.ts` lifts the derived entries out before validation and merges them into the live catalog afterwards.
- Japan parts: the public pack ships stage-2 Japan assets only for the japan-02 set (Yen, Karimata, Dango, Umaibo, Hamaya, Koinobori) and points every other stage-2 Japan slot at those files, while the real stage-2 art for the japan-01 and japan-03 sets sits under the normal skin of the same variant; Kawaii shares Cute Bunny's art. `PART_ASSET_OVERRIDES` in `src/axie3d.ts` maps those 13 ids to the asset that matches the marketplace icons (verified part by part with isolated renders, front and rear).
- Agamo (skin 2) parts are the Bionic parts of the three Agamogenesis Axies, which are cast Axies #4154, #4155 and #4156 (5H04L-5T4R, 1ND14N-5T4R, P4R451T3). Their colours are learned from the marketplace icons the same way as the shinies; the meshes are the normal counterparts (Shoal Star, Indian Star, Parasite), so the mechanical shapes are approximated.
- Mystic body: Sky Mavis draws every Axie with at least one Mystic part (and a non-Nightmare body) with a white mechanical casing over the rear half of the body. The pack has no such mesh, so `addMysticPod` builds a tilted rear half-ellipsoid with a painted texture (diagonal seam, gold port, hatch with the class icon and the Axie's id, pipe bar, rivets), parented to the spine bone. Rendering uses no tone mapping so the pack's toon colours stay as saturated as the 2D.
- Palette-true shading: Sky Mavis's 2D shades the lower body with the palette's `shaded1` colour (lilac-pink on dawn-04, orange on dawn-03), while the pack's V4 shader darkens with one grey multiplier from a fixed view-space light. `applyPaletteShadow` patches the body material's fragment shader: shadow tint = shaded1 / primary1 per channel, light from straight above, softer terminator. Masked eye textures (Papi and five others) get the shader's alpha clip so they draw as lines on the body like the 2D (`clipMaskedEyes`). Stage-2 Japan slots with no asset (Kendama-2, Maiko-2, Mon-2, the japan-03 horn) use the stage-1 mesh enlarged.
- Proportions: the 2D Axie is a squat bean about 1.3x longer than tall with large eyes; the pack body is nearly round. `applyBodyShape` squashes the character (y 0.82, z 1.25) and counter-scales every rigid part so horns, ears and backs keep their shape; `applyFaceScale` enlarges eyes 1.25x and mouths 1.15x about their joints. The camera is a 20-degree lens at 37 degrees yaw, framed on the real bounds. Calibrated against the 2D silhouettes (aspect within ~0.1 across the reference set). Dev hash: `#sy=&sz=&eye=&mouth=&fov=&yawx=&yawy=&dist=`; `?raf=timer` drives frames from timers for QA in a hidden pane.
- QA method: `?dev=1` plus `#face=dev:<part ids>&view=rear` swaps the live face and camera without a reload; `scripts/build_missing_parts.py --sheet out.png` writes icon-vs-texture contact sheets. Reference Axies per class and skin were rendered next to their official 2D art (see docs/superpowers/plans/2026-09-08-mixer3d.md).
- Two pack files were missing from the copy (Mystic Beast back and mouth textures); they are fetched from the public GitHub pack and verified against `content-integrity.json`.
- Downgrade policy (`downgradeDescriptor`) still applies as a safety net: a part that is not in the catalog falls back to the same part in normal skin, then to stage 1. Never a 2D fallback.
- Group-photo extras that are 3D faces get a transparent snapshot (`snapshotFace`) rendered offscreen once per session.
- Pack: `public/assets/axie/` (git-ignored, ~512 MB, 5,821 files) is copied from the mixer clone with `node scripts/copy-mixer-assets.mjs`. `public/_headers` gives it long cache headers on Cloudflare. First load of a character fetches the manifest (~9 MB) plus ~200 files; later loads are cached.
- Dev previews: `?dev=1` unlocks every face (including golden) and all three photo slots so the tray can be checked without questing.

Rights: the mixer and pack are Sky Mavis assets released for approved Axie projects only (see the mixer's RIGHTS file). This entry is a Vibeathon submission and does not redistribute the pack in git.
