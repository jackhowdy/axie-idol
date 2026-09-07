import { test } from 'node:test'
import assert from 'node:assert/strict'
import { questHudHtml, questChipText } from '../src/questHud.ts'

const base = { level: 1, previewSrc: (id) => `/previews/${id}.png` }

test('HUD shows next quest, progress and unlock', () => {
  const html = questHudHtml({
    ...base,
    nextQuest: { level: 2, description: 'Leave 1 comment', progress: 0, target: 1, unlockLabel: "Kotaro's sword" },
    nextUnlock: { propId: 'kotaro-sword', label: "Kotaro's sword" },
  })
  assert.match(html, /Next: leave 1 comment/)
  assert.match(html, /0 \/ 1/)
  assert.match(html, /unlocks Kotaro&#39;s sword/)
  assert.match(html, /width: 0%/)
})

test('HUD progress bar is proportional and capped', () => {
  const html = questHudHtml({
    ...base,
    nextQuest: { level: 3, description: 'Give 10 likes', progress: 12, target: 10 },
    nextUnlock: { castId: 'kibo', label: 'Kibo' },
  })
  assert.match(html, /width: 100%/)
  assert.match(html, /\/previews\/kibo\.png/)
})

test('chip text reads as an instruction', () => {
  assert.equal(
    questChipText({ ...base, nextQuest: { level: 1, description: 'Make your first post', progress: 0, target: 1, unlockLabel: 'Bing' } }),
    'Post to unlock Bing',
  )
  assert.equal(
    questChipText({ ...base, nextQuest: { level: 2, description: 'Leave 1 comment', progress: 0, target: 1, unlockLabel: "Kotaro's sword" } }),
    "Leave 1 comment to unlock Kotaro's sword",
  )
  assert.equal(questChipText({ ...base, level: 24, nextQuest: null }), 'Ladder complete')
})
