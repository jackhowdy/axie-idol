# Axie Idol LIVE Viewfinder Composer
Minimal Round 1 camera composer with an **alive 3D kit-mascot sticker** (7 cast options).

## Quick start

Install deps, then run the Vite dev server on port 5174 with host binding.
Open the local URL in a browser. Use the build script for production assets.

Exact scripts: see package.json (dev on 5174, build, preview).

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

First deploy: `npx wrangler r2 bucket create axie-idol-uploads`, then `npm run deploy`. Add the deployed origin (workers.dev and later the custom domain) to the Ronin Waypoint allowlist in the Ronin Developer Console or Connect will fail.

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
- The public pack ships 576 of the 606 part/stage/skin variants. The other 30 are built by `scripts/build_missing_parts.py` (run it after the copy script; needs Pillow + numpy): the 24 Nightmare-shiny parts (skin 13) reuse the Nightmare (skin 12) mesh with the dominant texture hue rotated +155 degrees, the rule the pack's own summer/summer-shiny pairs follow; the 6 Agamo parts (skin 2) reuse the normal mesh with a teal/violet palette. These are approximations of the real art and are listed in `public/assets/axie/provenance/derived-parts.json`. The mixer validates the pack against fixed counts, so `src/axie3d.ts` lifts the derived entries out before validation and merges them into the live catalog afterwards.
- Downgrade policy (`downgradeDescriptor`) still applies as a safety net: a part that is not in the catalog falls back to the same part in normal skin, then to stage 1. Never a 2D fallback.
- Group-photo extras that are 3D faces get a transparent snapshot (`snapshotFace`) rendered offscreen once per session.
- Pack: `public/assets/axie/` (git-ignored, ~512 MB, 5,821 files) is copied from the mixer clone with `node scripts/copy-mixer-assets.mjs`. `public/_headers` gives it long cache headers on Cloudflare. First load of a character fetches the manifest (~9 MB) plus ~200 files; later loads are cached.
- Dev previews: `?dev=1` unlocks every face (including golden) and all three photo slots so the tray can be checked without questing.

Rights: the mixer and pack are Sky Mavis assets released for approved Axie projects only (see the mixer's RIGHTS file). This entry is a Vibeathon submission and does not redistribute the pack in git.
