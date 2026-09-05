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
