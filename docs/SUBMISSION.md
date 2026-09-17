# Round 1 submission: copy to paste

Everything the entry form asks for, ready to paste. If a field has a character limit, the shorter
variants are underneath each one.

## Project title

**Axie Idol**

## One-sentence pitch

Hatch an Axie (or bring a real one), take it everywhere in your camera, and keep it happy: it looks
at every photo and talks back about what it actually sees.

- Shorter (under 100 characters): *A pet Axie that lives in your camera, talks about your photos, and needs you to keep it happy.*

## Short description

Axie Idol is a pet game you play with your camera. Your Axie rides along in every photo and answers
with one line about what it really sees, drawn onto the picture. The game is its happiness: photos,
new places, captions, pats, treats and a quick game of catch lift it; time alone wears it down. Get
it to Overjoyed to win the day and build a streak. Play as any real Axie by its number, with its
real parts and Axie Core level. No wallet needed.

- Shorter (under 200 characters): *A pet Axie in your camera. It talks about what it sees in your photos, remembers places, and gets bored if you leave it. Keep it happy to win the day. Any real Axie, no wallet.*

## Full description

**What it is.** Axie Idol turns an Axie into a companion instead of a fighter. You find an egg,
carry it in your camera for five photos, and it hatches into an Axie nobody else has, built from
real Axie parts and classes and shown in 3D with the official Axie Mixer. Or skip the egg and play
as any real Axie by its number: it arrives as its official art, with its six parts by name, its
class and its Axie Core level, and it knows them. A level 60 Beast with a Mystic horn talks like one.

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
- Lose: miss a day and the streak lapses. The Axie never blames you for it. It just wants to go out.

**Growing up.** Every photo builds bond. Ten bond levels unlock a hat, a scarf, shades, a pose, a
cape, tricks, a crown and a Mystic glow, and the bond earned each month ranks every Axie on the
Idol ladder. Photos go in a scrapbook; rare moments (first rain, golden hour, a hundredth photo)
are collected as you find them.

**Axie Core fit.** The whole game is about the Axie itself: real parts, real classes, real
ownership and a reason to care about one Axie for a long time. Real Axies play as themselves from
read-only Sky Mavis data, with no wallet. Ronin sign-in is optional and proves ownership: an owned
Axie is marked as owned, and a visit becomes an owned Axie with everything it earned. Nothing is
minted and nothing is sold. A hatched Axie is a way in: a reason to want a real one.

**Where it goes.** Round 2: new games to play together, duo photos with a friend, part evolution
that follows Axie Core (the same stage two parts, earned by bond), your whole Ronin collection
playable. After the Vibeathon: Axies that stand higher in Axie Core come first, with special props
only they can wear and chat that opens up for them; a social wall to see every Axie out in the
world; ladder seasons; and work with Sky Mavis so time spent here counts for the Axie, the way AXP
does. The roadmap is on the front page of the site.

**Built with.** Vite, TypeScript and three.js in the browser; a Cloudflare Worker with one Durable
Object behind it; 196 automated tests. Built by one person with Claude Code; Google Gemini looks at
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

1. Open https://axieidol.com and press **Find an egg**.
   Or press **Play as any real Axie by its number** and try `2660` to skip the egg.
2. Press **Snap**. Allow the camera, or on a desktop pick a **sample photo** at the bottom of the
   camera. Drag the egg where you want it, press the shutter, then **Post**.
3. Do that five times and the egg can hatch. Give your Axie a name.
4. Take another photo. Your Axie's line comes back drawn on it, and the sheet shows what the photo
   did for its happiness. Try writing a caption: it answers that too.
5. On Home, look at the **Happiness** card. Pat it, give it a **Treat**, and press **Play** for the
   catching game. Get happiness to 90 to win the day (a joy day, +3 bond).
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
