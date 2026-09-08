import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eggHtml, hatchHtml, homeHtml, claimHtml, reactionHtml, ladderHtml, monthlyHtml, diaryHtml, momentHtml, unlockHtml, suggestName } from '../src/buddyHtml.ts'

const egg = {
  id: 'e', kind: 'wild', hatchedAt: null, createdAt: new Date().toISOString(),
  egg: { snaps: 12, grids: ['a', 'b', 'c', 'd'] },
  eggOdds: { tier: 5, rareParts: 0, mysticChance: 0, nextTier: 20 },
  name: '', traits: [], bond: 0, level: 0, next: null,
  wish: { id: null, text: '', bonus: 1, done: false },
  wardrobe: { unlocked: [], worn: null },
  moments: [], momentsTotal: 24, photoIds: [], snapCount: 12, bondToday: 3, dailyCap: 10, streak: 2,
  ladder: [], mystic: false, mysticId: null, rareIds: [], descriptor: null, class: null, axieId: null,
  retiredAt: null, levelName: null,
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

test('hatch and reaction render the spoken lines', () => {
  assert.match(hatchHtml({ ...egg, name: 'Miso', traits: ['Shy'] }, ['Oh. Hello.']), /Oh\. Hello\./)
  assert.match(
    reactionHtml({ kind: 'snap', granted: 1, bond: 5, level: 1, next: null, line: 'A DOG.', labels: ['dog'], isNewPlace: true, wishDone: null, unlocks: [], moments: [], bondToday: 1, dailyCap: 10 }),
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

test('suggestName picks a name for the class', () => {
  assert.ok(suggestName('Beast').length > 1)
  assert.ok(suggestName(null).length > 1)
})
