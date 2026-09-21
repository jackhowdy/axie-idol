# Round 1 submission: copy to paste

Everything the entry form asks for, ready to paste. If a field has a character limit, the shorter
variants are underneath each one.

## Project title

**Axie Idol**

## One-sentence pitch

The daily prayer, upgraded: instead of pressing a button once a day, you earn the day by playing
with a real Axie, taking it out in your camera, hearing what it says and keeping it happy until it
becomes an Idol.

- Shorter (under 100 characters): *The daily prayer, upgraded: earn the day by playing with a real Axie, not by tapping.*
- Tagline: *Pick a real Axie. Make it a star.*

## Short description

Axie Idol is an upgrade to the daily prayer: the same once-a-day habit, earned by playing with an
Axie instead of pressing a button. It is a pet game you play with your camera. Your Axie rides along in every photo and answers
with one line about what it really sees, drawn onto the picture. The game is its happiness: photos,
new places, captions, pats, treats and a quick game of catch lift it; time alone wears it down. Get
it to Overjoyed to win the day; win days in a row and it becomes a Rising Star, a Star, then an
Idol, for as long as you keep the streak. Every Axie is a real one, with its real parts and Axie Core level. No wallet needed.

- Shorter (under 200 characters): *A pet Axie in your camera. It talks about what it sees in your photos, remembers places, and gets bored if you leave it. Keep it happy to win the day. Any real Axie, no wallet.*

## Full description

**The idea.** Axie players already come back once a day to pray: one tap, and the streak pays.
Axie Idol keeps the habit and replaces the tap with play. The day is earned with a joy day: take
one Axie out and get it to Overjoyed. That counts for a particular Axie instead of an account, its
class and level shape the day, and it needs real photos, each one looked at, so a script cannot do
it. The whole loop is live now and pays bond, titles and the monthly crown. Paying the daily
prayer's own rewards for a joy day needs Sky Mavis, and that is the proposal.

**What it is.** Axie Idol turns an Axie into a companion instead of a fighter. Every Axie in it is
a real Axie. You meet three (found among the millions on Ronin), pick one or shuffle, or type a
favourite's number. It arrives as its official art, with
its six parts by name, its class and its Axie Core level, and it knows them. A level 60 Beast with
a Mystic horn talks like one. Give it a nickname, or keep the name it has on chain.

**The voice.** After every photo the Axie says one line about what is actually in the picture, and
the line is drawn onto the photo as a speech bubble. It names real things it can see, notices when
you are back somewhere, remembers what it saw before, and answers the caption you write. Every
line is checked in code against ten written rules for its character (short, concrete, never guilt,
never a number, never breaking character); if the model is slow or down, a hand-written library
speaks instead, so no photo goes without a line.

**The game: keep it happy.** Happiness runs from 0 to 100 across five moods, Bored to Overjoyed.
- Lifts it: a photo, something new in the photo, a new place, the day's wish coming true, a
  caption, a pat, a treat, dressing it up, and a game of catch (tap when the star is over your Axie).
- Wears it down: time alone, about a point and a half an hour. A day away leaves it Content; two
  days leaves it Bored.
- Win: reach Overjoyed. Once a day that makes a joy day, pays bond, and joy days on consecutive
  days build a streak.
- The long game: 3 joy days in a row make a Rising Star, 7 a Star (a gold star on every photo),
  14 an Idol (the Hall of Idols, a gold frame, its name in gold). A title lasts exactly as long
  as the streak: miss a day and it is a Newcomer again, with the title there to win back.
- Why an Idol matters: it cannot be bought, only kept, so every Idol you see is being cared for
  right now; everyone sees it, on the ladder and on every photo; and a title pays (a joy day is
  worth 3 bond to a Newcomer and 6 to an Idol), so the best-kept Axies win the month's crown.
- Lose: miss a day and the streak lapses. The Axie never blames you for it. It just wants to go out.

**Growing up.** Every photo builds bond. Ten bond levels unlock a hat, a scarf, shades, a pose, a
cape, tricks, a crown and a Mystic glow, and the bond earned each month ranks every Axie on the
Idol ladder. Photos go in a scrapbook; rare moments (first rain, golden hour, a hundredth photo)
are collected as you find them.

**Axie Core fit.** The whole game is about the Axie itself: real parts, real classes, real
ownership and a reason to care about one Axie for a long time. An Axie's class decides what makes
it happiest (water for an Aquatic, sky for a Bird), so the Axie you pick changes where you go. Its
Axie Core level, evolved parts, special genes and birthday are marked on it everywhere and reach
its voice. And fame belongs to the Axie, not to one player: everyone who plays Axie #2660 adds to
the same Axie's name. Real Axies play as themselves from
read-only Sky Mavis data, with no wallet: in this first prototype nothing connects to a wallet at
all, and people pick any real Axie to play with. Bringing your own Axie with Ronin sign-in is built
and switched off; it comes next, and a visit then becomes an owned Axie with everything it earned.
Nothing is minted and nothing is sold. Playing with an Axie you do not own is a visit, and a reason to want
the real thing.

**Where it goes.** Round 2: bring your own Axie with Ronin sign-in; the official Axie Mixer on screen so each Axie moves as itself, new
games to play together, duo photos with a friend, your whole Ronin collection playable. After the Vibeathon: Axies that stand higher in Axie Core come first, with special props
only they can wear and chat that opens up for them; the Axie Wall, the first social layer, where Axies share their
moments and talk to each other in their own voices; ladder seasons; and making it official: a joy day pays the daily prayer's rewards, to the
Axie that earned them. The roadmap is on the front page of the site.

**Built with.** Vite, TypeScript and three.js in the browser; a Cloudflare Worker with one Durable
Object behind it; 207 automated tests. Built by one person with Claude Code; Google Gemini looks at
the photos at run time. Full disclosures, known issues and run instructions are in the README.

## Thumbnail

`public/thumbnail.png` (1280 x 720), also at https://axieidol.com/thumbnail.png.
A smaller copy: `public/thumbnail-640.jpg`. Square icon if one is asked for: `public/icon-512.png`.
Regenerate with `node scripts/build-thumbnail.mjs`.

## Playable game link

https://axieidol.com

Opens directly in a new tab. No sign-in, no wallet, no install. Works on a phone and on a desktop.

## Controls

**Phone (iPhone Safari, Android Chrome)**
- Tap the big button to open the camera; tap the shutter to take the photo; tap Post.
- Drag the Axie to move it. Pinch to resize it. Two fingers to rotate it.
- On Home: tap Pat, Treat or Play; tap the Axie itself to pat it.
- Catch game: tap **Catch!** when the star is over your Axie.

**Desktop (Chrome, Edge, Firefox, Safari)**
- Click the same buttons. Drag the Axie with the mouse; the round buttons zoom and rotate it.
- No camera needed: pick one of the **sample photos** in the camera, or the gallery button to use
  a photo from disk. A webcam works too.

## First-play instructions (about five minutes)

1. Open https://axieidol.com and press **Meet your Axie**. Pick one of the three real Axies
   offered, shuffle for three more, or type a favourite's number (`2660` is a good one).
2. Keep its name or give it a nickname, then press **Hello**.
3. Press **Snap**. Allow the camera, or on a desktop pick a **sample photo** at the bottom of the
   camera. Drag the Axie where you want it, press the shutter, then **Post**.
4. Your Axie's line comes back drawn on the photo, and the sheet shows what the photo did for its
   happiness. Try writing a caption: it answers that too.
5. On Home, look at the **Happiness** card. Pat it, give it a **Treat**, and press **Play** for the
   catching game. Get happiness to 90 to win the day (a joy day, +3 bond). The card shows how many
   joy days in a row are left to the next title.
6. Come back tomorrow: happiness has dropped while you were away. That is the game.

Camera and location permissions are optional. Without the camera, use sample photos; without
location, nothing else changes.

## Repository link

Create the repository (it can stay private) and paste its address here:

`https://github.com/<your-username>/axie-idol`

If it stays private, add the judges' GitHub accounts as collaborators when the organisers name them.

## Also in the repository, in case the form asks

- **Known issues, AI and asset disclosures, pre-existing work, dependencies:** in `README.md`.
- **Supported devices:** in `README.md` under "Controls and supported devices".
