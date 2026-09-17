/**
 * One-Axie loop: screen mounting and event wiring.
 *
 * The renderers live in `src/buddyHtml.ts` (pure, unit-tested). This module owns
 * the DOM sections, one delegated click handler for every `[data-action]` inside
 * `.buddy` / `#buddy-sheet`, and the API calls from `src/buddy.ts`.
 */
import {
  buddyState, buddyHeaders, loadBuddy, startEgg, hatch, retire, switchTo, wear, wishDone, talkEnabled,
  roninSignIn, ownedAxies, claim, issueRecovery, redeemRecovery, unkeepPhoto, pet, visitAxie, type HappyChange,
} from './buddy'
import {
  eggHtml, hatchHtml, homeHtml, claimHtml, ladderHtml, monthlyHtml, diaryHtml, talkHtml, accountHtml, scrapbookHtml, photoViewHtml, welcomeHtml, visitHtml, joyHtml,
  bootErrorHtml, suggestName, esc, type Monthly, type Diary, type OwnedAxie, type TalkExchange,
} from './buddyHtml.ts'

export type BuddyScreen = 'auto' | 'egg' | 'hatch' | 'home' | 'claim' | 'ladder' | 'monthly' | 'diary' | 'talk' | 'account' | 'scrapbook' | 'welcome'
export type BuddyNav = {
  goSnap: () => void
  showFace: (host: HTMLElement) => Promise<void>
  /** No hero box on this screen — let the owner pause the 3D character. */
  hideFace: () => void
  /**
   * Advance the after-the-shot sheet queue (reaction -> moments -> unlocks -> home).
   * A module-level queue in main.ts, not a DOM event, so nothing accumulates listeners.
   */
  onSheetNext: () => void
  /** Drop the queued sheets — the shot they belonged to is being retaken. */
  clearSheetQueue: () => void
  /** The post id of the photo the open sheets are about, so it can be un-kept. */
  lastPhotoId: () => string | null
  /** The camera's own toast — screens have no toast of their own. */
  toast: (message: string) => void
}
export type BuddyUi = {
  show: (which: BuddyScreen) => Promise<void>
  sheet: (html: string) => void
  hideSheet: () => void
  /** Boot could not reach the server: a retry card in place of a blank document. */
  showBootError: () => void
}

const KEYS: Exclude<BuddyScreen, 'auto'>[] = ['egg', 'hatch', 'home', 'claim', 'ladder', 'monthly', 'diary', 'talk', 'account', 'scrapbook', 'welcome']

export function mountBuddyScreens(nav: BuddyNav): BuddyUi {
  const sections = {} as Record<Exclude<BuddyScreen, 'auto'>, HTMLElement>
  for (const k of KEYS) sections[k] = document.querySelector<HTMLElement>(`#buddy-${k}`)!
  const sheetEl = document.querySelector<HTMLElement>('#buddy-sheet')!

  let pendingLines: string[] = []
  let claimAxies: OwnedAxie[] = []
  let claimPick: string | null = null
  let exchanges: TalkExchange[] = []
  let busy = false

  /**
   * `hidden` alone is not enough for the legacy screens: `.screen.active { display: block }` is an
   * author rule, so it beats the UA sheet's `[hidden]` and the screen keeps rendering underneath.
   * The class has to come off too, or the legacy feed stays painted below the buddy screens.
   */
  function hideAll(): void {
    for (const s of document.querySelectorAll<HTMLElement>('.screen')) {
      s.hidden = true
      s.classList.remove('active')
    }
  }

  async function show(which: BuddyScreen): Promise<void> {
    // The egg and Home screens are the record of what happened: always paint them from the
    // server's latest state (a photo posted while the network was slow must never be "forgotten").
    if (which === 'auto' || which === 'egg' || which === 'home') {
      try {
        await loadBuddy()
      } catch (err) {
        console.warn('[buddy] refresh before show failed, using cached state', err)
      }
    }
    const before = buddyState.active
    // Nothing on this phone yet: the front door, never an egg conjured behind someone's back.
    if (which === 'auto') which = !before ? (buddyState.buddies.length ? 'egg' : 'welcome') : before.hatchedAt ? 'home' : 'egg'
    // Never create a second egg behind an active Axie — only "fresh egg" retires one.
    if (which === 'egg' && before?.hatchedAt) which = 'home'
    if ((which === 'home' || which === 'ladder' || which === 'diary' || which === 'talk' || which === 'scrapbook') && !before?.hatchedAt) which = 'egg'
    if (which === 'hatch' && !before) which = 'egg'
    // R1 ships without typed chat: the Axie speaks after photos instead.
    if (which === 'talk' && !talkEnabled) which = 'home'

    if (which === 'egg' && !buddyState.active) await startEgg()
    const el = sections[which]
    let html = ''
    if (which === 'egg') html = eggHtml(buddyState.active!, { buddies: buddyState.buddies })
    else if (which === 'hatch') html = hatchHtml(buddyState.active!, pendingLines)
    else if (which === 'home') html = homeHtml(buddyState.active!, buddyState.greeting, { buddies: buddyState.buddies, address: buddyState.address, talk: talkEnabled })
    else if (which === 'claim') {
      claimAxies = buddyState.address ? await ownedAxies().catch(() => []) : []
      if (claimPick && !claimAxies.some((a) => a.id === claimPick)) claimPick = null
      html = claimHtml(claimAxies, claimPick, buddyState.address)
    } else if (which === 'ladder') html = ladderHtml(buddyState.active!)
    else if (which === 'monthly') html = monthlyHtml(await getJson<Monthly>('/api/ladder/monthly'))
    else if (which === 'diary') html = diaryHtml(await getJson<Diary>('/api/buddy/diary'), buddyState.active!)
    else if (which === 'talk') html = talkHtml(buddyState.active!, exchanges)
    else if (which === 'account') html = accountHtml(buddyState.active, { buddies: buddyState.buddies, address: buddyState.address })
    else if (which === 'scrapbook') html = scrapbookHtml(buddyState.active!)
    else if (which === 'welcome') html = welcomeHtml({ hasAxie: Boolean(buddyState.active), axieName: buddyState.active?.name, address: buddyState.address })

    hideSheet()
    hideAll()
    // The front door is the one screen that opens the phone frame up on a wide screen.
    document.body.classList.toggle('bd-wide', which === 'welcome')
    el.innerHTML = html
    el.hidden = false
    const scroller = el.querySelector<HTMLElement>('.bd-scroll')
    if (scroller) scroller.scrollTop = which === 'talk' ? scroller.scrollHeight : 0
    if (which === 'talk') el.querySelector<HTMLInputElement>('#bd-talk-input')?.focus()
    const face = el.querySelector<HTMLElement>('[data-face="buddy"]')
    if (face) void nav.showFace(face)
    else nav.hideFace()
  }

  /**
   * The one screen that is rendered without asking the server anything. `#buddy-egg` is the host
   * because it is where `show('auto')` would have landed, and the retry runs the same boot path.
   */
  function showBootError(): void {
    hideSheet()
    hideAll()
    const el = sections.egg
    el.innerHTML = bootErrorHtml()
    el.hidden = false
    nav.hideFace()
  }

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(path, { headers: buddyHeaders() })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error(data.error || `${path} ${res.status}`)
    return data
  }

  /**
   * The one send path: the send button and the Enter key both land here, so they behave
   * identically. A failed send throws with the text still in the box; a successful one clears it
   * before the re-render, so the sent line never lingers under the bubble it just became.
   * `show('talk')` re-renders the screen and puts focus back in the fresh input.
   */
  async function talkSend(): Promise<void> {
    const input = document.querySelector<HTMLInputElement>('#bd-talk-input')
    const text = (input?.value || '').trim()
    if (!text) return
    // The Axie is thinking (the model takes a second or two): your words go up at once, a dotted
    // bubble holds the reply's place, and the box is closed until the answer lands.
    const thread = document.querySelector<HTMLElement>('.bd-talk')
    if (thread) {
      thread.querySelector('.bd-muted')?.remove()
      thread.insertAdjacentHTML('beforeend', `<div class="bd-talk-row bd-talk-you"><div class="bd-bubble bd-bubble-you">${esc(text)}</div></div><div class="bd-talk-row bd-talk-buddy"><div class="bd-bubble bd-bubble-buddy bd-bubble-wait" aria-label="thinking"><i></i><i></i><i></i></div></div>`)
      const scroller = thread.closest<HTMLElement>('.bd-scroll')
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    }
    if (input) input.disabled = true
    let res: Response
    let data: { reply?: string; error?: string; happy?: HappyChange }
    try {
      res = await fetch(`/api/buddy/talk?hour=${new Date().getHours()}`, { method: 'POST', headers: buddyHeaders(), body: JSON.stringify({ text }) })
      data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string; happy?: HappyChange }
    } finally {
      if (input) input.disabled = false
    }
    if (!res.ok) { await show('talk'); throw new Error(data.error || `/api/buddy/talk ${res.status}`) }
    exchanges = [...exchanges, { you: text, reply: data.reply || '' }].slice(-3)
    if (input) input.value = ''
    await show('talk')
    if (data.happy && data.happy.delta > 0) nav.toast(`+${data.happy.delta} happy · ${data.happy.mood} ${data.happy.value}`)
    if (data.happy?.overjoyed && buddyState.active) { await loadBuddy().catch(() => {}); sheet(joyHtml(data.happy, buddyState.active)) }
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
    const target = e.target
    if (!(target instanceof Element)) return
    const a = target.closest<HTMLElement>('[data-action]')
    if (!a || !a.closest('.buddy, #buddy-sheet')) return
    e.preventDefault()
    if (busy) return
    busy = true
    void run(a).catch((err: unknown) => { alert((err as Error).message || String(err)) }).finally(() => { busy = false })
  })

  // The hatch button echoes the name as it is typed ("Hello, Happy").
  document.addEventListener('input', (e) => {
    const target = e.target
    if (!(target instanceof HTMLInputElement) || target.id !== 'bd-name') return
    const echo = document.querySelector<HTMLElement>('[data-name-echo]')
    if (echo) echo.textContent = target.value.trim() || 'Miso'
  })

  // Enter sends a talk message too, same as tapping the send button.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const target = e.target
    if (!(target instanceof HTMLInputElement) || target.id !== 'bd-talk-input') return
    e.preventDefault()
    if (busy) return
    busy = true
    void talkSend().catch((err: unknown) => { alert((err as Error).message || String(err)) }).finally(() => { busy = false })
  })

  async function run(a: HTMLElement): Promise<void> {
    const act = a.dataset.action
    const b = buddyState.active
    if (act === 'snap') { hideSheet(); document.body.classList.remove('bd-wide'); nav.goSnap(); return }
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
    if (act === 'talk') { await show('talk'); return }
    // A pat: the Axie answers in its bubble, the meter moves, and the fifth one can win the day.
    if (act === 'pet') {
      const r = await pet()
      await show('home')
      const bubble = document.querySelector<HTMLElement>('#buddy-home .bd-speech-home')
      if (bubble) { bubble.textContent = r.line; bubble.classList.remove('bd-speech-quiet') }
      nav.toast(r.happy.delta > 0 ? `+${r.happy.delta} happy · ${r.happy.mood} ${r.happy.value}` : 'It liked that. No more points for pats today.')
      if (r.happy.overjoyed && buddyState.active) sheet(joyHtml(r.happy, buddyState.active))
      return
    }
    if (act === 'visit') { sheet(visitHtml()); document.querySelector<HTMLInputElement>('#bd-visit-id')?.focus(); return }
    if (act === 'visit-go') {
      const id = (a.dataset.id || document.querySelector<HTMLInputElement>('#bd-visit-id')?.value || '').replace(/[^0-9]/g, '')
      if (!id) throw new Error('Type an Axie number first, like 2660')
      const pendingSnaps = b && !b.hatchedAt ? b.egg.snaps : 0
      if (pendingSnaps >= 1 && !confirm(`Your egg with ${pendingSnaps} snaps will be set aside. Continue?`)) return
      const r = await visitAxie(id)
      pendingLines = r.lines
      await show('hatch')
      return
    }
    if (act === 'talk-send') { await talkSend(); return }
    if (act === 'claim') { await show('claim'); return }
    if (act === 'ronin') { await roninSignIn(); await show('claim'); return }
    if (act === 'account') { await show('account'); return }
    if (act === 'scrapbook') { await show('scrapbook'); return }
    if (act === 'about') { await show('welcome'); return }
    if (act === 'start-egg') { await startEgg(); await show('egg'); return }
    // Sign in from the front door: the account may already hold an Axie, so land wherever it says.
    if (act === 'ronin-welcome') { await roninSignIn(); await show('auto'); return }
    if (act === 'photo') { if (b) sheet(photoViewHtml(b, a.dataset.id || '')); return }
    // From the viewer: the photo leaves the book (bond and snap count stay), and the book redraws.
    if (act === 'unkeep-photo') {
      const id = a.dataset.id || ''
      if (!id || !confirm('Take this photo out of the scrapbook? The snap still counts.')) return
      hideSheet()
      await unkeepPhoto(id)
      await show(sections.scrapbook.hidden ? 'home' : 'scrapbook')
      return
    }
    // Signing in from the Account screen stays on it: the point is to keep what you have, not to pick.
    if (act === 'ronin-account') { await roninSignIn(); await show('account'); return }
    if (act === 'select-axie') { claimPick = a.dataset.id || null; await show('claim'); return }
    if (act === 'pick-axie') {
      // Claiming replaces an unhatched egg, and the snaps already in it are lost work — say so
      // before it happens rather than after.
      const pendingSnaps = b && !b.hatchedAt ? b.egg.snaps : 0
      if (pendingSnaps >= 1 && !confirm(`Your egg with ${pendingSnaps} snaps will be set aside. Continue?`)) return
      const r = await claim(a.dataset.id!)
      pendingLines = r.lines
      await show('hatch')
      return
    }
    if (act === 'fresh-egg') {
      if (!confirm(`${b?.name || 'Your Axie'} will rest while you raise a new egg. You can switch back any time from Profile. Continue?`)) return
      await retire()
      await show('egg')
      return
    }
    if (act === 'switch') {
      // Switching away from an unhatched egg discards it server-side, exactly like a claim does —
      // the snaps in it are lost work, so say so first.
      const pendingSnaps = b && !b.hatchedAt ? b.egg.snaps : 0
      if (pendingSnaps >= 1 && !confirm(`Your egg with ${pendingSnaps} snaps will be set aside. Continue?`)) return
      await switchTo(a.dataset.id!)
      await show('auto')
      return
    }
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
      sheet(`<p class="bd-eyebrow">Recovery code</p><h2 class="bd-code">${esc(code)}</h2>
        <p class="bd-small">Screenshot this. Enter it on another phone to move your Axie there. It works once.</p>
        <div class="bd-actions"><button type="button" class="bd-btn bd-btn-primary bd-grow" data-action="close-sheet">Done</button></div>`)
      return
    }
    if (act === 'recover') {
      const code = prompt('Recovery code')
      if (code) { await redeemRecovery(code); await show('auto') }
      return
    }
    // After-the-shot sheets: Retake drops back to the camera, everything else walks the
    // queue main.ts filled from the snap result and lands on Home when it runs dry.
    if (act === 'retake') { nav.clearSheetQueue(); hideSheet(); nav.goSnap(); return }
    if (act === 'save' || act === 'sheet-next') { nav.onSheetNext(); return }
    // "Don't keep this one" / "Skip": the photo goes, and with it the rest of the sheets it
    // brought. Bond and snap count already earned stay — the shot happened.
    if (act === 'unkeep') {
      const photoId = nav.lastPhotoId()
      nav.clearSheetQueue()
      hideSheet()
      if (photoId) await unkeepPhoto(photoId)
      await show('home')
      nav.toast('Not kept')
      return
    }
    if (act === 'close-sheet') { hideSheet(); return }
    // The retry on the boot-failure card: the same two steps boot itself runs, and if they fail
    // again the card comes straight back rather than an alert over a blank page.
    if (act === 'retry-boot') {
      try {
        await loadBuddy()
        await show('auto')
      } catch {
        showBootError()
      }
      return
    }
  }

  return { show, sheet, hideSheet, showBootError }
}
