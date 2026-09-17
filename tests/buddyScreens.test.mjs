import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eggHtml, hatchHtml, homeHtml, claimHtml, reactionHtml, ladderHtml, monthlyHtml, diaryHtml, momentHtml, unlockHtml, suggestName, vfChipHtml, wishPillHtml, talkHtml, wardrobeTrayHtml, bootErrorHtml, monthLabel, restingRowHtml, dayCount, accountHtml, scrapbookHtml, photoViewHtml, welcomeHtml, eggLine, joyHtml, visitHtml, playHtml, playResultHtml } from '../src/buddyHtml.ts'

const egg = {
  id: 'e', kind: 'wild', hatchedAt: null, createdAt: new Date().toISOString(),
  egg: { snaps: 12, grids: ['a', 'b', 'c', 'd'] },
  eggOdds: { tier: 5, rareParts: 0, mysticChance: 0, nextTier: 20 },
  name: '', traits: [], bond: 0, level: 0, next: null,
  wish: { id: null, text: '', bonus: 1, done: false },
  wardrobe: { unlocked: [], worn: null },
  moments: [], momentsTotal: 24, photoIds: [], photos: [], snapCount: 12, bondToday: 3, dailyCap: 10, streak: 2,
  ladder: [], mystic: false, mysticId: null, rareIds: [], descriptor: null, class: null, axieId: null,
  retiredAt: null, levelName: null, earnedTrait: null,
}
const miso = {
  ...egg,
  hatchedAt: '2026-09-01T00:00:00Z', name: 'Miso', traits: ['Explorer', 'Foodie', 'Goofball'],
  bond: 21, level: 3, levelName: 'Good friends',
  next: { level: 4, bond: 24, reward: 'Signature pose', remaining: 3 },
  wardrobe: { unlocked: ['hat', 'scarf', 'shades'], worn: 'hat' }, class: 'Beast',
}

test('egg screen shows snaps, odds tiers and hatch-now once allowed', () => {
  const html = eggHtml(egg)
  assert.match(html, /12 snaps · 4 places/)
  assert.match(html, /One rare part guaranteed/)
  assert.match(html, /8 to go/)
  assert.match(html, /data-action="hatch-now"/)
  assert.doesNotMatch(
    eggHtml({ ...egg, egg: { snaps: 2, grids: [] }, eggOdds: { tier: 0, rareParts: 0, mysticChance: 0, nextTier: 5 } }),
    /data-action="hatch-now"/,
  )
})

test('home shows the meter naming the next reward and never a game word in the greeting', () => {
  const html = homeHtml(miso, 'New day. New street?')
  assert.match(html, /Miso/)
  assert.match(html, /Good friends/)
  assert.match(html, /3 snaps/)
  assert.match(html, /Signature pose/)
  assert.match(html, /New day\. New street\?/)
  assert.match(html, /data-action="snap"/)
  // the speech bubble carries the line only — no bond/level/snap counters inside it
  const bubble = /<div class="bd-speech bd-speech-home">([\s\S]*?)<\/div>/.exec(html)
  assert.ok(bubble, 'greeting bubble present')
  assert.doesNotMatch(bubble[1], /bond|level|snap|streak/i)
})

test('home locks wardrobe items that are not unlocked yet and names the bond that opens them', () => {
  const html = homeHtml({ ...miso, ladder: [{ level: 5, bond: 34, reward: 'Cape and frames', unlock: 'cape' }] }, null)
  assert.match(html, /data-item="cape"[^>]*disabled/)
  assert.match(html, /Bond 5/)
  assert.match(html, /data-item="hat"/)
})

test('camera wardrobe tray: unlocked items tap to wear, locked ones name the bond and are disabled', () => {
  const ladder = [
    { level: 2, bond: 12, reward: 'Scarf', unlock: 'scarf' },
    { level: 5, bond: 34, reward: 'Cape and frames', unlock: 'cape' },
    { level: 10, bond: 120, reward: 'Crown', unlock: 'crown' },
  ]
  const html = wardrobeTrayHtml({ ...miso, ladder })
  assert.match(html, /data-wear="hat"[^>]*aria-pressed="true"/, 'the worn item reads as pressed')
  assert.doesNotMatch(/<button[^>]*data-wear="hat"[^>]*>/.exec(html)[0], /disabled/)
  assert.match(html, /data-wear="cape"[^>]*disabled/)
  assert.match(html, /Bond 5/)
  assert.match(html, /Bond 10/)
  // unlocked-but-not-worn stays tappable and names the item, never a bond level
  const scarf = /<button[^>]*data-wear="scarf"[\s\S]*?<\/button>/.exec(html)[0]
  assert.doesNotMatch(scarf, /disabled/)
  assert.match(scarf, /Scarf/)
  assert.match(scarf, /aria-pressed="false"/)
})

test('camera wardrobe tray renders the five wearables only, and nothing at all without a hatched buddy', () => {
  assert.equal(wardrobeTrayHtml(null), '')
  assert.equal(wardrobeTrayHtml(egg), '', 'an egg wears nothing')
  // A wardrobe the server has not granted is still drawn locked — the tray never invents unlocks,
  // and an unknown item in `unlocked` cannot add a chip of its own.
  const html = wardrobeTrayHtml({ ...miso, wardrobe: { unlocked: ['hat', '<img src=x>'], worn: null } })
  assert.deepEqual([...html.matchAll(/data-wear="([^"]+)"/g)].map((m) => m[1]), ['hat', 'scarf', 'shades', 'cape', 'crown'])
  assert.doesNotMatch(html, /<img src=x>/)
  assert.doesNotMatch(html, /aria-pressed="true"/, 'nothing worn')
})

test('home offers a way to talk only when talk mode is on', () => {
  assert.doesNotMatch(homeHtml(miso, 'New day. New street?'), /data-action="talk"/, 'off by default')
  assert.doesNotMatch(homeHtml(miso, null), /data-action="talk"/)
  const withGreeting = homeHtml(miso, 'New day. New street?', { talk: true })
  assert.match(withGreeting, /data-action="talk"/)
  const withoutGreeting = homeHtml(miso, null, { talk: true })
  // the "Talk" control (a small bubble naming the Axie plus a "Talk to <name>" link) must
  // still be reachable even with no queued greeting; tapping the Axie itself is a pat
  assert.match(withoutGreeting, /data-action="talk"/)
  assert.match(withoutGreeting, /Talk to Miso/)
  assert.match(withoutGreeting, /<div class="bd-hero-3d" data-face="buddy" data-action="pet"/)
})

test('happiness is the game on Home: hearts, the mood, the goal, a pat and what moves it', () => {
  const happy = { value: 62, mood: 'Content', moodId: 'content', talksLeft: 5, petsLeft: 5, overjoyedToday: false }
  const html = homeHtml({ ...miso, happy, joy: { days: 2, streak: 2, best: 2 } }, null, { talk: true })
  assert.match(html, /bd-happy bd-happy-content/)
  assert.match(html, /Content · 62/)
  assert.match(html, /Get to 90 for a joy day/)
  assert.match(html, /2 joy days in a row/)
  assert.match(html, /data-action="pet"[^>]*>.*Pat Miso/s)
  assert.match(html, /Time alone wears it down/)
  assert.equal((html.match(/bd-heart on/g) || []).length, 3, 'sixty-two is three hearts of five')
  const won = homeHtml({ ...miso, happy: { ...happy, value: 95, mood: 'Overjoyed', moodId: 'overjoyed', overjoyedToday: true, petsLeft: 0 } }, null)
  assert.match(won, /Joy day won/); assert.match(won, /Pat <small>done<\/small>/)
  const care = homeHtml({ ...miso, happy: { ...happy, treatsLeft: 0, playsLeft: 0 } }, null)
  assert.match(care, /data-action="treat" disabled/, 'the jar is empty')
  assert.match(care, /data-action="play"[^>]*>.*for fun/s, 'the game still plays, without points')
  assert.match(html, /data-action="treat">.*2 left/s); assert.match(html, /a treat and a game of catch/)
  assert.doesNotMatch(homeHtml(miso, null), /bd-happy /, 'an older payload without the score still renders')
})

test('the after-the-shot sheet says what the photo did for its happiness, and the win gets its own card', () => {
  const snap = { kind: 'snap', granted: 1, bond: 12, level: 2, next: null, line: 'That slide is so yellow.', labels: ['slide'], isNewPlace: true, wishDone: null, unlocks: [], moments: [], bondToday: 3, snapsToday: 3, dailyCap: 10,
    happy: { delta: 25, value: 91, mood: 'Overjoyed', reasons: ['a photo together', 'something new', 'a new place'], overjoyed: true, joyBonus: 3, joyStreak: 2 } }
  const html = reactionHtml(snap)
  assert.match(html, /\+25 happy/); assert.match(html, /Overjoyed · 91 · a photo together, something new, a new place/)
  const joy = joyHtml(snap.happy, miso)
  assert.match(joy, /Miso is overjoyed/); assert.match(joy, /\+3 bond · 2 joy days in a row/); assert.match(joy, /data-action="sheet-next"/)
})

test('the catching game: a track, a star, a Catch button, and a result that says what it did', () => {
  const g = playHtml(miso, 1, 3, 1)
  assert.match(g, /star 2 of 3/); assert.match(g, /data-play-star/); assert.match(g, /data-action="play-tap"/); assert.match(g, /1 caught/)
  assert.equal((g.match(/<i class="done">/g) || []).length, 1)
  assert.match(playHtml(miso, 1, 3, 1, 'hit'), /Caught!/); assert.match(playHtml(miso, 1, 3, 0, 'miss'), /Missed!/)
  const r = playResultHtml(miso, { line: 'That star had no chance.', catches: 2, rounds: 3, counted: true, happy: { delta: 6, value: 76, mood: 'Happy' } })
  assert.match(r, /2 of 3 caught/); assert.match(r, /That star had no chance/); assert.match(r, /\+6 happy · Happy 76/); assert.match(r, /data-action="play-done"/)
  assert.match(playResultHtml(miso, { line: 'x', catches: 3, rounds: 3, counted: false, happy: { delta: 0, value: 50, mood: 'Content' } }), /for fun/)
})

test('a real Axie played by its number says so, with its Axie Core level; the visit sheet needs no wallet', () => {
  const real = { ...miso, kind: 'visit', axieId: '2660', class: 'Beast', core: { level: 60, birthYear: 2018, breedCount: 1, parts: [] } }
  assert.match(homeHtml(real, null), /Real Axie #2660 · Axie Core level 60/)
  assert.match(hatchHtml(real, ['Hello.']), /Say hello/); assert.match(hatchHtml(real, []), /Real Axie · Beast · Axie Core level 60/)
  assert.match(homeHtml({ ...real, kind: 'owned' }, null), /Owned Axie #2660 · Axie Core level 60/)
  const sheet = visitHtml()
  assert.match(sheet, /id="bd-visit-id"/); assert.match(sheet, /No wallet needed/); assert.match(sheet, /data-action="visit-go" data-id="2660"/)
  assert.match(homeHtml(miso, null), /data-action="visit"/, 'reachable from Home')
})

test('hatch and reaction render the spoken lines', () => {
  assert.match(hatchHtml({ ...egg, name: 'Miso', traits: ['Shy'] }, ['Oh. Hello.']), /Oh\. Hello\./)
  assert.match(
    reactionHtml({ kind: 'snap', granted: 1, bond: 5, level: 1, next: null, line: 'A DOG.', labels: ['dog'], isNewPlace: true, wishDone: null, unlocks: [], moments: [], bondToday: 1, snapsToday: 1, dailyCap: 10 }),
    /A DOG\./,
  )
})

test('hatch asks for a name before hatching and says hello afterwards', () => {
  const naming = hatchHtml({ ...egg }, [])
  assert.match(naming, /data-action="hatch-confirm"/)
  assert.match(naming, /id="bd-name"/)
  const revealed = hatchHtml({ ...miso, descriptor: { colorVariant: 4, body: 'normal', parts: [{ type: 'horn', skin: 2, class: 'Beast', variant: 4, level: 1 }] }, rareIds: ['S02_Beast04_L1_Horn'] }, ['Oh. Hello.'])
  assert.doesNotMatch(revealed, /data-action="hatch-confirm"/)
  assert.match(revealed, /bd-chip-rare/)
  assert.match(revealed, /Beast horn/)
})

test('claim asks for a wallet first, then lists the Axies', () => {
  assert.match(claimHtml([], null, null), /data-action="ronin"/)
  const html = claimHtml([{ id: '6', name: 'Axie #6', class: 'Aquatic' }, { id: '13', name: 'Axie #13', class: 'Plant' }], '6', '0x1234567890abcdef1234567890abcdef12345678')
  assert.match(html, /data-action="select-axie" data-id="13"/)
  assert.match(html, /data-action="pick-axie" data-id="6"/)
  assert.match(html, /Make Axie #6 my buddy/)
  assert.match(html, /2 Axies found/)
})

test('ladder, monthly and diary render their rows', () => {
  assert.match(ladderHtml({ ...miso, ladder: [{ level: 4, bond: 24, reward: 'Signature pose', unlock: 'pose-1' }] }), /Signature pose/)
  const monthly = monthlyHtml({
    month: '2026-09', endsAt: '2026-10-01T00:00:00Z',
    rows: [{ rank: 1, buddyId: 'a', name: 'Bubbles', class: 'Aquatic', kind: 'wild', traits: [], level: 5, monthlyBond: 188, rarity: 0.2 }],
    you: { rank: 1, monthlyBond: 188, toNextTier: 0 },
  })
  assert.match(monthly, /Bubbles/)
  assert.match(monthly, /188/)
  assert.match(diaryHtml({ week: 1, entries: [{ day: 1, dayKey: '2026-09-01', title: 'Found', line: 'Someone picked me up.', photoId: null }], anniversary: null, next: 'I want to see the rain.' }, miso), /Someone picked me up\./)
})

test('moment and unlock cards name what happened', () => {
  assert.match(momentHtml({ id: 'dog', title: 'A dog', line: 'A DOG. Can we keep it?', rarity: 0.4 }, miso), /A dog/)
  assert.match(unlockHtml({ level: 4, reward: 'Signature pose', unlock: 'pose-1', line: 'Watch this.' }, miso), /Signature pose/)
})

test('every renderer escapes user-provided strings', () => {
  const evil = '<img src=x onerror="alert(1)">'
  const b = { ...miso, name: evil }
  for (const html of [homeHtml(b, evil), hatchHtml(b, [evil]), ladderHtml(b), diaryHtml({ week: 1, entries: [{ day: 1, dayKey: 'x', title: evil, line: evil, photoId: null }], anniversary: null, next: evil }, b)]) {
    assert.doesNotMatch(html, /<img src=x/)
    assert.match(html, /&lt;img src=x/)
  }
  assert.doesNotMatch(claimHtml([{ id: evil, name: evil, class: evil }], evil, evil), /<img src=x/)
})

test('the camera chip counts egg snaps before hatching and bond after', () => {
  const eggChip = vfChipHtml(egg)
  assert.match(eggChip, /Egg · 12 of 20/)
  assert.match(eggChip, /bd-meter mini/)
  const bondChip = vfChipHtml({ ...miso, ladder: [{ level: 3, bond: 18, reward: 'Good friends', unlock: null }] })
  assert.match(bondChip, /Miso · Bond 3/)
  // 21 bond, floor 18, next at 24 -> halfway
  assert.match(bondChip, /width:50%/)
  assert.doesNotMatch(vfChipHtml({ ...miso, name: '<img src=x>' }), /<img src=x/)
})

test('the wish pill is tappable on Home and read-only in the camera HUD', () => {
  const wishing = { ...miso, wish: { id: 'rain', text: 'I want to see the rain', bonus: 2, done: false } }
  assert.match(wishPillHtml(wishing), /data-action="wish-done"/)
  const hud = wishPillHtml(wishing, { interactive: false })
  assert.doesNotMatch(hud, /data-action="wish-done"/)
  assert.doesNotMatch(hud, /<button/)
  assert.match(hud, /I want to see the rain/)
  assert.match(hud, /\+2 bond/)
  assert.doesNotMatch(hud, /Done today/, 'a wish that is not done never reads as done')
  assert.equal(wishPillHtml({ ...miso, wish: { id: null, text: '', bonus: 1, done: false } }), '')
})

test('scrapbook and diary render the stored upload path, not the post id', () => {
  const b = { ...miso, photoIds: ['p1', 'p2'], photos: [{ id: 'p1', imagePath: '/uploads/a.png', at: 'x' }] }
  const home = homeHtml(b, null)
  assert.match(home, /<img class="bd-thumb-img" src="\/uploads\/a\.png"/)
  assert.doesNotMatch(home, /src="\/api\/image/)
  // p2 has no record yet — the tile stays a placeholder rather than a broken image
  assert.equal((home.match(/bd-thumb-img/g) || []).length, 1)
  const diary = diaryHtml({ week: 1, entries: [{ day: 1, dayKey: 'x', title: 'Found', line: 'Warm.', photoId: 'p1' }], anniversary: null, next: 'n' }, b)
  assert.match(diary, /<img class="bd-thumb-img" src="\/uploads\/a\.png"/)
})

test('moment and unlock sheets advance the queue instead of just closing', () => {
  assert.match(momentHtml({ id: 'dog', title: 'A dog', line: 'A DOG.', rarity: 0.4 }, miso), /data-action="sheet-next"/)
  assert.match(unlockHtml({ level: 4, reward: 'Signature pose', unlock: 'pose-1', line: 'Watch this.' }, miso), /data-action="sheet-next"/)
  assert.match(reactionHtml({ kind: 'snap', granted: 1, bond: 5, level: 1, next: null, line: 'A DOG.', labels: [], isNewPlace: false, wishDone: null, unlocks: [], moments: [], bondToday: 1, snapsToday: 1, dailyCap: 10 }), /data-action="save"/)
})

test('keeping a photo has an opposite: the reaction sheet and every moment card offer a way out', () => {
  const reaction = reactionHtml({ kind: 'snap', granted: 1, bond: 5, level: 1, next: null, line: 'A DOG.', labels: [], isNewPlace: false, wishDone: null, unlocks: [], moments: [], bondToday: 1, snapsToday: 1, dailyCap: 10 })
  assert.match(reaction, /data-action="unkeep"/)
  assert.match(reaction, /Don't keep this one/)
  const moment = momentHtml({ id: 'dog', title: 'A dog', line: 'A DOG.', rarity: 0.4 }, miso)
  assert.match(moment, /data-action="unkeep"[^>]*>Skip</)
  assert.match(moment, /Keep it in the book/, 'the primary is unchanged')
})

test('the camera chip counts plainly once the egg is past the last tier', () => {
  const maxed = { ...egg, egg: { snaps: 120, grids: [] }, eggOdds: { tier: 100, rareParts: 2, mysticChance: 0.15, nextTier: null } }
  const chip = vfChipHtml(maxed)
  assert.match(chip, /Egg · 120 snaps/)
  assert.doesNotMatch(chip, /of 100/, 'there is no next tier to be "of"')
  assert.match(chip, /width:100%/)
})

test('the earned fourth trait shows as a marked chip beside the three rolled ones', () => {
  const plain = homeHtml(miso, null)
  assert.doesNotMatch(plain, /bd-chip-earned/, 'nothing before bond level 10')
  const idol = homeHtml({ ...miso, level: 10, earnedTrait: 'Night owl' }, null)
  assert.match(idol, /bd-chip-earned/)
  assert.match(idol, /Night owl/)
  assert.match(idol, /bd-chip-mark">earned</)
  assert.equal((idol.match(/class="bd-chip[" ]/g) || []).length, 4, 'three rolled traits plus the earned one')
})

test('the Mystic glow is on the Home hero box only at bond level 10', () => {
  assert.doesNotMatch(homeHtml(miso, null), /bd-hero-3d bd-glow|bd-hero-3d[^"]*bd-glow/)
  assert.match(homeHtml({ ...miso, level: 10 }, null), /class="bd-hero-3d bd-glow"/)
})

test('the wardrobe tray shows the glow as a badge with nothing to toggle, once unlocked', () => {
  const locked = wardrobeTrayHtml(miso)
  assert.doesNotMatch(locked, /is-badge/)
  const unlocked = wardrobeTrayHtml({ ...miso, wardrobe: { unlocked: [...miso.wardrobe.unlocked, 'glow'], worn: 'hat' } })
  assert.match(unlocked, /wardrobe-chip is-badge/)
  assert.match(unlocked, /Glow/)
  assert.doesNotMatch(unlocked, /data-wear="glow"/, 'the glow is never worn or taken off')
  assert.deepEqual([...unlocked.matchAll(/data-wear="([^"]+)"/g)].map((m) => m[1]), ['hat', 'scarf', 'shades', 'cape', 'crown'])
})

test('the ladder says out loud which rewards are labels in R1', () => {
  const ladder = [
    { level: 3, bond: 16, reward: 'Shades', unlock: 'shades' },
    { level: 4, bond: 24, reward: 'Signature pose', unlock: 'pose-1' },
    { level: 6, bond: 46, reward: 'First trick', unlock: 'trick-1' },
    { level: 8, bond: 76, reward: 'Second trick', unlock: 'trick-2' },
    { level: 9, bond: 95, reward: 'Sparkle trail', unlock: 'trail' },
    { level: 10, bond: 120, reward: 'Mystic glow and Idol card', unlock: 'glow' },
  ]
  const html = ladderHtml({ ...miso, ladder })
  assert.equal((html.match(/coming in R2/g) || []).length, 4, 'exactly the pose, two tricks and the trail')
  const shades = /<div class="bd-step[\s\S]*?Shades[\s\S]*?<\/div>\s*<b/.exec(html)[0]
  assert.doesNotMatch(shades, /coming in R2/, 'a real worn item is not marked')
  const glow = html.slice(html.indexOf('Mystic glow'))
  assert.doesNotMatch(glow, /coming in R2/, 'the glow ships in R1')
})

test('the monthly ladder names the month instead of showing its storage key', () => {
  assert.equal(monthLabel('2026-09'), 'September')
  assert.equal(monthLabel('2026-01'), 'January')
  assert.equal(monthLabel('nonsense'), 'nonsense')
  const html = monthlyHtml({ month: '2026-09', endsAt: '2026-10-01T00:00:00Z', rows: [], you: null })
  assert.match(html, /September Idols/)
  assert.doesNotMatch(html, /2026-09/)
})

test('scrapbook counts every snap, not the capped photoIds list', () => {
  const b = { ...miso, photoIds: ['p61', 'p62', 'p63', 'p64', 'p65'], snapCount: 240 }
  const home = homeHtml(b, null)
  assert.match(home, /Scrapbook · 240/)
  assert.match(home, /<small>240<\/small>/, 'the newest tile is numbered by the true total')
  const diary = diaryHtml({ week: 1, entries: [], anniversary: null, next: 'n' }, b)
  assert.match(diary, /240 photos/)
})

test('the boot-failure card offers a retry instead of a blank document', () => {
  const html = bootErrorHtml()
  assert.match(html, /Couldn't reach the server/)
  assert.match(html, /data-action="retry-boot"/)
  assert.match(html, /Retry/)
})

test('resting row offers a way back to every hatched Axie that is not the active one', () => {
  const tofu = { ...miso, id: 'tofu', name: 'Tofu', class: 'Plant', level: 6, retiredAt: '2026-09-05T00:00:00Z' }
  const html = restingRowHtml([{ ...miso, id: 'miso' }, tofu], 'miso')
  assert.match(html, /data-action="switch"/)
  assert.match(html, /data-id="tofu"/)
  assert.doesNotMatch(html, /data-id="miso"/, 'the active Axie is not offered as resting')
  assert.match(html, /Tofu/)
  assert.match(html, /Plant/)
  assert.match(html, /Bond 6/)
  assert.match(html, /Come back/)
})

test('resting row is empty when nothing is resting, and skips an abandoned egg', () => {
  assert.equal(restingRowHtml([{ ...miso, id: 'miso' }], 'miso'), '')
  assert.equal(restingRowHtml([], 'miso'), '')
  assert.equal(restingRowHtml([{ ...egg, id: 'old-egg' }], 'miso'), '', 'an unhatched egg has nothing to come back to')
})

test('resting row escapes the name', () => {
  const evil = { ...miso, id: 'x', name: '<img src=x onerror="alert(1)">' }
  const html = restingRowHtml([evil], 'miso')
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;img src=x/)
})

test('the resting row reaches the screens that need it: egg and home', () => {
  const tofu = { ...miso, id: 'tofu', name: 'Tofu', retiredAt: '2026-09-05T00:00:00Z' }
  const eggScreen = eggHtml(egg, { buddies: [tofu] })
  assert.match(eggScreen, /data-action="switch"[^>]*data-id="tofu"/)
  const home = homeHtml({ ...miso, id: 'miso' }, null, { buddies: [{ ...miso, id: 'miso' }, tofu] })
  assert.match(home, /data-action="switch"[^>]*data-id="tofu"/)
  // and neither screen grows a row when there is nothing set aside
  assert.doesNotMatch(eggHtml(egg), /data-action="switch"/)
  assert.doesNotMatch(homeHtml(miso, null), /data-action="switch"/)
})

test('home offers a wallet entry point, worded for the connected state', () => {
  const cold = homeHtml(miso, null)
  assert.match(cold, /Own an Axie on Ronin\?/)
  assert.match(cold, /data-action="claim"[^>]*>Bring it</)
  const warm = homeHtml(miso, null, { address: '0xabc' })
  assert.match(warm, /data-action="claim"/)
  assert.match(warm, /Wallet connected · pick another Axie/)
  assert.doesNotMatch(warm, /Own an Axie on Ronin\?/)
})

test('every bond level has its own title, so the hero never says Bond 1 twice', () => {
  const hero = (b) => /<b>([^<]*)<\/b>/.exec(homeHtml(b, null).split('bd-hero-text')[1])[1]
  assert.equal(hero({ ...miso, level: 1, levelName: null }), 'Just hatched')
  assert.equal(hero({ ...miso, level: 2, levelName: null }), 'Getting to know you')
  assert.equal(hero({ ...miso, level: 8, levelName: null }), 'Legends')
  // the server still wins where it names a level
  assert.equal(hero({ ...miso, level: 3, levelName: 'Good friends' }), 'Good friends')
  // the badge still reads "Bond 1" — the title beside it must not repeat it
  const lvl1 = homeHtml({ ...miso, level: 1, levelName: null }, null)
  assert.equal(lvl1.match(/Bond 1</g)?.length, 1, 'only the badge says Bond 1')
})

test('suggestName picks a name for the class', () => {
  assert.ok(suggestName('Beast').length > 1)
  assert.ok(suggestName(null).length > 1)
})

test('monthlyHtml handles a hatched buddy with no bond this month (you: null) without throwing', () => {
  const html = monthlyHtml({
    month: '2026-09', endsAt: '2026-10-01T00:00:00Z',
    rows: [{ rank: 1, buddyId: 'a', name: 'Bubbles', class: 'Aquatic', kind: 'wild', traits: [], level: 5, monthlyBond: 188, rarity: 0.2 }],
    you: null,
  })
  assert.match(html, /Bubbles/)
  assert.doesNotMatch(html, / me"/, 'no row is marked as mine when you is null')
  assert.match(html, /Take a photo this month to join the ladder\./)
})

test('talkHtml renders the input, back action and the last three exchanges with you on the right', () => {
  const exchanges = [
    { you: 'Old message dropped', reply: 'Old reply dropped' },
    { you: 'Hello there', reply: 'Hello. You\'re my person now. Where are we?' },
    { you: 'How are you?', reply: 'I don\'t know that one. I only really know puddles and buses.' },
    { you: 'I had a rough day', reply: 'Then it\'s a sofa day. I\'ll do the face until you laugh.' },
  ]
  const html = talkHtml(miso, exchanges)
  assert.doesNotMatch(html, /Old message dropped/, 'only the last three exchanges show')
  assert.doesNotMatch(html, /Old reply dropped/)
  assert.match(html, /Hello there/)
  assert.match(html, /sofa day/)
  assert.match(html, /data-action="talk-send"/)
  assert.match(html, /id="bd-talk-input"/)
  assert.match(html, /data-action="home"/, 'has a way back to Home')
  const youIdx = html.indexOf('bd-talk-you')
  const buddyIdx = html.indexOf('bd-talk-buddy')
  assert.ok(youIdx > -1 && buddyIdx > -1)
})

test('talkHtml escapes user text in the bubbles', () => {
  const evil = '<img src=x onerror="alert(1)">'
  const html = talkHtml(miso, [{ you: evil, reply: evil }])
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;img src=x/)
})

test('talkHtml shows an empty state with no exchanges yet', () => {
  const html = talkHtml(miso, [])
  assert.match(html, /data-action="talk-send"/)
  assert.match(html, /id="bd-talk-input"/)
})

test('the after-the-shot card counts photos, not bond, against the day', () => {
  const base = { kind: 'snap', granted: 1, bond: 12, level: 2, next: null, line: 'A DOG.', labels: [], isNewPlace: false, wishDone: null, unlocks: [], moments: [], dailyCap: 10 }
  // five egg photos, four since, a wish: bond says ten, photos say nine
  const html = reactionHtml({ ...base, bondToday: 10, snapsToday: 9 })
  assert.match(html, /9 of 10 photos today/)
  assert.doesNotMatch(html, /10 of 10/)
  const full = reactionHtml({ ...base, granted: 0, bondToday: 12, snapsToday: 10, wishDone: { id: 'stairs', text: 'Take me up some stairs', bonus: 1, done: true } })
  assert.match(full, /Today&#39;s 10 photos are counted, this one still goes in the book/)
  assert.match(full, /wish done \+1/)
  assert.match(full, /10 of 10 photos today/)
})

test('dayCount counts calendar days, not twenty-four-hour spans', () => {
  // found at 21:00 local; at 01:00 the next morning it is day two, at 21:00 the next evening still day two
  const found = new Date(2026, 8, 10, 21, 0, 0)
  const b = { createdAt: found.toISOString(), hatchedAt: null }
  assert.equal(dayCount(b, found.getTime() + 60 * 60 * 1000), 1, 'same evening')
  assert.equal(dayCount(b, new Date(2026, 8, 11, 1, 0, 0).getTime()), 2, 'past midnight')
  assert.equal(dayCount(b, new Date(2026, 8, 11, 21, 0, 0).getTime()), 2, 'a full day later')
  assert.equal(dayCount(b, new Date(2026, 8, 17, 9, 0, 0).getTime()), 8, 'a week on')
  assert.equal(dayCount({ createdAt: 'garbage', hatchedAt: null }), 1)
})

test('the egg and Home screens carry the account button', () => {
  assert.match(homeHtml(miso, null), /data-action="account"/)
  assert.match(eggHtml({ ...miso, hatchedAt: null, egg: { snaps: 2, grids: [], distanceKm: 0, foodSnaps: 0 } }, {}), /data-action="account"/)
})

test('account: a guest sees Ronin sign-in and the recovery code; a wallet sees the wallet and no code', () => {
  const guest = accountHtml(miso, { buddies: [miso], address: null })
  assert.match(guest, /Guest on this phone/)
  assert.match(guest, /data-action="ronin-account"/)
  assert.match(guest, /data-action="recovery"/)
  assert.match(guest, /data-action="recover"/)
  assert.match(guest, /data-action="claim"/)
  assert.match(guest, /data-action="fresh-egg"/)
  assert.match(guest, /Miso/)
  assert.match(guest, /One is active at a time/)
  assert.match(guest, /Hatch another egg/)
  assert.match(guest, /Profile/)
  const wallet = accountHtml(miso, { buddies: [miso], address: '0x1234567890abcdef1234567890abcdef12345678' })
  assert.match(wallet, /Ronin Wallet/)
  assert.match(wallet, /0x1234…5678/)
  assert.doesNotMatch(wallet, /data-action="recovery"/, 'the wallet is the account: no recovery code')
  assert.doesNotMatch(wallet, /data-action="ronin-account"/)
  assert.match(wallet, /data-action="claim"/)
})

test('account: resting Axies are listed with a switch, and an egg shows its snaps', () => {
  const resting = { ...miso, id: 'b2', name: 'Tofu', class: 'Plant', level: 3 }
  const html = accountHtml(miso, { buddies: [miso, resting], address: null })
  assert.match(html, /data-action="switch" data-id="b2"/)
  assert.match(html, /Tofu/)
  const egg = accountHtml({ ...miso, hatchedAt: null, egg: { snaps: 3, grids: [], distanceKm: 0, foodSnaps: 0 } }, { buddies: [], address: null })
  assert.match(egg, /Your egg/)
  assert.match(egg, /3 snaps so far/)
  assert.doesNotMatch(egg, /data-action="fresh-egg"/)
  assert.match(accountHtml(null, {}), /No Axie yet/)
})

test('account escapes names', () => {
  const evil = '<img src=x onerror=alert(1)>'
  const html = accountHtml({ ...miso, name: evil }, { buddies: [], address: null })
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img/)
})


test('the scrapbook shows every kept photo, newest first, numbered down from the count', () => {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
  const b = { ...miso, photoIds: ids, photos: ids.map((id) => ({ id, imagePath: `/uploads/${id}.png`, at: 'x' })), snapCount: 8, photoCount: 8 }
  const html = homeHtml(b, null)
  assert.match(html, /data-action="scrapbook">Scrapbook · 8/)
  const thumbs = html.match(/class="bd-thumb" data-action="photo"/g) || []
  assert.equal(thumbs.length, 8, 'eight thumbnails for eight photos')
  assert.ok(html.indexOf('data-id="p8"') < html.indexOf('data-id="p1"'), 'newest first')
  assert.match(html, /data-id="p8" aria-label="Photo 8">[^<]*<img[^>]*><small>8<\/small>/)
  assert.match(html, /data-id="p1" aria-label="Photo 1">[^<]*<img[^>]*><small>1<\/small>/)
})


test('the scrapbook screen shows every photo it has a picture for, newest first, and opens one', () => {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']
  const b = { ...miso, createdAt: '2026-09-09T02:00:00Z', photoIds: ids, photos: ids.slice(2).map((id) => ({ id, imagePath: `/uploads/${id}.png`, at: '2026-09-11T03:00:00Z' })), snapCount: 10, photoCount: 10 }
  const html = scrapbookHtml(b)
  assert.match(html, /Scrapbook · 10/)
  assert.equal((html.match(/class="bd-tile"/g) || []).length, 8, 'eight have pictures')
  assert.ok(html.indexOf('data-id="p10"') < html.indexOf('data-id="p3"'), 'newest first')
  assert.match(html, /2 older photos are counted but not shown/)
  assert.match(html, /data-action="snap"/)
  const view = photoViewHtml(b, 'p10')
  assert.match(view, /Photo 10 · Day 3/)
  assert.match(view, /src="\/uploads\/p10\.png"/)
  assert.match(view, /data-action="unkeep-photo" data-id="p10"/)
  assert.match(view, /data-action="close-sheet"/)
  const old = photoViewHtml(b, 'p1')
  assert.match(old, /older than the book keeps/)
  assert.match(scrapbookHtml({ ...miso, photoIds: [], photos: [], snapCount: 0, photoCount: 0 }), /No photos yet/)
})


test('the front door: header with the mark, hero with a real photo and line, sections, honest rules; as About it only leads back', () => {
  const fresh = welcomeHtml({})
  assert.match(fresh, /class="lp-mark"/, 'the logo mark')
  assert.match(fresh, /class="lp-wordmark"[^>]*aria-label="Axie Idol"/, 'the name, drawn, still readable to a screen reader')
  assert.doesNotMatch(fresh.slice(0, fresh.indexOf('lp-hero')), /ellipse/, 'the mark has no face')
  assert.match(fresh, /Keep it happy/, 'the game is named on the front door')
  assert.match(fresh, /data-action="visit"/, 'and a real Axie can be played from it')
  assert.match(fresh, /id="lp-road"/, 'the roadmap')
  for (const part of ['Round one', 'Round two', 'Next stage of the Vibeathon', 'After the Vibeathon']) assert.match(fresh, new RegExp(part), part)
  assert.equal((fresh.match(/class="lp-road-card/g) || []).length, 3, 'three parts')
  assert.equal((fresh.match(/class="lp-road-core"/g) || []).length, 3, 'every stage says how it fits Axie Core')
  assert.match(fresh, /real Axie parts and classes/)
  assert.match(fresh, /Part evolution follows Axie Core/)
  const after = fresh.slice(fresh.indexOf('After the Vibeathon'))
  assert.match(after, /social wall/i, 'the wall launches after the Vibeathon')
  assert.match(after, /special props only they can wear/, 'higher Axie Core Axies get props')
  assert.match(after, /Chat opens up for them/, 'and chat')
  assert.match(fresh, /class="lp-header"/)
  assert.match(fresh, /Your Axie\. In your camera\. With opinions\./)
  assert.match(fresh, /welcome\/stairs\.jpg/, 'a real photo in the hero')
  assert.match(fresh, /That bench is far/, 'a real line on it')
  for (const id of ['lp-how', 'lp-voice', 'lp-grow', 'lp-hatch', 'lp-faq']) assert.match(fresh, new RegExp(`id="${id}"`), id)
  assert.match(fresh, /Something moved in there\./, 'the egg voice on a real photo')
  assert.match(fresh, /Is it free\?/)
  assert.match(fresh, /Ten a day build bond/)
  assert.equal((fresh.match(/data-action="start-egg"/g) || []).length, 3, 'header, hero and footer all start an egg')
  assert.match(fresh, /data-action="ronin-welcome"/)
  assert.match(fresh, /data-action="recover"/)
  assert.doesNotMatch(fresh, /data-action="back"/)
  const signed = welcomeHtml({ address: '0xabc' })
  assert.match(signed, /data-action="claim"/)
  assert.doesNotMatch(signed, /ronin-welcome/)
  const about = welcomeHtml({ hasAxie: true, axieName: 'Pip' })
  assert.match(about, /data-action="back">Back to Pip/)
  assert.doesNotMatch(about, /start-egg/, 'no second egg from the About page')
  assert.doesNotMatch(about, /ronin-welcome|data-action="recover"/)
  assert.match(accountHtml(miso, { buddies: [miso], address: null }), /data-action="about"/)
})


test('home has one ask, not two: the bubble carries the wish in the Axie\'s words and the row only the action', () => {
  const wishing = { ...miso, wish: { id: 'new-place', text: "Take me somewhere you've never taken me", bonus: 2, done: false } }
  const withGreeting = homeHtml(wishing, "Morning. Let's find somewhere we have never been.")
  assert.doesNotMatch(withGreeting, /'s wishes/, 'no separate wish card')
  assert.doesNotMatch(withGreeting, /Wishes add extra bond/)
  assert.equal((withGreeting.match(/never taken me/g) || []).length, 0, 'the wish text is not repeated under the bubble')
  assert.match(withGreeting, /class="bd-speech bd-speech-home">Morning\. Let&#39;s find somewhere we have never been\./)
  assert.match(withGreeting, /data-action="wish-done"/)
  assert.match(withGreeting, /Today's wish<small>Tap when you have it<\/small>/)
  assert.match(withGreeting, /\+2 bond/)
  // no greeting yet (model off, or first paint): the wish itself is the bubble
  const plain = homeHtml(wishing, null)
  assert.match(plain, /class="bd-speech bd-speech-home">Take me somewhere you&#39;ve never taken me\./)
  assert.equal((plain.match(/never taken me/g) || []).length, 1, 'said once')
  // done: the row says so and the bubble is the greeting
  const done = homeHtml({ ...wishing, wish: { ...wishing.wish, done: true } }, 'Good one today. Somewhere new tomorrow?')
  assert.match(done, /Wish done today<small>It came true<\/small>/)
  assert.doesNotMatch(done, /data-action="wish-done"/)
  // the camera HUD still shows the wish text itself
  assert.match(wishPillHtml(wishing, { interactive: false }), /never taken me/)
})


test('the egg has a voice: one line per photo, shown on the egg screen', () => {
  assert.match(eggLine(0), /quiet/)
  assert.match(eggLine(1), /moved/)
  assert.match(eggLine(5), /ready/)
  assert.notEqual(eggLine(6), eggLine(7))
  assert.equal(eggLine(6), eggLine(9), 'past five it rotates')
  for (let n = 0; n < 12; n++) assert.doesNotMatch(eggLine(n), /\d/)
  const egg = { ...miso, hatchedAt: null, egg: { snaps: 3, grids: ['a'], distanceKm: 0, foodSnaps: 0 } }
  assert.match(eggHtml(egg, {}), /class="bd-speech bd-speech-home bd-speech-egg">A tap\. From inside\./)
})
