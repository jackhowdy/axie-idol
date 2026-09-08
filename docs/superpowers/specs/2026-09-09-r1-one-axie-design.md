# Axie Idol R1: One Axie That Grows With Your Photos

Design spec · 9 September 2026 · Vibeathon R1 submission closes 21 Sep 2026 13:00 UTC.
Companion documents: the mock-up canvas (`design/buddy/`, published as "Buddy Bond") and the Voice Bible (`docs/voice-bible.md`).

## 1. The game in one breath

You get one Axie. It comes into every photo you take. Every photo adds bond, wishes add extra, and bond climbs a ten-level ladder that changes how the Axie looks. The Axie has a personality, talks before and after each shot, reacts to what is in the picture, and writes a diary once a week. A real-time ladder ranks every Axie by bond earned this month, and the leader wears a crown in every photo. Ten photos a day count.

Two ways in: find an egg and hatch a unique wild Axie, or connect a Ronin wallet and pick an Axie you own.

## 2. Scope

**In R1:** egg, hatch, Ronin claim, home, snap, voice (before/after lines), wishes, moments, wardrobe, mystic glow, monthly Idol ladder, talk mode, weekly diary, fresh egg, guest recovery code.

**Out (R2, kept as Vision material):** part evolution, Feed with cheers, Squad as people, Duo pairing, buddy card, shared-space AR, minting wild Axies.

**Existing features hidden behind a flag, not deleted:** the cast/quest ladder (`quests.ts`, `QUEST_DEFS`), the Crew profile, cast follows and NPC cast posts, burns. The wall (`/api/feed`, `/api/board`) stays as the source for "other Axies were here".

## 3. Player flows

### 3.1 Fresh player (wild Axie)
1. First open: "You found an egg." The egg is a 2D sprite with three shell stages. It appears in every photo.
2. Each snap with the egg counts. From 5 snaps the **Hatch now** button is always visible next to the live odds card.
3. Hatch: roll parts (see 5.3), roll personality (5.6), reveal with three spoken lines, then name it. Egg snaps convert to bond (5.1), so a 20-snap egg hatches straight into bond 3.
4. Home is the Axie. One button: Snap.
5. Any time: **Start a fresh egg**. The current Axie is retired to the scrapbook, never deleted. One active Axie.

### 3.2 Owner (Ronin)
1. "Own an Axie? Connect wallet and skip the egg." Ronin Wallet (extension or mobile deep link) signs a nonce message. No transaction.
2. Pick one owned Axie. Personality is derived from ID, class and parts (deterministic). Starts at bond 1 with an OWNED badge in every photo.
3. Owners can switch between their own Axies; each keeps its own bond. Owners can also hatch a wild egg.
4. Ronin sign-in is the account: every Axie under that address, owned or hatched here, is kept forever and follows the player to any device.

### 3.3 Guests
A guest Axie lives on the device (`localStorage` + server record keyed by device key). On hatch the app shows a 12-character recovery code the player can screenshot; entering it on another device moves the Axie. Proper accounts are R2.

## 4. Screens (one per canvas board)

| Screen | Board | Notes |
|---|---|---|
| Egg | Egg.dc.html | Snap count, places, odds ladder, Hatch now / Keep snapping, wallet link |
| Hatch | Hatch.dc.html | Reveal from cracked shell, part chips with rare part starred, three spoken lines, name field with suggest |
| Claim | Claim.dc.html | Wallet bar, owned Axies grid, chosen Axie detail, "signed a message, no gas" note |
| Home | Home.dc.html (Main) | Hero with bond badge, hearts, rarity chip, ladder rank, meter naming next unlock, wishes, wardrobe, scrapbook, Snap button, fresh-egg link |
| Snap | Snap.dc.html | Camera with buddy chip + bond bar, wish pill, wardrobe tray, shutter |
| Voice | Voice.dc.html | Before-shot bubble, "noticed" chips, after-shot reaction card, place line, Save / Retake |
| Moment | Moment.dc.html | Moment found card, rarity %, collection count, next hint |
| Diary | Diary.dc.html | Weekly page, five entries, anniversary card, "read to me" |
| Unlock | Evolve.dc.html (re-skinned) | Celebration screen for ladder steps; evolution content replaced by pose/frame/trick/glow |
| Idol ladder | Idol.dc.html | Podium, rules card, ranked list with rarity and OWNED badges, your row, share card |
| Growth ladder | Ladder.dc.html | All ten levels, rules |
| Personalities | Personality.dc.html | Reference only |

No tab bar in R1. Navigation: Home ↔ Snap, with Diary, Idol ladder and Growth ladder reachable from Home.

## 5. Rules

### 5.1 Bond
- One counted snap = 1 bond. Max 10 counted snaps per local day. Uncounted snaps still save to the scrapbook.
- Wishes: +1 or +2 as labelled, once per day.
- Cheers and any social bonus: none in R1.
- Egg snaps convert 1:1 into bond at hatch, subject to the same daily cap already applied while incubating.

### 5.2 Growth ladder (cumulative bond)

| Level | Bond | Reward |
|---|---|---|
| Egg | 0 | — |
| 1 Hatch | 5 | Name, party hat |
| 2 | 10 | Scarf. Daily wishes begin |
| 3 "Good friends" | 16 | Shades. Scrapbook firsts start counting |
| 4 | 24 | Signature pose |
| 5 | 34 | Cape. Photo frame set |
| 6 | 46 | Trick (shutter animation) |
| 7 "Best friends" | 60 | Crown |
| 8 | 76 | Second trick |
| 9 | 95 | Sparkle trail |
| 10 Idol | 120 | Mystic glow, Idol card, earned fourth trait |

Level thresholds are cumulative bond earned by that Axie. A daily player reaches Idol in roughly a month.

### 5.3 Egg odds (wild Axies only)
Hatch is allowed from 5 snaps. Odds are shown live and cap at 100 counted egg snaps.

| Egg snaps | Guarantee |
|---|---|
| 5 | Common Axie, random class |
| 20 | One rare part guaranteed |
| 50 | Two rare parts; 5% chance of one Mystic part |
| 100 | 15% Mystic chance; keepsake shell in the scrapbook |

"Rare" = bottom quartile of part frequency across marketplace data we already pull (`fetchAxieGenes` cache plus a one-off part-frequency table checked into `data/`). Distinct places visited with the egg (by ~300 m grid) add +1% Mystic chance each, capped at +5%. Body shape is Normal for all wild Axies in R1. Class is random; parts are drawn per slot from that class's pool plus 40% off-class, mirroring real Axies. Colour variant follows class.

### 5.4 Wishes
One per day, chosen from context in this priority: weather (rain, sun after rain, wind), time (golden hour, night), nearby place types (park, harbour, market, temple, peak, MTR), not-yet-done firsts, then trait-flavoured defaults. Wishes never require another player in R1.

### 5.5 Moments (24)
Detected from time of day, weather (free forecast API by district), place type (location), and captioner labels. First list: night owl, rain dancer, golden hour, sea legs (harbour), summit (Peak), market day, temple bell, tram spotter, ferry, first friend (a person in frame), dog, cat, noodles, egg tart, rooftop, fog, wind, sunrise, full moon, fireworks/festival, a new district, three districts in a day, back where it hatched, hundredth snap. Each has a rarity percentage computed from all Axies. Saving a moment gives +2 bond (counts toward the daily cap).

### 5.6 Personality
- Pool of ten traits: Explorer, Homebody, Foodie, Athlete, Goofball, Show-off, Shy, Brave, Dreamer, Collector.
- Each Axie rolls three, no opposites together (Explorer/Homebody, Show-off/Shy). First trait leads the voice.
- Wild Axies roll at hatch, nudged by the egg period: many places → Explorer, long distances between snaps → Athlete, food in many egg photos → Foodie, mostly one spot → Homebody.
- Owned Axies: deterministic from Axie ID + class + parts (seeded hash), so the same Axie always has the same personality.
- Fixed for life. One earned fourth trait at bond 10, chosen from play habits (night snaps → Night owl, group shots → Socialite, many districts → Wanderer).
- Revealed as speech at hatch: three lines, one trait each, chips shown afterwards.

### 5.7 Idol ladder
- Real-time ranking by bond earned in the current calendar month (UTC+8). Resets on the 1st; the month's leader keeps a crown in every photo until the next month ends.
- Shows name, class, rarity percentile, OWNED badge, trait chips. Your row always visible with the gap to the next tier.
- Optional all-time tab if trivial. Seeded with a handful of real Axies before the demo so day one is not empty.

### 5.8 Names
Player-chosen, 2–16 characters, word filter (server side, same list as post moderation). Names appear on the ladder. A suggest button draws from a small name list per class.

## 6. The voice

Authority: `docs/voice-bible.md`. Summary of the system:
- **Layer 1, line library**: written lines per trait × situation with slots ({name}, {place}, {thing}, {weather}, {count}, {days}). Ships in R1, costs nothing, works offline.
- **Layer 2, model lines**: later, on the free Gemini tier, with the bible as system prompt and one JSON brief per call. Output that fails the ten rules is discarded and the template speaks.
- **Situations**: hatch, morning, wish, before, after, moment, unlock, bedtime, return, ladder, diary.
- **After-shot reactions**: correction, the app has no image captioner today. In R1 the "noticed" chips come from context only (place type, time, weather, first time here); reactions to what is in the photo arrive with the Gemini free tier later. Wishes and moments that need labels (dog, noodles) stay defined but cannot fire until then.
- **Talk mode**: tap the Axie on Home; typed or spoken; reply ≤ 2 sentences; memory = name, day count, places, moments, wishes done, last photo, and what the player told it. In R1 without a model, talk mode answers from the library by keyword match and falls back to the talk template.
- **Diary**: weekly, Friday evening, five entries from the app's own records. In R1 assembled from templates + captioner labels; model-written later.
- No pushes 22:00–08:00. English only.

## 7. Data model (server, Durable Object)

```
Buddy {
  id, ownerKey (ronin:<address> | device:<key>), kind: 'wild' | 'owned',
  axieId?           // owned
  genes/parts       // wild: parts per slot, class, colorVariant
  name, traits[3], earnedTrait?, createdAt, hatchedAt?, retiredAt?
  egg: { snaps, places[], distanceKm, foodSnaps }   // while incubating
  bond, bondToday, lastCountedDay, wishToday: { id, done }, streak
  wardrobe: { unlocked[], worn }
  moments: [{ id, at, photoId }]
  places: [{ grid, first, count }]
  scrapbook: [photoId], firsts: { ... }
  monthly: { yyyymm, bond }
}
Account { ownerKey, recoveryCode?, buddies[], activeBuddyId }
```

Photos stay in the existing posts store; a post gains `buddyId`, `bondCounted`, `labels[]`, `placeGrid`, `momentId?`.

## 8. API (additions)

- `POST /api/buddy/egg` create egg · `POST /api/buddy/hatch` (returns parts, traits, three lines) · `POST /api/buddy/claim` (signed message + axieId) · `GET /api/buddy` (active + list) · `POST /api/buddy/retire` · `POST /api/buddy/switch`
- `POST /api/buddy/snap` (photo id, labels, place, time) → bond delta, moment?, unlock?, lines
- `GET /api/buddy/wish` · `POST /api/buddy/wish/done`
- `GET /api/ladder/monthly` · `GET /api/buddy/diary`
- `POST /api/account/recovery` (issue) · `POST /api/account/recover` (redeem)
- Ronin: `GET /api/ronin/nonce` · `POST /api/ronin/verify` (signature → session), owned Axies via existing marketplace GraphQL by owner address.

The server is the authority on bond, odds, traits and unlocks. The client never rolls.

## 9. Client (reuse)

- 3D character: `axie3d.ts` as is (calibrations kept). Wild Axies render from a parts descriptor; owned from genes via `/api/axie/:id`.
- Props: `propOverlay.ts` already draws sprite props over the character; wardrobe uses it, pinned to projected joints (head, eyes, neck, back).
- Camera, capture, posting: existing Snap path.
- Quest HUD becomes the buddy chip + wish pill.
- `roninWaypoint.ts` stays for later; R1 adds a direct Ronin Wallet provider path (`window.ronin`) with message signing.

## 10. Safety and privacy
- Captioner sees the photo (already true). Diary and talk mode use only app records, never the camera roll.
- Location asked on first snap; everything works without it, minus place bonuses and place moments. Stored as ~300 m grid cells, not raw coordinates.
- Name filter. Report/hide on the wall stays on the backlog.
- The Axie never mentions being a model or a game (bible rule 10).

## 11. Cost
- R1 ships with zero new model calls: line library + templates. The captioner call per photo already exists.
- Later: Gemini free tier for before/after lines, talk mode and the diary, capped at the daily snap limit per buddy.

## 12. Demo and submission
- Hatch now is the demo path; no hidden dev switch.
- Seed one demo account at bond 6 with a full scrapbook, and a seeded monthly ladder.
- Wipe test data (local `data/` and live DO) before the video.
- Write-up sections map to the rubric: Axie Core (unique Axies from real parts, owned Axies with badges), Gameplay (egg → ladder), Vision (R2 row on the canvas), Feasibility (built on the existing app), Docs (this spec, the bible, the canvas).

## 13. Open decisions
- **Art pipeline**: character 3D with 2D sprite wardrobe (recommended) vs. all-2D. Decide after a look at both on a phone.
- Exact 24-moment list and rarity display copy.
- Whether the all-time ladder tab ships.

## 14. Build priority (12 days)
1. Buddy record, egg, hatch (server roll + client reveal), home, snap with bond, line library wired to before/after.
2. Ronin claim, wardrobe on joints, growth ladder unlocks, monthly ladder.
3. Moments, wishes from context, diary from templates, talk mode by keyword, recovery code.
4. Seed, wipe, demo account, video, write-up.

If something slips, it is the diary, then talk mode.
