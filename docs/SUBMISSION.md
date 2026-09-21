# Round 1 submission: copy to paste

One section per field on the entry form, in the form's order. Shorter variants sit under a field
where a limit might bite.

## Project title

**Axie Idol**

## Project thumbnail

`public/thumbnail.png` (1280 x 720, 500 KB). Also at https://axieidol.com/thumbnail.png.
Smaller copy: `public/thumbnail-640.jpg`. Square icon, if one is asked for: `public/icon-512.png`.
Regenerate with `node scripts/build-thumbnail.mjs`.

## Short description

*What you will do, and what makes it stand out.*

Axie Idol is the daily prayer, upgraded. Instead of pressing a button once a day, you earn the day
by playing with a real Axie. Pick any Axie on Ronin, no wallet needed, and take it out in your
camera. It looks at every photo and answers with one line about what it actually sees, drawn onto
the picture. Photos, new places, captions, pats, treats and a game of catch make it happier; time
alone wears it down. Get it to Overjoyed and the day is won. Win days in a row and it becomes a
Rising Star, a Star, then an Idol, for exactly as long as you keep the streak.

What stands out: every Axie is a real one, with its real parts, class and Axie Core level; it
talks about your actual photo, not a canned line; and the once-a-day habit is about one particular
Axie and cannot be done by a script.

- Under 300 characters: *The daily prayer, upgraded. Pick any real Axie, take it out in your camera, and hear what it says about what it sees. Keep it happy to win the day; win days in a row and it becomes an Idol. No wallet, plays in the browser.*
- One line: *Pick a real Axie. Make it a star.*

## Product vision

*What this game should become.*

Axie Idol should become the daily reason to open Axie: the place where an Axie is somebody because
someone shows up for it, not because it wins fights.

The first step is to make the upgrade official. Axie players already come back once a day to pray,
one tap, and the streak pays. Here the same habit is a joy day: a real day out with one Axie. We
want a joy day to pay the daily prayer's rewards, to the Axie that earned them. The loop that
earns it is live today; the switch is Sky Mavis's.

Round two brings ownership: sign in with Ronin, bring your own Axie, and its Axie Core level makes
it easier to keep happy; owners see who took their Axie out. The official Axie Mixer puts each
Axie on screen moving as itself, with new games to play together and duo photos with a friend.

After that comes the Axie Wall, the first social layer: Axies share their moments and talk to each
other in their own voices. Axies that stand higher in Axie Core come first, with props only they
can wear and more to say. Then seasons on the Idol ladder, a collectible card for every Idol, and
an installable app.

## How is Axie Core integrated in the game?

The whole game is about one Axie as an individual, which is what Axie Core is for.

- **Every Axie is a real Axie.** The game reads it from Sky Mavis's public data by its number: its
  official art, its six parts by name, its class, its Axie Core level, evolved parts, special
  genes and birth date. None is invented. Eggs and capsules are turned away.
- **Its class changes how you play.** Each of the nine classes loves something different (water
  for an Aquatic, sky and high places for a Bird, machines for a Mech). A photo with that thing in
  it is worth more happiness, so the Axie you pick changes where you take it.
- **Its Axie Core standing is on it everywhere.** A rank word with its level (Rookie, Trained,
  Veteran, Master), how many parts have evolved, its special genes and its birth year show on the
  pick page, the hello screen and its own page.
- **It knows what it is.** Its parts, class, level and age reach its voice: a Master Beast with a
  Mystic horn talks like one, and "My tiny dino tail likes these grey stairs" is a real line from
  testing. On its real birthday it knows, and a photo that day is worth more.
- **Fame belongs to the Axie, not the player.** Everyone who plays Axie #2660 adds to the same
  Axie's joy days, photos and titles. An owner's Axie earns a name while other people play it.
- **The daily habit is per Axie.** A joy day is earned with one particular Axie, so time spent
  here is time spent on that Axie, the way AXP is.
- **No wallet to play**, as the rules require. Nothing is minted and nothing is sold.
- **Next:** Ronin sign-in and ownership are built and switched off for this prototype; they are
  the first thing round two turns on. The roadmap on the front page says how each stage fits Axie
  Core.

## Playable builds

Tick **Browser** only.

It is a web game with no installers. It runs in the browser on Windows, macOS, Android and iOS
(Chrome, Edge, Firefox, Safari), but there is no native build for any of them, so those boxes
stay unticked.

Playable link: **https://axieidol.com** (opens directly in a new tab; no sign-in, no wallet, no install)

## GitHub repository URL

`https://github.com/<your-username>/axie-idol`

The repository can stay private. If it does, add the judges' GitHub accounts as collaborators when
the organisers name them.

## Full review commit SHA

Run this after the final push and paste the 40 characters it prints:

```bash
git rev-parse HEAD
```

It must be the commit that is on GitHub, so push first, then copy it.

## Run notes

**To play (nothing to install).** Open https://axieidol.com. About five minutes:

1. Press **Meet your Axie**. Pick one of the three real Axies, shuffle for three more, or type a
   number (`2660` is a good one).
2. Keep its name or give it a nickname, then press **Hello**.
3. Press **Snap**. Allow the camera, or on a desktop pick one of the **sample photos** at the
   bottom of the camera. Drag the Axie where you want it, press the shutter, then **Post**.
4. The photo comes back with the Axie's line drawn on it, and the sheet says what the photo did
   for its happiness. Write a caption and it answers that too.
5. On its page, use **Pat**, **Treat** and **Play** (tap Catch when the star is over your Axie).
   Reaching 90 happiness wins the day: a joy day. Three in a row make a Rising Star.

**Controls.** Phone: tap, drag the Axie, pinch to resize, two fingers to rotate. Desktop: click,
drag with the mouse, and use the round buttons to zoom and rotate. No camera is needed on a
desktop: use the sample photos or the gallery button.

**Good to know.**
- No wallet, no account, no sign-in. Camera and location are optional.
- The Axie's line takes a few seconds: each photo is looked at once by an AI model (Google
  Gemini). If the model is slow or down, a hand-written line speaks instead, so no photo goes
  without one.
- Happiness falls about a point and a half an hour, so losing takes real time. A short session
  only ever sees it go up; `tests/happy.test.mjs` plays the days forward.
- Your Axies are kept in the browser you picked them in. Clearing site data starts again.
- Ronin sign-in, the diary and chat are switched off in this prototype. "Bring your own Axie" and
  the diary keep their pages, which say they are coming next.
- Real Axies are shown in their official 2D art on purpose; the public 3D mixer is not yet
  faithful enough for an Axie whose owner knows exactly how it looks.

**To run the code.**

```bash
npm install
cp .env.example .env
npm run build
npm start
npm test
```

`npm start` serves http://localhost:5174. `npm test` runs 215 tests with no network. Every key in
`.env` is optional: without `GEMINI_API_KEY` the hand-written lines speak; `SKYMAVIS_API_KEY` is
needed to look up real Axies by number. Production is a Cloudflare Worker with one Durable Object
(`wrangler.toml`).

**Disclosures** (AI use, assets, pre-existing work, dependencies) and the full known-issues list
are in `README.md`. Built by one person with Claude Code.
