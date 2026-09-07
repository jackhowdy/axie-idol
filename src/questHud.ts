/**
 * Pinned quest HUD: the same "what do I do next" card on Feed, the Ladder
 * "You" row, and (as a one-line chip) on Snap.
 */
export type QuestHudInput = {
  level: number
  nextQuest: {
    level: number
    description: string
    progress: number
    target: number
    unlockLabel?: string
  } | null
  nextUnlock?: { castId?: string; propId?: string; label?: string } | null
  previewSrc: (castId: string) => string
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c,
  )
}

function lowerFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s
}

/** One-line instruction for the Snap chip, e.g. "Post to unlock Bing". */
export function questChipText(p: QuestHudInput): string {
  const q = p.nextQuest
  if (!q) return p.level >= 24 ? 'Ladder complete' : 'Keep questing'
  const unlock = q.unlockLabel || p.nextUnlock?.label || ''
  if (/first post/i.test(q.description)) return unlock ? `Post to unlock ${unlock}` : 'Post to level up'
  return unlock ? `${q.description} to unlock ${unlock}` : q.description
}

/** Green HUD card. */
export function questHudHtml(p: QuestHudInput): string {
  const q = p.nextQuest
  if (!q) {
    const title = p.level >= 24 ? 'Ladder complete' : 'Keep questing'
    return `<div class="quest-hud is-done" role="status"><div class="quest-hud-text"><div class="quest-hud-title">${title}</div></div></div>`
  }
  const pct = Math.max(0, Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100)))
  const unlock = q.unlockLabel || p.nextUnlock?.label || ''
  const castId = p.nextUnlock?.castId || ''
  const thumb = castId
    ? `<img class="quest-hud-thumb" src="${esc(p.previewSrc(castId))}" alt="" />`
    : `<span class="quest-hud-thumb is-prop"></span>`
  return `<div class="quest-hud" role="status">
  <div class="quest-hud-avatar">${thumb}</div>
  <div class="quest-hud-text">
    <div class="quest-hud-title">Next: ${esc(lowerFirst(q.description))}</div>
    <div class="quest-hud-bar"><div class="quest-hud-fill" style="width: ${pct}%"></div></div>
    <div class="quest-hud-sub">${q.progress} / ${q.target}${unlock ? ` · unlocks ${esc(unlock)}` : ''}</div>
  </div>
</div>`
}
