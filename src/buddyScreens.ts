/**
 * One-Axie loop: screen mounting and event wiring.
 *
 * The renderers live in `src/buddyHtml.ts` (pure, unit-tested). This module owns
 * the DOM sections, one delegated click handler for every `[data-action]` inside
 * `.buddy` / `#buddy-sheet`, and the API calls from `src/buddy.ts`.
 */
import {
  buddyState, buddyHeaders, startEgg, hatch, retire, switchTo, wear, wishDone,
  beforeLine, roninSignIn, ownedAxies, claim, issueRecovery, redeemRecovery,
} from './buddy'
import {
  eggHtml, hatchHtml, homeHtml, claimHtml, ladderHtml, monthlyHtml, diaryHtml,
  suggestName, type Monthly, type Diary, type OwnedAxie,
} from './buddyHtml.ts'

export type BuddyScreen = 'auto' | 'egg' | 'hatch' | 'home' | 'claim' | 'ladder' | 'monthly' | 'diary'
export type BuddyNav = { goSnap: () => void; showFace: (host: HTMLElement) => Promise<void> }
export type BuddyUi = {
  show: (which: BuddyScreen) => Promise<void>
  sheet: (html: string) => void
  hideSheet: () => void
}

const KEYS: Exclude<BuddyScreen, 'auto'>[] = ['egg', 'hatch', 'home', 'claim', 'ladder', 'monthly', 'diary']

export function mountBuddyScreens(nav: BuddyNav): BuddyUi {
  const sections = {} as Record<Exclude<BuddyScreen, 'auto'>, HTMLElement>
  for (const k of KEYS) sections[k] = document.querySelector<HTMLElement>(`#buddy-${k}`)!
  const sheetEl = document.querySelector<HTMLElement>('#buddy-sheet')!

  let pendingLines: string[] = []
  let claimAxies: OwnedAxie[] = []
  let claimPick: string | null = null
  let busy = false

  function hideAll(): void {
    for (const s of document.querySelectorAll<HTMLElement>('.screen')) s.hidden = true
  }

  async function show(which: BuddyScreen): Promise<void> {
    const before = buddyState.active
    if (which === 'auto') which = !before ? 'egg' : before.hatchedAt ? 'home' : 'egg'
    // Never create a second egg behind an active Axie — only "fresh egg" retires one.
    if (which === 'egg' && before?.hatchedAt) which = 'home'
    if ((which === 'home' || which === 'ladder' || which === 'diary') && !before?.hatchedAt) which = 'egg'
    if (which === 'hatch' && !before) which = 'egg'

    if (which === 'egg' && !buddyState.active) await startEgg()
    const el = sections[which]
    let html = ''
    if (which === 'egg') html = eggHtml(buddyState.active!)
    else if (which === 'hatch') html = hatchHtml(buddyState.active!, pendingLines)
    else if (which === 'home') html = homeHtml(buddyState.active!, buddyState.greeting)
    else if (which === 'claim') {
      claimAxies = buddyState.address ? await ownedAxies().catch(() => []) : []
      if (claimPick && !claimAxies.some((a) => a.id === claimPick)) claimPick = null
      html = claimHtml(claimAxies, claimPick, buddyState.address)
    } else if (which === 'ladder') html = ladderHtml(buddyState.active!)
    else if (which === 'monthly') html = monthlyHtml(await getJson<Monthly>('/api/ladder/monthly'))
    else if (which === 'diary') html = diaryHtml(await getJson<Diary>('/api/buddy/diary'), buddyState.active!)

    hideSheet()
    hideAll()
    el.innerHTML = html
    el.hidden = false
    el.scrollTop = 0
    const face = el.querySelector<HTMLElement>('[data-face="buddy"]')
    if (face) void nav.showFace(face)
  }

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(path, { headers: buddyHeaders() })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error(data.error || `${path} ${res.status}`)
    return data
  }

  function sheet(html: string): void {
    sheetEl.innerHTML = `<div class="bd-sheet-card">${html}</div>`
    sheetEl.hidden = false
  }
  function hideSheet(): void {
    sheetEl.hidden = true
    sheetEl.innerHTML = ''
  }

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]')
    if (!a || !a.closest('.buddy, #buddy-sheet')) return
    e.preventDefault()
    if (busy) return
    busy = true
    void run(a).catch((err: unknown) => { alert((err as Error).message || String(err)) }).finally(() => { busy = false })
  })

  async function run(a: HTMLElement): Promise<void> {
    const act = a.dataset.action
    const b = buddyState.active
    if (act === 'snap') { nav.goSnap(); return }
    if (act === 'hatch-now') { pendingLines = []; await show('hatch'); return }
    if (act === 'hatch-confirm') {
      const input = document.querySelector<HTMLInputElement>('#bd-name')
      const name = (input?.value || 'Miso').trim()
      const r = await hatch(name)
      pendingLines = r.lines
      await show('hatch')
      return
    }
    if (act === 'suggest') {
      const input = document.querySelector<HTMLInputElement>('#bd-name')
      if (!input) return
      input.value = suggestName(b?.class)
      const echo = document.querySelector<HTMLElement>('[data-name-echo]')
      if (echo) echo.textContent = input.value
      return
    }
    if (act === 'talk') {
      const line = await beforeLine({})
      if (line) { buddyState.greeting = line; await show('home') }
      return
    }
    if (act === 'claim') { await show('claim'); return }
    if (act === 'ronin') { await roninSignIn(); await show('claim'); return }
    if (act === 'select-axie') { claimPick = a.dataset.id || null; await show('claim'); return }
    if (act === 'pick-axie') {
      const r = await claim(a.dataset.id!)
      pendingLines = r.lines
      await show('hatch')
      return
    }
    if (act === 'fresh-egg') {
      if (!confirm(`${b?.name || 'Your Axie'} stays in your scrapbook. Start a fresh egg?`)) return
      await retire()
      await show('egg')
      return
    }
    if (act === 'switch') { await switchTo(a.dataset.id!); await show('auto'); return }
    if (act === 'wear') {
      const item = a.dataset.item!
      await wear(b?.wardrobe.worn === item ? null : item)
      await show('home')
      return
    }
    if (act === 'wish-done') { await wishDone(); await show('home'); return }
    if (act === 'ladder' || act === 'monthly' || act === 'diary') { await show(act); return }
    if (act === 'home') { await show('home'); return }
    if (act === 'back') { await show('auto'); return }
    if (act === 'recovery') {
      const code = await issueRecovery()
      sheet(`<p class="bd-eyebrow">Recovery code</p><h2 class="bd-code">${code}</h2>
        <p class="bd-small">Screenshot this. Enter it on another phone to move your Axie there. It works once.</p>
        <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="close-sheet">Done</button></div>`)
      return
    }
    if (act === 'recover') {
      const code = prompt('Recovery code')
      if (code) { await redeemRecovery(code); await show('auto') }
      return
    }
    // Task 10 replaces these two with the real save/retake of the post flow.
    if (act === 'retake') { hideSheet(); nav.goSnap(); return }
    if (act === 'save') { hideSheet(); await show('auto'); return }
    if (act === 'close-sheet') { hideSheet(); return }
  }

  return { show, sheet, hideSheet }
}
