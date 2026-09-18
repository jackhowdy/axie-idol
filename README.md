# Axie Idol

**Pick a real Axie. Make it a star.** An entry for Axie Vibeathon 2026, Round 1.

Play it: **https://axieidol.com** (phone or desktop, no wallet, no account)

Axie Idol is a pet game. You pick a real Axie (any Axie, by its number, or one you own), it rides
along in your camera, and it talks: one line on every photo, about what it actually sees. The game is to **keep it
happy**. Photos, new places, a caption, a pat, a treat and a game of catch lift its happiness; time alone
wears it down. Get it to Overjoyed and the day is won. Win enough days in a row and it becomes a
Rising Star, a Star, then an Idol. Leave it and it gets bored.

---

## Try it in five minutes

You do not need a phone, a camera or a wallet.

1. Open https://axieidol.com and press **Meet your Axie**. Three real Axies are offered; pick one,
   shuffle for three more, or type a favourite's number (try `2660`). It arrives as itself, with
   its official art, its real parts, its class and its Axie Core level, and it knows them.
2. Give it a nickname or keep its name, then press **Snap**. On a desktop, or if the camera is
   blocked, a **sample photo** row appears in the camera: pick one, drag the Axie where you want
   it, press the shutter, then **Post**.
3. The photo comes back with the Axie's line drawn on it, and the sheet says what the photo did
   for its happiness. Write a caption and it answers that too.
4. On Home, watch the **Happiness** card. Pat it, give it a treat, play catch (tap when the star
   is over your Axie), and take photos of different things.
   Reaching 90 is the win for the day: a joy day, +3 bond, and the start of a streak.
5. The road to Idol is on the Happiness card from the start. `tests/happy.test.mjs` plays
   twenty-one days of it in a second.
6. Losing is slow on purpose: happiness falls 1.5 points an hour, so an Axie left alone is Content
   after a day and Bored after about two. `tests/happy.test.mjs` shows the whole curve in a second.

## Controls and supported devices

| | |
|---|---|
| **Phone** | iPhone Safari 16+, Android Chrome. Tap to shoot, drag the Axie, pinch to resize, two fingers to rotate. |
| **Desktop and tablet** | Chrome, Edge, Firefox, Safari. The game fills the window and the camera runs edge to edge. Webcam, a photo from disk, or the built-in sample photos (a photo of another shape is shown whole over a blurred copy of itself). Mouse drag; the round buttons zoom and rotate. |
| **Not supported** | In-app browsers that hide the camera (some chat apps). The photo upload and the sample photos still work there. |
| **Location** | Optional. If allowed, the Axie knows when it is back somewhere. Refusing changes nothing else. |

Basic play never needs a wallet or an account. A guest gets a recovery code to move to another
phone. Ronin sign-in is optional and only adds: bring an Axie you own, keep your Axies on an account.

## The game

- **Happiness, 0 to 100.** Five moods: Bored, Restless, Content, Happy, Overjoyed.
- **What lifts it:** a photo (+10), new things in it (+5), a new place (+10), today's wish come
  true (+20), a caption on the photo (+3), a pat (+2, five a day), a treat (+8, twice a day), the
  catching game (+3 a star, three stars a game, three games a day), dressing up (+3, once a day).
  The same things photographed again are worth +3; a photo it cannot make out, +2.
- **What wears it down:** time alone, 1.5 an hour.
- **Win:** reach Overjoyed (90). Once a day that pays +3 bond and counts a **joy day**; joy days on
  consecutive days are a streak.
- **The long game, stardom:** 3 joy days in a row make a **Rising Star** (a badge on Home and the
  ladder), 7 a **Star** (a gold star on every photo's speech bubble), and 14 an **Idol** (the Hall
  of Idols, a gold photo frame, its name in gold). A title lasts exactly as long as the streak:
  miss a day and it is a Newcomer again, with the title there to win back. Home shows the road
  from minute one ("1 of 3 joy days in a row to Rising Star").
- **Why an Idol matters:** it cannot be bought, only kept, so every Idol on screen is an Axie being
  cared for right now; everyone sees it (the Hall, gold on the ladder, a gold star on every photo);
  and a title pays: a joy day is worth 3 bond to a Newcomer, 4 to a Rising Star, 5 to a Star and 6
  to an Idol, so the best-kept Axies are the ones that win the month's crown.
- **Lose:** miss a day and the streak lapses; leave it two days and it is Bored. The Axie never
  guilts you for it (a rule of its voice); it just wants to do something.
- **Growth:** every photo builds bond (ten a day count): how close you are, from Just met to
  Soulmates. Ten bond levels unlock a hat, scarf, shades, a pose, a cape, tricks, a crown and a
  Mystic glow. Bond earned this month ranks every
  Axie on the Idol ladder.
- **The voice:** a vision model looks at each photo once and answers in the Axie's character,
  under ten written rules (`docs/voice-bible.md`). Every line is checked against those rules in
  code; a line that fails, or a model that is down, falls back to a hand-written library, so no
  photo ever goes without a line. It remembers places and things it has seen, answers your
  caption, and its mood colours what it says.

## Axie Core fit

Axie Core is the Axie itself: a creature with real parts, a class, a history and an owner, that
gets stronger the more it is cared for. Axie Idol is built on that and nothing else.

- **Every Axie is a real Axie.** The game offers three real, grown Axies to meet (found among the
  twelve million on Ronin), takes any Axie by number, and takes the ones you own. Each is read-only
  from Sky Mavis and shown as its official art (the picture its owner knows), cropped and gently
  animated, with the wardrobe placed on it. Its class, its six parts by name, its special genes,
  its birth year and its **Axie Core level** reach the voice, so a level 60 Beast with a Mystic
  horn talks like one.
- **Ownership matters.** Ronin sign-in proves an Axie is yours; it is marked Owned on Home
  and on the ladder, and a visit becomes an owned Axie with everything it earned.
- **Nothing is minted and nothing is sold.** Playing with an Axie you do not own is a visit; a
  Ronin signature is the only thing that marks one Owned. A visit is a reason to want the real
  thing.
- **Eggs are switched off.** An earlier build let you hatch your own Axie from real parts, drawn
  by the Three.js Axie Mixer. Round 1 ships without it (every Axie is a real one); the code stays
  behind `EGGS=1` / `VITE_EGGS=1`, and Axies hatched before the switch keep working.
- **No wallet to play**, as the rules require.

## Product vision

| Stage | What |
|---|---|
| **Round 1 (live)** | Meet a real Axie (three offered, any by number, your own via Ronin), a nickname, the voice on every photo, memory, happiness (pats, treats, a catching game), stardom (Rising Star, Star, Idol, the Hall of Idols), wishes, growth ladder, scrapbook, monthly Idol ladder. |
| **Round 2** | The official Axie Mixer on screen so each Axie moves as itself, new games to play together, duo photos with a friend, your whole Ronin collection playable, a morning nudge. |
| **After** | Axies that stand higher in Axie Core come first: special props only they can wear, chat that opens up for them, a better place on the social wall. The social wall itself. Ladder seasons. Work with Sky Mavis so time spent here counts for the Axie, the way AXP does. |

The same roadmap is on the front page of the site.

## How it is built

- **Client:** Vite, vanilla TypeScript, three.js. `src/buddyHtml.ts` holds pure HTML renderers
  (unit-tested), `src/buddyScreens.ts` mounts them and handles every action, `src/main.ts` is the
  camera and the composite, `src/axie3d.ts` drives the mixer.
- **Server:** one runtime-agnostic core (`server/core.mjs`) with the game in `server/buddy.mjs`
  and its rules in `server/buddyRules.mjs` (pure, tested). The voice is `server/voiceBrief.mjs`
  (prompts), `server/voiceModel.mjs` (the model call) and `server/voiceLines.mjs` (the library and
  the rule checker).
- **Hosting:** a Cloudflare Worker with one SQLite-backed Durable Object (`worker/`). Locally the
  same core runs under Node with JSON files (`server.mjs`).
- **Why a backend at all:** the voice needs a vision model, and its key cannot live in a browser;
  happiness, bond and the ladder have to be the same on every phone and cannot be edited by the
  player. Everything else is static files.

### Run it

```bash
npm install
cp .env.example .env        # add your own keys; every key is optional
npm run build
npm start                   # http://localhost:5174
npm test                    # 204 tests, no network needed
```

Keys (all optional, all in `.env`, never committed): `GEMINI_API_KEY` for the voice (without it the
written library speaks), `SKYMAVIS_API_KEY` for real Axies by number, `VITE_WAYPOINT_CLIENT_ID` for
Ronin sign-in. The 3D part pack (about 500 MB) is not in the repository: clone
[threejs-axie-mixer3d-public](https://github.com/jaatster/threejs-axie-mixer3d-public) and run
`node scripts/copy-mixer-assets.mjs <path-to-clone>` to copy it into `public/assets/axie/`. It is only used
for Axies hatched while eggs were on; real Axies never need it. More in `docs/DEVELOPMENT.md`.

QA helper: `/?qa2d=2660,80,1234567` draws a contact sheet of real Axies in their official art with
every wardrobe item on, using the production crop and placement code (`src/qa2d.ts`).

## Known issues

- The first 3D Axie on a phone can take 30 to 50 seconds on a cold cache (about 200 files). A 2D
  stand-in shows after 15 seconds and the game is playable meanwhile. Later loads are under a second.
- Losing takes real time (about two days alone). That is the design, but it means a short session
  only ever sees happiness go up.
- The voice model has a daily request cap. Past it, and whenever the model is slow or down, the
  written library speaks instead; those lines are about the Axie, not about what is in the photo.
- Photos are stored inside the Worker's Durable Object. That is fine at hackathon scale and would
  move to object storage before any real launch.
- Real Axies are 2D on purpose: the public 3D mixer is an alpha and its proportions and some part
  variants are not yet faithful enough for an Axie whose owner knows exactly how it looks. The
  official art cannot be animated beyond a breathing motion without a Spine licence.
- A real Axie played by number is a visit, not proof of ownership; several people can play the
  same Axie. Only a Ronin signature marks one Owned.
- Thirty part variants missing from the public mixer pack are approximations built by
  `scripts/build_missing_parts.py` (listed in the pack's `provenance/derived-parts.json`). The six
  Agamogenesis parts use an invented palette because reference art could not be reached.
- The name filter is a short word list. There is no account deletion screen yet: write to the
  address on the submission and the record is removed.
- `src/main.ts` still carries earlier screens (a feed, quests, a crew) that Round 1 hides behind the
  `VITE_BUDDY` flag. They are not reachable in the live game.

## Disclosures

**Entrant.** One person: Jack Howdy. No team, no other contributors.

**AI tools (material use).**
- **Claude Code (Anthropic)** wrote nearly all of the code, tests, prompts, written voice lines,
  site copy and this README, directed and reviewed by the entrant. It also drew the logo and icons
  as hand-written SVG (`public/icon.svg`, `scripts/build-icons.mjs`).
- **Google Gemini 3.5 Flash-Lite** runs inside the live game: it looks at each photo and writes the
  Axie's line. Every line is checked against written rules in code
  before it is shown.
- **Grok (xAI)** produced an earlier prototype of the camera compositor before 5 September 2026
  (see Pre-existing work).
- **AI-generated art:** the "Agonia Echo" villain image under `public/stickers/` and
  `public/previews/` belongs to the earlier prototype and is not reachable in the Round 1 game.

**Pre-existing work.** Before the submission window the entrant had a prototype camera compositor
(an Axie sticker over a camera view, a photo feed, quests). It was handed over on 5 September 2026
and is documented in `docs/AUDIT-2026-09-05.md`. The Round 1 game (meeting real Axies, voice, memory,
happiness, growth, ladder, real Axies, landing page, Worker hosting) was built after that.
Git history shows all of it.

**Starters and dependencies.** Vite, TypeScript, three.js, `@sky-mavis/waypoint` (Ronin sign-in),
`@noble/secp256k1` and `@noble/hashes` (signature checks), `sirv` (local static files), `wrangler`
(deploys; its bundled `sharp` also renders the icons at build time). No game engine and no UI framework.

**Axie assets (Sky Mavis, limited-use permission, see `RIGHTS.md`).**
- Three.js Axie Mixer 3D, public alpha (`vendor/axie-mixer3d/`, with its README, RIGHTS and
  third-party notices) and its part pack.
- Kit mascots and equipment models from the Animated Axie 3D assets (`public/models/`), with
  upstream notices under `vendor/`.
- Axie data (genes, parts, class, level) read-only from the Sky Mavis API.
- No Spine runtime is shipped or used.
- The Axie Idol logo is an original drawing inspired by the Axie Infinity logo's style; it reuses
  none of its letterforms. Axie names, characters and marks belong to Sky Mavis.

**Other assets.** Photos on the site and in the sample row are the entrant's own, except the shop
shelf photo, which is from Pexels under the Pexels licence. The typeface is Nunito (Google Fonts,
SIL Open Font Licence).

**Privacy.** Each photo is sent once to the vision model to find its line. If location is allowed,
only a rough position is kept (a grid of about 300 metres) so the Axie can tell when it is back
somewhere. Photos carry no coordinates. Nothing is
sold and there are no ads.
