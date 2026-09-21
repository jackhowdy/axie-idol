/**
 * Axie Idol: the camera (live viewfinder, sticker, capture, review, post) and boot.
 * The buddy screens live in buddyScreens.ts / buddyHtml.ts.
 */

import { icon } from './icons'
import { createAxie3D, getAxieMixer, isAxieMixerReady, parsePartId, type Axie3D, type Axie3DSpec } from './axie3d'
import {
  bindDeviceKey, loadBuddy, buddyState, faceIdForBuddy, snapContext, beforeLine,
  wear, lsGet, lsSet, buddyHeaders,
  type SnapResult,
} from './buddy'
import { fallbackAxieSvg } from './fallbackAxie'
import { loadAxieArt, jointsFor2D, ITEM_ANCHORS_2D, BEHIND_2D, type Art2D } from './axie2d.ts'
import { drawSpeechBubble, type BubbleAnchor } from './speechBubble'
import { mountBuddyScreens, screenFromHash } from './buddyScreens'
import { reactionHtml, momentHtml, unlockHtml, joyHtml, vfChipHtml, wishPillHtml, frameTrayHtml, wardrobeTrayHtml, eggLine } from './buddyHtml.ts'
import {
  FRAME_IDS, drawFrame, drawWardrobe, isFrameId, offsetJoints, preloadWardrobe, wardrobeSprite2D,
  type FrameId,
} from './wardrobe'

/**
 * What can sit on the camera: `buddy` (the hatched Axie: official 2D art for a real one, the
 * mixer's 3D rig for a hatched one) or `egg` (a flat SVG sprite).
 */
type FaceId = 'buddy' | 'egg'

/** Egg sprite stage: 1 under five snaps, 2 from five, 3 from twenty. */
function eggStage(): 1 | 2 | 3 {
  const s = buddyState.active?.egg.snaps ?? 0
  return s >= 20 ? 3 : s >= 5 ? 2 : 1
}
function eggSpriteUrl(): string {
  return `/previews/egg-${eggStage()}.svg`
}

function mascotStickerUrl(id: FaceId): string {
  // The unhatched buddy is a flat sprite; the hatched one has no flat sticker of its own.
  return id === 'egg' ? eggSpriteUrl() : ''
}

/* --- Guest session + device key --- */
const GUEST_SESSION_KEY = 'axieIdol.guestId'
const GUEST_REMEMBERED_LS = 'axieIdol.guestId'
const RONIN_LS = 'axieIdol.roninAddress'
const DEVICE_KEY_LS = 'axieIdol.deviceKey'
/** Set once the live camera has started successfully, so later Snap taps skip the enable gate. */
const CAMERA_OK_LS = 'axieIdol.cameraOk'

function shortGuestLabel(guestId: string): string {
  const short = guestId.replace(/-/g, '').slice(0, 4).toUpperCase()
  return `Guest-${short}`
}

/** Normalize 0x / ronin: address (lowercase). Empty if invalid. */
function normalizeAddressClient(raw: string): string {
  let a = (raw || '').trim()
  if (!a) return ''
  if (a.toLowerCase().startsWith('ronin:')) a = '0x' + a.slice(6)
  a = a.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(a)) return ''
  return a
}

function newGuestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Ephemeral session guest (not registered). */
function ensureEphemeralGuest(): { guestId: string; authorLabel: string } {
  let guestId = sessionStorage.getItem(GUEST_SESSION_KEY)
  if (!guestId) {
    guestId = newGuestId()
    sessionStorage.setItem(GUEST_SESSION_KEY, guestId)
  }
  return { guestId, authorLabel: shortGuestLabel(guestId) }
}

/** Remembered guest for a device with a saved Ronin address: persists in localStorage. */
function ensureRememberedGuest(): { guestId: string; authorLabel: string } {
  let guestId = localStorage.getItem(GUEST_REMEMBERED_LS)
  if (!guestId) {
    guestId = sessionStorage.getItem(GUEST_SESSION_KEY) || newGuestId()
    localStorage.setItem(GUEST_REMEMBERED_LS, guestId)
  }
  // Keep the session copy in sync so the guest id is stable in this tab
  sessionStorage.setItem(GUEST_SESSION_KEY, guestId)
  return { guestId, authorLabel: shortGuestLabel(guestId) }
}

function loadSavedRoninAddress(): string {
  try {
    return normalizeAddressClient(localStorage.getItem(RONIN_LS) || '')
  } catch {
    return ''
  }
}

function ensureGuestIdentity(connected: boolean): { guestId: string; authorLabel: string } {
  return connected ? ensureRememberedGuest() : ensureEphemeralGuest()
}

function ensureDeviceKey(): string {
  let key = localStorage.getItem(DEVICE_KEY_LS)
  if (!key) {
    key =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(DEVICE_KEY_LS, key)
  }
  return key
}

function isDevMode(): boolean {
  return new URLSearchParams(window.location.search).get('dev') === '1'
}

type Facing = 'user' | 'environment'

interface StickerState {
  x: number // center px in viewfinder
  y: number
  scale: number
  rotation: number // degrees
  gyroX: number
  gyroY: number
}

const video = document.querySelector<HTMLVideoElement>('#video')!
const uploadPreview = document.querySelector<HTMLImageElement>('#upload-preview')!
const stickerImg = document.querySelector<HTMLImageElement>('#sticker')!
const stickerLayer = document.querySelector<HTMLElement>('#sticker-layer')!
const viewfinder = document.querySelector<HTMLElement>('#viewfinder')!
const previewScreen = document.querySelector<HTMLElement>('#preview')!
/** One-Axie loop camera HUD (VITE_BUDDY=1): buddy chip, today's wish, the before-the-shot line. */
const bdChip = document.querySelector<HTMLElement>('#bd-chip')
const bdWishPill = document.querySelector<HTMLElement>('#bd-wish-pill')
const bdSpeechVf = document.querySelector<HTMLElement>('#bd-speech-vf')
let bdSpeechTimer: number | null = null
const previewImg = document.querySelector<HTMLImageElement>('#preview-img')!
const frameCanvas = document.querySelector<HTMLCanvasElement>('#frame-canvas')!
const cameraDenied = document.querySelector<HTMLElement>('#camera-denied')!
const cameraGate = document.querySelector<HTMLElement>('#camera-gate')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const captureInput = document.querySelector<HTMLInputElement>('#capture-input')!
const captureInputUser = document.querySelector<HTMLInputElement>('#capture-input-user')!
const btnEnableCamera = document.querySelector<HTMLButtonElement>('#btn-enable-camera')!
const btnNativeCamera = document.querySelector<HTMLButtonElement>('#btn-native-camera')!
const btnFlip = document.querySelector<HTMLButtonElement>('#btn-flip')!
const btnCapture = document.querySelector<HTMLButtonElement>('#btn-capture')!
const btnUpload = document.querySelector<HTMLButtonElement>('#btn-upload')!
const btnRotateCw = document.querySelector<HTMLButtonElement>('#btn-rotate-cw')!
const btnRotateCcw = document.querySelector<HTMLButtonElement>('#btn-rotate-ccw')!
const btnZoomIn = document.querySelector<HTMLButtonElement>('#btn-zoom-in')!
const btnZoomOut = document.querySelector<HTMLButtonElement>('#btn-zoom-out')!
const btnRetake = document.querySelector<HTMLButtonElement>('#btn-retake')!
const btnDownload = document.querySelector<HTMLAnchorElement>('#btn-download')!
const btnPost = document.querySelector<HTMLButtonElement>('#btn-post')!
const postToast = document.querySelector<HTMLElement>('#post-toast')!
const liveToast = document.querySelector<HTMLElement>('#live-toast')!
// The toast was born inside the camera screen, which is hidden everywhere else: a pat on Home said
// "+2 happy" to nobody. It belongs to the whole app.
document.querySelector('#app')?.appendChild(liveToast)

// Paint SVG icons into every [data-icon] placeholder once
for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  el.innerHTML = icon(el.dataset.icon || 'chevron', 24)
}
const captionInput = document.querySelector<HTMLInputElement>('#caption-input')!
/** One-Axie loop: worn-item overlay over the live 3D canvas, and the photo-frame picker. */
const wardrobeOverlay = document.querySelector<HTMLCanvasElement>('#wardrobe-overlay')
const frameTray = document.querySelector<HTMLElement>('#frame-tray')
/** The wardrobe chips in the camera tray. */
const wardrobeTray = document.querySelector<HTMLElement>('#wardrobe-tray')
const mascotLoading = document.querySelector<HTMLElement>('#mascot-loading')!
const mascotLoadingText = document.querySelector<HTMLElement>('#mascot-loading-text')!

let stream: MediaStream | null = null
/** Idol defaults to world-facing camera */
let facing: Facing = 'environment'
let mode: 'camera' | 'upload' = 'camera'
let captureUrl: string | null = null
let captureBlob: Blob | null = null
let cameraStarted = false
let guestId = ''
let authorLabel = ''
let deviceKey = ''
/** The buddy screens; mounted at boot. */
let buddyUi: ReturnType<typeof mountBuddyScreens> | null = null
let posting = false
/** Mixer-backed animated 3D Axie (a hatched buddy; a numeric Axie in ?dev=1). */
let axie3d: Axie3D | null = null

function is3DMixerFace(id: string): boolean {
  if (id === 'buddy' && realBuddyAxieId()) return false
  return /^\d+$/.test(id) || id === 'buddy' || (isDevMode() && id.startsWith('dev:'))
}

/**
 * A real Axie (played by its number, or owned) is shown as its official 2D art: its owner knows
 * that picture by heart, and the 3D rig is an approximation. Hatched Axies have no official art
 * and stay in 3D. Returns the Axie number, or null for an egg or a hatched Axie.
 */
function realBuddyAxieId(): string | null {
  const b = buddyState.active
  return b?.hatchedAt && b.kind !== 'wild' && b.axieId ? b.axieId : null
}
/** The cropped art on the camera layer right now, when the live face is a real Axie. */
let art2d: Art2D | null = null

async function specForFace(id: string): Promise<Axie3DSpec | null> {
  // The one-Axie buddy: a wild Axie carries its own generated descriptor, an owned one
  // resolves through the numeric genes path below. Unhatched -> no 3D face at all.
  if (id === 'buddy') {
    const b = buddyState.active
    if (!b || !b.hatchedAt) return null
    if (b.kind === 'wild' && b.descriptor) return { kind: 'descriptor', descriptor: b.descriptor, label: b.name || 'Axie' }
    if (b.axieId) return specForFace(b.axieId)
    return null
  }
  if (isDevMode() && id.startsWith('dev:')) {
    // Dev preview of arbitrary part ids (used to check derived pack parts)
    const parts = id
      .slice(4)
      .split(',')
      .map(parsePartId)
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    return { kind: 'descriptor', descriptor: { colorVariant: 0, body: 'normal', parts }, label: id }
  }
  if (/^\d+$/.test(id)) {
    const res = await fetch(`/api/axie/${encodeURIComponent(id)}?v=2`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`genes ${res.status}`)
    const data = (await res.json()) as {
      genes?: string
      name?: string
      parts?: { type: string; stage: number; specialGenes?: string | null }[]
      bodyShape?: string | null
      class?: string | null
    }
    if (!data.genes) throw new Error('no genes')
    const stages: Record<string, 1 | 2> = {}
    for (const p of data.parts || []) {
      // marketplace uses eyes/ears; the mixer descriptor uses eye/ear
      const type = p.type === 'eyes' ? 'eye' : p.type === 'ears' ? 'ear' : p.type
      stages[type] = p.stage === 2 ? 2 : 1
    }
    const mysticParts = (data.parts || []).filter((p) => p.specialGenes === 'Mystic').length
    return {
      kind: 'genes',
      genes: data.genes,
      label: data.name || `Axie #${id}`,
      stages,
      bodyShape: data.bodyShape ?? null,
      mysticParts,
      axieId: id,
      axieClass: data.class ?? null,
    }
  }
  return null
}

/** Warm the mixer manifest (~9 MB, cached) shortly after boot so the first 3D face on Snap is quick. */
function warmAxieMixer(): void {
  const go = () => void getAxieMixer().catch(() => {})
  const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void }
  if (w.requestIdleCallback) w.requestIdleCallback(go)
  else window.setTimeout(go, 3000)
}

/* ---- One-Axie loop: the worn item pinned to the 3D rig's joints, and the photo frame ---- */

/** R1 keeps the frame choice on the device — the buddy record has no frame field yet. */
const FRAME_LS = 'axieIdol.frame'
let wardrobeCtx: CanvasRenderingContext2D | null = null
/** Mirrors `#wardrobe-overlay`'s `hidden` (it starts hidden in index.html) — never read back off it. */
let wardrobeOverlayShown = false

function activeFrame(): FrameId {
  const saved = lsGet(FRAME_LS)
  return isFrameId(saved) ? saved : 'none'
}

/** Frames arrive with the cape, at bond level 5. */
function framesUnlocked(): boolean {
  return Boolean(buddyState.active?.wardrobe.unlocked.includes('cape')) || isIdol()
}
/** Stardom, from the joy days: an Idol has the gold frame, a Star or an Idol a gold star on its photos. */
function isIdol(): boolean { return buddyState.active?.joy?.title?.id === 'idol' }
function hasPhotoStar(): boolean { const t = buddyState.active?.joy?.title?.id; return t === 'star' || t === 'idol' }
/** The frames on offer: the three everyone earns with the cape, and gold for an Idol. */
function offeredFrames(): readonly string[] {
  const capeFrames = buddyState.active?.wardrobe.unlocked.includes('cape')
  return FRAME_IDS.filter((id) => id === 'none' || (id === 'gold' ? isIdol() : capeFrames))
}

function syncFrameTray(): void {
  if (!frameTray) return
  const on = framesUnlocked()
  frameTray.innerHTML = on ? frameTrayHtml(offeredFrames(), activeFrame()) : ''
  frameTray.hidden = !on
}

/**
 * The Mystic glow, bond level 10. No new art: the live 3D layer and the Home hero box get a CSS
 * drop-shadow halo, and `captureComposite` paints the same colour into the photo.
 */
function buddyGlowOn(): boolean {
  return (buddyState.active?.level ?? 0) >= 10
}
function syncBuddyGlow(): void {
  stickerLayer.classList.toggle('bd-glow', buddyGlowOn())
}

/** The buddy's wardrobe chips. Empty (and hidden) with no active hatched Axie. */
function syncWardrobeTray(): void {
  if (!wardrobeTray) return
  const html = wardrobeTrayHtml(buddyState.active)
  wardrobeTray.innerHTML = html
  wardrobeTray.hidden = !html
}

/** The camera tray: the wardrobe, the glow, and the sample photos. Follows `buddyState`. */
function syncCameraTrays(): void {
  syncWardrobeTray()
  syncBuddyGlow()
  syncSampleTray()
}

wardrobeTray?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.wardrobe-chip') as HTMLButtonElement | null
  if (!btn || btn.disabled) return
  e.preventDefault()
  const item = btn.dataset.wear
  if (!item) return
  // Tapping the worn item takes it off. The 3D overlay reads `buddyState` on every frame, so the
  // sprite follows on its own once the server has answered.
  const next = buddyState.active?.wardrobe.worn === item ? null : item
  void wear(next)
    .then(() => syncWardrobeTray())
    .catch((err: unknown) => showLiveToast((err as Error).message || 'Could not change that', 2000))
})

/** The worn item, or null when nothing is worn or the live face is not the buddy character. */
function wornItem(): string | null {
  if (activeCast !== 'buddy') return null
  return buddyState.active?.wardrobe.worn ?? null
}

/**
 * Match an overlay's backing store to the 3D canvas's pixel density across the overlay's own
 * (larger) CSS box, and return the offset from 3D-canvas pixels into overlay pixels. Both boxes are
 * centred on the same point, so the offset is half the difference. Null until both are laid out.
 */
function syncOverlaySize(
  overlay: HTMLCanvasElement,
  src: HTMLCanvasElement,
): { dx: number; dy: number } | null {
  const cw = overlay.clientWidth
  const ch = overlay.clientHeight
  if (cw < 8 || ch < 8 || src.clientWidth < 8 || src.width < 8) return null
  const density = src.width / src.clientWidth
  const w = Math.max(8, Math.round(cw * density))
  const h = Math.max(8, Math.round(ch * density))
  if (overlay.width !== w) overlay.width = w
  if (overlay.height !== h) overlay.height = h
  return { dx: (w - src.width) / 2, dy: (h - src.height) / 2 }
}

/** The overlay tracks the sticker's own left/top/transform so the two boxes stay concentric. */
function positionWardrobeOverlay(): void {
  if (!wardrobeOverlay || !wardrobeOverlayShown) return
  wardrobeOverlay.style.left = `${state.x + state.gyroX}px`
  wardrobeOverlay.style.top = `${state.y + state.gyroY}px`
  wardrobeOverlay.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg) scale(${state.scale})`
}

/**
 * Show or hide the overlay, writing the attribute only on a transition (tracked here, never read
 * back off the element). Returns true when this call made it visible.
 *
 * Visibility MUST be set before any measurement: `hidden` is `display: none`, and a `display: none`
 * element reports `clientWidth`/`clientHeight` of 0 — so measuring first and unhiding afterwards
 * leaves the overlay hidden for ever. Hiding also clears the canvas, so a later unhide on a frame
 * that cannot measure yet can never flash stale pixels.
 */
function setWardrobeOverlayShown(show: boolean): boolean {
  if (!wardrobeOverlay || show === wardrobeOverlayShown) return false
  wardrobeOverlayShown = show
  wardrobeOverlay.hidden = !show
  if (!show && wardrobeCtx) wardrobeCtx.clearRect(0, 0, wardrobeCtx.canvas.width, wardrobeCtx.canvas.height)
  return show
}

/**
 * The same overlay over a 2D Axie: the joints are fractions of the picture as it is laid out, and
 * the overlay's backing store follows the screen's pixel density instead of a WebGL canvas's.
 */
function drawWardrobeOverlay2D(worn: string, art: Art2D): void {
  if (!wardrobeOverlay) return
  if (setWardrobeOverlayShown(true)) positionWardrobeOverlay()
  const cw = wardrobeOverlay.clientWidth, ch = wardrobeOverlay.clientHeight
  const iw = stickerImg.clientWidth, ih = stickerImg.clientHeight
  if (cw < 8 || ch < 8 || iw < 8 || ih < 8) return
  const density = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(cw * density), h = Math.round(ch * density)
  if (wardrobeOverlay.width !== w) wardrobeOverlay.width = w
  if (wardrobeOverlay.height !== h) wardrobeOverlay.height = h
  if (!wardrobeCtx || wardrobeCtx.canvas !== wardrobeOverlay) wardrobeCtx = wardrobeOverlay.getContext('2d')
  if (!wardrobeCtx) return
  const joints = jointsFor2D(iw * density, ih * density, art.topMid)
  drawWardrobe(wardrobeCtx, worn, offsetJoints(joints, (w - iw * density) / 2, (h - ih * density) / 2), wardrobeSprite2D, ITEM_ANCHORS_2D)
  // a cape hangs behind the picture; everything else sits on it
  wardrobeOverlay.classList.toggle('behind', BEHIND_2D.includes(worn))
}
/** A still picture has no frame loop of its own: this one runs only while a 2D Axie is on the layer. */
let art2dLoop = 0
function runArt2DLoop(): void {
  cancelAnimationFrame(art2dLoop)
  const step = (): void => {
    if (!art2d) return
    drawWardrobeOverlay()
    art2dLoop = requestAnimationFrame(step)
  }
  art2dLoop = requestAnimationFrame(step)
}

/** Runs on every 3D frame: clear the overlay and stamp the worn sprite on its joint. */
function drawWardrobeOverlay(): void {
  if (!wardrobeOverlay) return
  const worn = wornItem()
  if (worn && art2d && !stickerImg.hidden) { drawWardrobeOverlay2D(worn, art2d); return }
  if (!worn || !axie3d?.ready) {
    setWardrobeOverlayShown(false)
    return
  }
  // visible first, then measured — see setWardrobeOverlayShown
  if (setWardrobeOverlayShown(true)) positionWardrobeOverlay()
  const pad = syncOverlaySize(wardrobeOverlay, axie3d.canvas)
  // not laid out yet (the camera pane is still opening): stay visible but empty, retry next frame
  if (!pad) return
  if (!wardrobeCtx || wardrobeCtx.canvas !== wardrobeOverlay) wardrobeCtx = wardrobeOverlay.getContext('2d')
  if (!wardrobeCtx) return
  drawWardrobe(wardrobeCtx, worn, offsetJoints(axie3d.jointScreenPositions(), pad.dx, pad.dy))
}

/** 1x1 transparent GIF: a src that can never paint anything, whatever the hidden flag says. */
const BLANK_STICKER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * Hide the `<img>` sticker because a 3D face has taken over the layer, and drop whatever it
 * was pointing at. Leaving the old src loaded meant a hatched buddy still carried `/previews/egg-1.svg`
 * underneath, which could flash on a slow device between the hide and the 3D canvas painting.
 */
function hideStickerImg(): void {
  stickerImg.hidden = true
  stickerImg.style.pointerEvents = 'none'
  if (stickerImg.getAttribute('src') !== BLANK_STICKER) stickerImg.src = BLANK_STICKER
  stickerImg.alt = ''
}

function disposeAxie3D(): void {
  if (!axie3d) return
  setWardrobeOverlayShown(false)
  axie3d.onFrame(null)
  axie3d.dispose()
  axie3d = null
  stickerImg.hidden = false
  stickerImg.style.pointerEvents = 'auto'
  bindStickerPointers(stickerImg)
  applyStickerTransform()
}

/**
 * Field report for a phone we cannot reproduce. The 3D rig is the one part of the app that can
 * fail with nothing visible on any log here — an iPhone showed the egg and never the hatched
 * Axie. Fire-and-forget: diagnostics must never break, block or slow the camera, and one report
 * per kind per page load keeps a failing device from spending its whole rate bucket on shouting.
 */
const diagSent = new Set<string>()
function reportDiag(kind: string, message: string, extra: Record<string, unknown> = {}): void {
  if (diagSent.has(kind)) return
  diagSent.add(kind)
  try {
    const body = JSON.stringify({
      kind,
      message: String(message).slice(0, 400),
      ua: navigator.userAgent,
      extra: {
        webgl2: Boolean(document.createElement('canvas').getContext('webgl2')),
        mem: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        spec: buddyState.active?.kind ?? null,
        ...extra,
      },
    })
    void fetch('/api/diag', { method: 'POST', headers: buddyHeaders(), body, keepalive: true }).catch(() => undefined)
  } catch {
    /* a report that cannot be built is not worth a broken camera */
  }
}

/** Show a mixer-backed 3D face on the camera; PNG stays until the model is ready. */
async function showAxie3D(id: string, req: number): Promise<boolean> {
  const warming = !isAxieMixerReady()
  if (warming) setMascotLoading(true, 'Warming up the 3D Axies… first time takes a moment')
  try {
    const spec = await specForFace(id)
    if (!spec) {
      // A hatched buddy always has a spec; no spec for one is a real failure worth reporting.
      // An unhatched egg legitimately has none, and says nothing.
      if (id === 'buddy' && buddyState.active?.hatchedAt) reportDiag('3d-load-failed', 'no 3D spec for the hatched buddy')
      return false
    }
    if (req !== castRequest) return false
    if (!axie3d) {
      axie3d = createAxie3D('axie3d')
      axie3d.canvas.className = 'axie3d-canvas'
      stickerLayer.appendChild(axie3d.canvas)
      // the worn wardrobe item redraws with the rig, on the overlay above this canvas
      axie3d.onFrame(drawWardrobeOverlay)
    }
    const ok = await axie3d.load(spec)
    if (req !== castRequest) return false
    if (!ok) {
      if (id === 'buddy') reportDiag('3d-load-failed', 'mixer load returned false')
      return false
    }
    hideStickerImg()
    // bindStickerPointers() sets stickerTarget itself: assigning it first made the bind a no-op
    // (same target, already bound), so the 3D character never took the drag from the old sticker.
    bindStickerPointers(axie3d.canvas)
    applyStickerTransform()
    axie3d.resume()
    console.info('[axie-idol] mixer 3D active', id)
    return true
  } catch (err) {
    console.warn('[axie-idol] mixer 3D failed', id, err)
    if (id === 'buddy') reportDiag('3d-load-failed', err instanceof Error ? err.message : String(err))
    return false
  } finally {
    if (warming && req === castRequest) setMascotLoading(false)
  }
}

/** The face on the camera. Null until the camera first opens, which always selects the buddy's. */
let activeCast: FaceId | null = null
let castRequest = 0
/** ?dev=1 only: a numeric Axie ID put on the camera from the Axie ID bar; null otherwise. */
let customAxieId: string | null = null
/** A Ronin address saved on this device by an earlier version (normalized 0x…), or ''. */
let roninAddress = ''
/** Label for the ?dev=1 Axie ID sticker */
let ownedAuthorLabel: string | null = null
/** Interactive hit target: 3D canvas or PNG img */
let stickerTarget: HTMLElement = stickerImg

const state: StickerState = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: -8,
  gyroX: 0,
  gyroY: 0,
}

/** Sticker scale limits — wide enough to shrink for framing and grow back via pinch/+ */
const SCALE_MIN = 0.25
const SCALE_MAX = 4.0

function isMobileLike(): boolean {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  return coarse && navigator.maxTouchPoints > 1
}

function secureContextLabel(): string {
  return `isSecureContext=${String(window.isSecureContext)}`
}

/** Ensure mediaDevices object exists when possible, then return it. */
function ensureMediaDevices(): MediaDevices | null {
  const nav = navigator as Navigator & { mediaDevices?: MediaDevices }
  if (!nav.mediaDevices) {
    try {
      Object.defineProperty(nav, 'mediaDevices', {
        value: {},
        configurable: true,
        writable: true,
      })
    } catch {
      try {
        ;(nav as { mediaDevices: MediaDevices }).mediaDevices = {} as MediaDevices
      } catch {
        return null
      }
    }
  }
  return nav.mediaDevices ?? null
}

function cameraApiUnavailableMessage(): string {
  const secure = window.isSecureContext
  const devices = ensureMediaDevices()
  const hasGum = typeof devices?.getUserMedia === 'function'

  console.warn('[axie-idol] Camera API unavailable', {
    isSecureContext: secure,
    hasMediaDevices: Boolean(devices),
    hasGetUserMedia: hasGum,
  })

  if (!devices || !hasGum) {
    if (secure) {
      return `Open in Safari (not an in-app browser) over HTTPS. (${secureContextLabel()})`
    }
    return `Camera API not available in this browser. (${secureContextLabel()}) — use HTTPS / Safari, or Use iPhone Camera / gallery.`
  }
  return `Camera API not available in this browser. (${secureContextLabel()})`
}

function resetStickerCenter(): void {
  const rect = viewfinder.getBoundingClientRect()
  // When the camera is hidden (a buddy screen is up), rect is 0×0 — fall back so we never
  // leave the sticker at top-left (0,0) with translate(-50%,-50%).
  const w = rect.width > 40 ? rect.width : window.innerWidth
  const h = rect.height > 40 ? rect.height : window.innerHeight
  state.x = w / 2
  // Slightly above geometric center so Axie sits in the viewfinder sweet spot
  // (not over the bottom toolbar).
  state.y = h * 0.42
  applyStickerTransform()
}

/** Recenter after layout — viewfinder often measures 0×0 until paint. */
function scheduleStickerCenter(): void {
  resetStickerCenter()
  requestAnimationFrame(() => {
    resetStickerCenter()
    requestAnimationFrame(() => resetStickerCenter())
  })
}

function applyStickerTransform(): void {
  const gx = state.gyroX
  const gy = state.gyroY
  stickerTarget.style.left = `${state.x + gx}px`
  stickerTarget.style.top = `${state.y + gy}px`
  stickerTarget.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg) scale(${state.scale})`
  positionWardrobeOverlay()
}

function showCameraGate(show: boolean): void {
  cameraGate.hidden = !show
}

function hideCameraGate(): void {
  cameraGate.hidden = true
  scheduleStickerCenter()
}

async function startCamera(nextFacing: Facing = facing): Promise<boolean> {
  stopCamera()
  facing = nextFacing

  const devices = ensureMediaDevices()
  if (!devices || typeof devices.getUserMedia !== 'function') {
    showCameraFallback(cameraApiUnavailableMessage())
    showCameraGate(true)
    return false
  }

  try {
    stream = await devices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    video.srcObject = stream
    video.hidden = false
    uploadPreview.hidden = true
    cameraDenied.hidden = true
    mode = 'camera'
    syncUploadFit()
    cameraStarted = true
    lsSet(CAMERA_OK_LS, '1')
    video.classList.toggle('mirror', facing === 'user')
    await video.play().catch(() => undefined)
    btnFlip.disabled = false
    hideCameraGate()
    return true
  } catch (err) {
    console.warn('[axie-idol] getUserMedia failed', err, { isSecureContext: window.isSecureContext })
    showCameraFallback(
      `Camera blocked — try Enable Camera again, Use iPhone Camera, or gallery. (${secureContextLabel()})`,
    )
    showCameraGate(true)
    return false
  }
}

function stopCamera(): void {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  video.srcObject = null
}

function showCameraFallback(message: string): void {
  mode = 'upload'
  video.hidden = true
  cameraDenied.hidden = false
  cameraDenied.textContent = message
  syncSampleTray()
  btnFlip.disabled = true
}

/**
 * A still photo whose shape is far from the viewfinder's (a portrait photo on a wide desktop
 * window, a landscape one on a phone) is shown whole over a blurred copy of itself, instead of
 * being cropped to a sliver. The capture draws the same thing, so the photo matches the view.
 */
function uploadShownWhole(): boolean {
  if (mode !== 'upload' || uploadPreview.hidden || !uploadPreview.naturalWidth) return false
  const vf = viewfinder.getBoundingClientRect()
  if (!vf.width || !vf.height) return false
  const photo = uploadPreview.naturalWidth / uploadPreview.naturalHeight
  const frame = vf.width / vf.height
  // A different orientation always qualifies. The same orientation only when the shapes are far
  // apart: a phone photo on a slightly taller phone screen keeps filling it, as it always has.
  if ((photo < 1) !== (frame < 1)) return true
  return Math.max(photo / frame, frame / photo) > 1.6
}
function syncUploadFit(): void {
  const whole = uploadShownWhole()
  viewfinder.classList.toggle('vf-whole', whole)
  viewfinder.style.setProperty('--upload-url', whole ? `url("${uploadPreview.src}")` : 'none')
}
window.addEventListener('resize', syncUploadFit)

function loadUpload(file: File): void {
  const url = URL.createObjectURL(file)
  uploadPreview.onload = () => {
    uploadPreview.hidden = false
    video.hidden = true
    mode = 'upload'
    syncUploadFit()
    cameraDenied.hidden = true
    hideCameraGate()
    // Still photo path — no live stream
    stopCamera()
    cameraStarted = false
    btnFlip.disabled = true
  }
  uploadPreview.src = url
}

/* --- pointer / touch transform --- */
let dragging = false
let dragId: number | null = null
let lastX = 0
let lastY = 0
const activePointers = new Map<number, { x: number; y: number }>()
let pinchStartDist = 0
let pinchStartScale = 1
let pinchStartAngle = 0
let pinchStartRotation = 0
let rotatingWithTwoFingers = false
let pointerBound = false

function pointerPos(e: PointerEvent): { x: number; y: number } {
  const rect = viewfinder.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function angle(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

function onPointerDown(e: PointerEvent): void {
  e.preventDefault()
  stickerTarget.setPointerCapture(e.pointerId)
  // Raise layer above .chrome (z-index 5) so drag continues over toolbar
  stickerLayer.style.zIndex = '6'
  stickerTarget.style.zIndex = '6'
  activePointers.set(e.pointerId, pointerPos(e))
  if (activePointers.size === 1) {
    dragging = true
    dragId = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
  } else if (activePointers.size === 2) {
    dragging = false
    rotatingWithTwoFingers = true
    const pts = [...activePointers.values()]
    pinchStartDist = dist(pts[0], pts[1])
    pinchStartScale = state.scale
    pinchStartAngle = angle(pts[0], pts[1])
    pinchStartRotation = state.rotation
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!activePointers.has(e.pointerId)) return
  activePointers.set(e.pointerId, pointerPos(e))

  if (activePointers.size >= 2 && rotatingWithTwoFingers) {
    const pts = [...activePointers.values()]
    const d = dist(pts[0], pts[1])
    if (pinchStartDist > 0) {
      state.scale = clamp(pinchStartScale * (d / pinchStartDist), SCALE_MIN, SCALE_MAX)
    }
    const a = angle(pts[0], pts[1])
    state.rotation = pinchStartRotation + (a - pinchStartAngle)
    applyStickerTransform()
    return
  }

  if (dragging && e.pointerId === dragId) {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    state.x += dx
    state.y += dy
    applyStickerTransform()
  }
}

function endPointer(e: PointerEvent): void {
  activePointers.delete(e.pointerId)
  if (e.pointerId === dragId) {
    dragging = false
    dragId = null
  }
  if (activePointers.size < 2) {
    rotatingWithTwoFingers = false
  }
  if (activePointers.size === 1) {
    const [id, pos] = [...activePointers.entries()][0]
    dragging = true
    dragId = id
    const rect = viewfinder.getBoundingClientRect()
    lastX = pos.x + rect.left
    lastY = pos.y + rect.top
  }
  if (activePointers.size === 0) {
    stickerTarget.style.zIndex = '1'
    stickerLayer.style.zIndex = '2'
  }
}

function bindStickerPointers(el: HTMLElement): void {
  if (pointerBound && stickerTarget === el) return
  if (pointerBound) {
    stickerTarget.removeEventListener('pointerdown', onPointerDown)
    stickerTarget.removeEventListener('pointermove', onPointerMove)
    stickerTarget.removeEventListener('pointerup', endPointer)
    stickerTarget.removeEventListener('pointercancel', endPointer)
  }
  stickerTarget = el
  stickerTarget.addEventListener('pointerdown', onPointerDown)
  stickerTarget.addEventListener('pointermove', onPointerMove)
  stickerTarget.addEventListener('pointerup', endPointer)
  stickerTarget.addEventListener('pointercancel', endPointer)
  pointerBound = true
  applyStickerTransform()
}

/* --- viewfinder-wide two-finger pinch (hit target does not shrink with CSS scale) --- */
const vfPointers = new Map<number, { x: number; y: number }>()
let vfPinching = false
let vfPinchStartDist = 0
let vfPinchStartScale = 1
let vfPinchStartAngle = 0
let vfPinchStartRotation = 0

function isUiChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.chrome, .toolbar, .prop-tray, .camera-gate, button, a, input, label, form',
    ),
  )
}

function beginVfPinch(): void {
  const pts = [...vfPointers.values()]
  if (pts.length < 2) return
  vfPinching = true
  dragging = false
  rotatingWithTwoFingers = true
  vfPinchStartDist = dist(pts[0], pts[1])
  vfPinchStartScale = state.scale
  vfPinchStartAngle = angle(pts[0], pts[1])
  vfPinchStartRotation = state.rotation
  // Keep sticker pinch start in sync so sticker-local 2-finger path matches
  pinchStartDist = vfPinchStartDist
  pinchStartScale = vfPinchStartScale
  pinchStartAngle = vfPinchStartAngle
  pinchStartRotation = vfPinchStartRotation
}

function isStickerPointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target === stickerTarget) return true
  // the wardrobe overlay is pointer-events: none, so it is never a target — excluded anyway so a
  // future CSS change cannot silently steal the drag from the character underneath it
  return Boolean(target.closest('#sticker, #axie3d, #sticker-layer canvas:not(.wardrobe-overlay)'))
}

function onVfPointerDown(e: PointerEvent): void {
  if (isUiChromeTarget(e.target)) return

  vfPointers.set(e.pointerId, pointerPos(e))
  // Only capture when the finger did NOT land on the sticker — otherwise we
  // would steal capture from sticker drag / sticker-local gestures.
  if (!isStickerPointerTarget(e.target)) {
    try {
      viewfinder.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (vfPointers.size === 2) {
    beginVfPinch()
  }
}

function onVfPointerMove(e: PointerEvent): void {
  if (!vfPointers.has(e.pointerId)) return
  vfPointers.set(e.pointerId, pointerPos(e))

  if (vfPointers.size >= 2 && vfPinching) {
    const pts = [...vfPointers.values()]
    const d = dist(pts[0], pts[1])
    if (vfPinchStartDist > 0) {
      state.scale = clamp(vfPinchStartScale * (d / vfPinchStartDist), SCALE_MIN, SCALE_MAX)
    }
    const a = angle(pts[0], pts[1])
    state.rotation = vfPinchStartRotation + (a - vfPinchStartAngle)
    applyStickerTransform()
  }
}

function endVfPointer(e: PointerEvent): void {
  if (!vfPointers.has(e.pointerId)) return
  vfPointers.delete(e.pointerId)
  try {
    viewfinder.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  if (vfPointers.size < 2) {
    vfPinching = false
    rotatingWithTwoFingers = false
  }
  if (vfPointers.size === 2) {
    beginVfPinch()
  }
}

viewfinder.addEventListener('pointerdown', onVfPointerDown)
viewfinder.addEventListener('pointermove', onVfPointerMove)
viewfinder.addEventListener('pointerup', endVfPointer)
viewfinder.addEventListener('pointercancel', endVfPointer)

/* Double-tap sticker / near sticker to reset scale */
let lastTapAt = 0
let lastTapX = 0
let lastTapY = 0
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_PX = 36

function nearSticker(clientX: number, clientY: number): boolean {
  const el = stickerTarget
  const r = el.getBoundingClientRect()
  // Use unscaled-ish generous hit pad so a tiny sticker is still easy to double-tap
  const pad = 48
  return (
    clientX >= r.left - pad &&
    clientX <= r.right + pad &&
    clientY >= r.top - pad &&
    clientY <= r.bottom + pad
  )
}

viewfinder.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (isUiChromeTarget(e.target)) return
  if (vfPinching || rotatingWithTwoFingers) return
  if (!nearSticker(e.clientX, e.clientY)) {
    lastTapAt = 0
    return
  }
  const now = performance.now()
  const dt = now - lastTapAt
  const close =
    Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) <= DOUBLE_TAP_PX
  if (dt > 0 && dt <= DOUBLE_TAP_MS && close) {
    lastTapAt = 0
    state.scale = 1
    applyStickerTransform()
    showLiveToast('Size reset', 1400)
    return
  }
  lastTapAt = now
  lastTapX = e.clientX
  lastTapY = e.clientY
})

viewfinder.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.94 : 1.06
    state.scale = clamp(state.scale * delta, SCALE_MIN, SCALE_MAX)
    applyStickerTransform()
  },
  { passive: false },
)

btnRotateCw.addEventListener('click', () => {
  state.rotation += 15
  applyStickerTransform()
})
btnRotateCcw.addEventListener('click', () => {
  state.rotation -= 15
  applyStickerTransform()
})
btnZoomOut.addEventListener('click', () => {
  state.scale = clamp(state.scale * 0.85, SCALE_MIN, SCALE_MAX)
  applyStickerTransform()
})
btnZoomIn.addEventListener('click', () => {
  state.scale = clamp(state.scale * 1.18, SCALE_MIN, SCALE_MAX)
  applyStickerTransform()
})

/** Live AR — must run inside user gesture on iOS; also request gyro here */
btnEnableCamera.addEventListener('click', () => {
  void requestGyroPermission()
  void startCamera(facing)
})

/** Native camera snap (not live) — works when getUserMedia is blocked */
btnNativeCamera.addEventListener('click', () => {
  void requestGyroPermission()
  captureInput.click()
})

btnFlip.addEventListener('click', () => {
  if (!cameraStarted) {
    showCameraGate(true)
    return
  }
  void startCamera(facing === 'user' ? 'environment' : 'user')
})

btnUpload.addEventListener('click', () => fileInput.click())

/**
 * Sample photos, for anyone without a usable camera (a judge at a desk, a blocked permission).
 * Shown whenever the pointer is a mouse or the camera was refused; a sample goes down the same
 * path as a gallery pick, so everything after it (the Axie's look, the post, happiness) is real.
 */
const sampleTray = document.querySelector<HTMLElement>('#sample-tray')
function syncSampleTray(): void {
  if (!sampleTray) return
  sampleTray.hidden = !(window.matchMedia('(pointer: fine)').matches || !cameraDenied.hidden || mode === 'upload')
}
sampleTray?.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement | null)?.closest?.('.sample-chip') as HTMLButtonElement | null
  const src = chip?.dataset.sample
  if (!src) return
  void fetch(src)
    .then((r) => r.blob())
    .then((blob) => loadUpload(new File([blob], src.split('/').pop() || 'sample.jpg', { type: blob.type || 'image/jpeg' })))
    .catch(() => showLiveToast('Could not open that photo', 2000))
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) loadUpload(file)
  fileInput.value = ''
})

captureInput.addEventListener('change', () => {
  const file = captureInput.files?.[0]
  if (file) loadUpload(file)
  captureInput.value = ''
})

captureInputUser.addEventListener('change', () => {
  const file = captureInputUser.files?.[0]
  if (file) loadUpload(file)
  captureInputUser.value = ''
})

btnCapture.addEventListener('click', () => {
  void captureComposite()
})

btnRetake.addEventListener('click', () => {
  if (captureUrl) URL.revokeObjectURL(captureUrl)
  captureUrl = null
  captureBlob = null
  captureLookId = null
  plainCapture = null
  captureSeq += 1
  previewScreen.hidden = true
  previewScreen.classList.remove('active')
  viewfinder.hidden = false
  viewfinder.classList.add('active')
  postToast.hidden = true
  scheduleStickerCenter()
  if (customAxieId) {
    void loadAxieIdSticker(customAxieId)
  } else {
    void initSticker3D()
  }
  // On mobile / no live stream, show gate again so user can re-enable
  if (!cameraStarted || !stream) {
    showCameraGate(true)
  }
})

btnPost.addEventListener('click', () => {
  void submitPost()
})

/**
 * The line on the photo. Each capture gets a sequence number; the Axie looks at the plain capture
 * while the preview is open, and when it answers (a second or two) its line is drawn as a speech
 * bubble onto a copy, which becomes the capture that is previewed, downloaded and posted. A retake
 * or a post bumps the sequence, so a late answer for an old capture is dropped. The server keeps
 * what it said under `lookId`, and the post reuses it rather than asking twice.
 */
let captureSeq = 0
let captureAnchor: BubbleAnchor | null = null
let captureLookId: string | null = null
/** The capture before any bubble: every look is drawn onto a fresh copy of this. */
let plainCapture: Blob | null = null
/** The caption the current look was made with; a different caption on Post means one more look. */
let lookedCaption = ''
/** Looks in flight for the current capture: only the newest one is allowed to draw. */
let lookSeq = 0

const currentCaption = (): string => captionInput?.value?.trim()?.slice(0, 140) || ''

/** The caption box: leaving it (or Enter) with new words makes the Axie look again with them. */
captionInput?.addEventListener('change', () => {
  if (!plainCapture || currentCaption() === lookedCaption) return
  void lookAtCapture(plainCapture, captureSeq, currentCaption())
})

/**
 * Mean brightness of a capture, 0..1, from a 24x24 downsample. A dark room reads under about 0.16;
 * telling the server lets the Axie say it is dark instead of guessing at shapes it cannot see.
 */
async function darkness(blob: Blob): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(blob)
    const c = document.createElement('canvas')
    c.width = 24
    c.height = 24
    const g = c.getContext('2d')
    if (!g) return false
    g.drawImage(bmp, 0, 0, 24, 24)
    bmp.close?.()
    const d = g.getImageData(0, 0, 24, 24).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    return sum / (d.length / 4) / 255 < 0.16
  } catch {
    return false
  }
}

async function lookAtCapture(plain: Blob, seq: number, caption = ''): Promise<void> {
  if (!buddyState.active?.hatchedAt) return
  const anchor = captureAnchor
  const mine = ++lookSeq
  let line = ''
  let lookId: string | null = null
  try {
    const ctx = await snapContext()
    const dark = await darkness(plain)
    const res = await fetch('/api/buddy/look', {
      method: 'POST', headers: buddyHeaders(),
      body: JSON.stringify({ imageBase64: await blobToDataUrl(plain), hour: ctx.hour, dark, caption, ...(ctx.lat !== undefined ? { lat: ctx.lat, lng: ctx.lng } : {}) }),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string | null; line?: string | null }
    if (!res.ok) return
    line = (data.line || '').trim()
    lookId = data.id || null
  } catch {
    return
  }
  if (!line || !lookId || seq !== captureSeq || mine !== lookSeq) return
  const blob = await bubbleOnto(plain, line, anchor)
  if (!blob || seq !== captureSeq || mine !== lookSeq) return
  if (captureUrl) URL.revokeObjectURL(captureUrl)
  captureBlob = blob
  captureUrl = URL.createObjectURL(blob)
  captureLookId = lookId
  lookedCaption = caption
  previewImg.src = captureUrl
  btnDownload.href = captureUrl
}

/**
 * A fresh copy of the plain capture with a speech bubble drawn on it, or null if that failed.
 * Without an anchor (a capture path that did not measure the character) the bubble sits over the
 * middle of the frame rather than not at all: a photo without its line reads as a bug.
 */
async function bubbleOnto(plain: Blob, line: string, anchor: BubbleAnchor | null): Promise<Blob | null> {
  const img = new Image()
  const src = URL.createObjectURL(plain)
  img.src = src
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(src)
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) { URL.revokeObjectURL(src); return null }
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(src)
  const family = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'Nunito, system-ui, sans-serif'
  const at = anchor || { x: canvas.width / 2, y: canvas.height * 0.52, halfW: canvas.width * 0.15, halfH: canvas.height * 0.08 }
  if (!drawSpeechBubble(ctx, line, at, family, { star: hasPhotoStar() })) return null
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
}

/**
 * The egg's line on the photo: no model, no server, just the next line in its small voice, so the
 * five photos before the hatch already feel like something is in there.
 */
async function stampEggLine(plain: Blob, seq: number): Promise<void> {
  const b = buddyState.active
  if (!b || b.hatchedAt) return
  const blob = await bubbleOnto(plain, eggLine(b.egg.snaps + 1), captureAnchor)
  if (!blob || seq !== captureSeq) return
  if (captureUrl) URL.revokeObjectURL(captureUrl)
  captureBlob = blob
  captureUrl = URL.createObjectURL(blob)
  previewImg.src = captureUrl
  btnDownload.href = captureUrl
}

async function captureComposite(): Promise<void> {
  const canvas = frameCanvas
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let srcW: number
  let srcH: number
  let drawBase: (ctx: CanvasRenderingContext2D, w: number, h: number) => void

  if (mode === 'camera' && video.videoWidth > 0) {
    srcW = video.videoWidth
    srcH = video.videoHeight
    const mirror = facing === 'user'
    drawBase = (c, w, h) => {
      if (mirror) {
        c.save()
        c.translate(w, 0)
        c.scale(-1, 1)
        c.drawImage(video, 0, 0, w, h)
        c.restore()
      } else {
        c.drawImage(video, 0, 0, w, h)
      }
    }
  } else if (!uploadPreview.hidden && uploadPreview.naturalWidth > 0) {
    srcW = uploadPreview.naturalWidth
    srcH = uploadPreview.naturalHeight
    drawBase = (c, w, h) => c.drawImage(uploadPreview, 0, 0, w, h)
  } else {
    // solid fallback frame
    srcW = 1080
    srcH = 1920
    drawBase = (c, w, h) => {
      c.fillStyle = '#1a1a2e'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#6cf0c2'
      c.font = 'bold 48px system-ui'
      c.textAlign = 'center'
      c.fillText('Axie Idol', w / 2, h / 2)
    }
  }

  // Fit canvas to cover viewfinder aspect like object-fit: cover
  const vf = viewfinder.getBoundingClientRect()
  // never smaller than the frame on screen: a small source on a wide window would otherwise make
  // a photo (and an Axie on it) coarser than what the player just looked at
  const outW = Math.min(1440, Math.max(srcW, 720, Math.round(vf.width)))
  const outH = Math.round(outW * (vf.height / vf.width))
  canvas.width = outW
  canvas.height = outH

  // Draw video/image with cover crop into canvas
  const scaleCover = Math.max(outW / srcW, outH / srcH)
  const drawScaled = (scale: number): void => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, outW, outH)
    ctx.clip()
    ctx.translate((outW - srcW * scale) / 2, (outH - srcH * scale) / 2)
    ctx.scale(scale, scale)
    drawBase(ctx, srcW, srcH)
    ctx.restore()
  }
  if (uploadShownWhole()) {
    // The backdrop: the photo shrunk to a few dozen pixels and stretched back over the frame (a
    // blur that works in every browser, canvas filters do not), dimmed; then the whole photo on top.
    const tiny = document.createElement('canvas')
    tiny.width = 40
    tiny.height = Math.max(8, Math.round(40 * (outH / outW)))
    const tg = tiny.getContext('2d')
    if (tg) {
      const s = Math.max(tiny.width / srcW, tiny.height / srcH)
      tg.drawImage(uploadPreview, (tiny.width - srcW * s) / 2, (tiny.height - srcH * s) / 2, srcW * s, srcH * s)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(tiny, 0, 0, outW, outH)
      ctx.fillStyle = 'rgba(10, 21, 32, 0.45)'
      ctx.fillRect(0, 0, outW, outH)
    }
    drawScaled(Math.min(outW / srcW, outH / srcH))
  } else {
    drawScaled(scaleCover)
  }

  const scaleX = outW / vf.width
  const cx = (state.x + state.gyroX) * scaleX
  const cy = (state.y + state.gyroY) * scaleX
  captureAnchor = null

  const useMixer = Boolean(axie3d?.ready)
  if (useMixer && axie3d) {
    axie3d.renderNow()
    const mc = axie3d.canvas
    const baseW = mc.clientWidth * scaleX
    const baseH = mc.clientHeight * scaleX
    // where the Axie is on the composite: the speech bubble points here (the character fills
    // about four fifths of its canvas box, so the tail reaches the head, not the box)
    captureAnchor = { x: cx, y: cy, halfW: (baseW * state.scale) / 2, halfH: (baseH * state.scale * 0.8) / 2 }
    // Mystic glow (bond level 10): the same layer drawn once behind itself with a shadow, so the
    // halo the live view shows in CSS lands in the photo too. Only the character, not the frame.
    if (buddyGlowOn()) {
      ctx.save()
      ctx.shadowColor = 'rgba(255, 209, 102, 0.9)'
      ctx.shadowBlur = 26 * scaleX
      ctx.translate(cx, cy)
      ctx.rotate((state.rotation * Math.PI) / 180)
      ctx.scale(state.scale, state.scale)
      ctx.drawImage(mc, -baseW / 2, -baseH / 2, baseW, baseH)
      ctx.restore()
    }
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(state.scale, state.scale)
    ctx.drawImage(mc, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()
    // The worn wardrobe item: its own, larger overlay box, concentric with the 3D canvas, so the
    // same transform lands it on the same joints as the live view. renderNow() above refreshed it.
    if (wardrobeOverlay && wardrobeOverlayShown && wardrobeOverlay.clientWidth > 0) {
      const ow = wardrobeOverlay.clientWidth * scaleX
      const oh = wardrobeOverlay.clientHeight * scaleX
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((state.rotation * Math.PI) / 180)
      ctx.scale(state.scale, state.scale)
      ctx.drawImage(wardrobeOverlay, -ow / 2, -oh / 2, ow, oh)
      ctx.restore()
    }
  } else {
    if (!stickerImg.complete) {
      await stickerImg.decode().catch(() => undefined)
    }
    const baseW = stickerImg.offsetWidth * scaleX
    const naturalAspect = stickerImg.naturalHeight / Math.max(1, stickerImg.naturalWidth)
    const baseH = baseW * naturalAspect
    captureAnchor = { x: cx, y: cy, halfW: (baseW * state.scale) / 2, halfH: (baseH * state.scale) / 2 }
    // headwear stands above the picture: the speech bubble's tail starts above it, not inside it
    if (art2d && ['hat', 'crown'].includes(wornItem() || '')) captureAnchor.halfH += baseW * state.scale * 0.42
    // what the 2D Axie wears, from the same overlay the live view shows: a cape goes under the
    // picture, anything else over it
    const drawWorn2D = (): void => {
      if (!art2d || !wardrobeOverlay || !wardrobeOverlayShown || wardrobeOverlay.clientWidth <= 0) return
      const ow = wardrobeOverlay.clientWidth * scaleX
      const oh = wardrobeOverlay.clientHeight * scaleX
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((state.rotation * Math.PI) / 180)
      ctx.scale(state.scale, state.scale)
      ctx.drawImage(wardrobeOverlay, -ow / 2, -oh / 2, ow, oh)
      ctx.restore()
    }
    const wornBehind = BEHIND_2D.includes(wornItem() || '')
    if (art2d) drawWardrobeOverlay()
    if (wornBehind) drawWorn2D()
    if (art2d && buddyGlowOn()) {
      ctx.save()
      ctx.shadowColor = 'rgba(255, 209, 102, 0.9)'
      ctx.shadowBlur = 26 * scaleX
      ctx.translate(cx, cy)
      ctx.rotate((state.rotation * Math.PI) / 180)
      ctx.scale(state.scale, state.scale)
      ctx.drawImage(stickerImg, -baseW / 2, -baseH / 2, baseW, baseH)
      ctx.restore()
    }
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(state.scale, state.scale)
    ctx.drawImage(stickerImg, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()
    if (!wornBehind) drawWorn2D()
  }

  // Photo frame last, over the whole capture (same-origin SVG, so the canvas stays untainted).
  if (framesUnlocked()) drawFrame(ctx, activeFrame())

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 0.95),
  )
  if (!blob) return

  if (captureUrl) URL.revokeObjectURL(captureUrl)
  captureBlob = blob
  captureUrl = URL.createObjectURL(blob)
  captureLookId = null
  plainCapture = blob
  lookedCaption = ''
  previewImg.src = captureUrl
  btnDownload.href = captureUrl
  if (captionInput) captionInput.value = ''
  captureSeq += 1
  if (buddyState.active && !buddyState.active.hatchedAt) void stampEggLine(blob, captureSeq)
  else void lookAtCapture(blob, captureSeq)

  disposeAxie3D()
  viewfinder.classList.remove('active')
  viewfinder.hidden = true
  previewScreen.hidden = false
  previewScreen.classList.add('active')
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/* Optional gyro parallax — feature-detect, fail quiet */
type DOEPerm = {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

let gyroBound = false

function bindGyro(): void {
  if (gyroBound) return
  gyroBound = true
  window.addEventListener(
    'deviceorientation',
    (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0 // front-back tilt
      const gamma = e.gamma ?? 0 // left-right
      state.gyroX = clamp(gamma * 0.35, -18, 18)
      state.gyroY = clamp((beta - 45) * 0.25, -18, 18)
      applyStickerTransform()
    },
    true,
  )
}

async function requestGyroPermission(): Promise<void> {
  const DOE = DeviceOrientationEvent as unknown as DOEPerm
  try {
    if (typeof DOE.requestPermission === 'function') {
      const res = await DOE.requestPermission()
      if (res === 'granted') bindGyro()
    } else if ('DeviceOrientationEvent' in window) {
      bindGyro()
    }
  } catch {
    // fail quiet
  }
}

function setupGyro(): void {
  const DOE = DeviceOrientationEvent as unknown as DOEPerm
  if (!('DeviceOrientationEvent' in window)) return

  // Desktop / Android often works without permission
  if (typeof DOE.requestPermission !== 'function') {
    bindGyro()
    return
  }

  // iOS 13+: also allow first pointer as backup gesture
  viewfinder.addEventListener(
    'pointerdown',
    () => {
      void requestGyroPermission()
    },
    { once: true },
  )
}

window.addEventListener('resize', () => {
  const rect = viewfinder.getBoundingClientRect()
  if (rect.width < 40 || rect.height < 40) return
  // Boot left the sticker at 0,0 while the camera was hidden — snap to center once sized.
  if (state.x < 24 && state.y < 24) {
    resetStickerCenter()
    return
  }
  state.x = clamp(state.x, 40, rect.width - 40)
  state.y = clamp(state.y, 40, rect.height - 40)
  applyStickerTransform()
})

function showLiveToast(message: string, ms = 2200): void {
  liveToast.textContent = message
  liveToast.hidden = false
  window.setTimeout(() => {
    if (liveToast.textContent === message) liveToast.hidden = true
  }, ms)
}

function setMascotLoading(show: boolean, label?: string): void {
  if (!show) {
    mascotLoading.hidden = true
    return
  }
  mascotLoadingText.textContent = label ?? 'Loading…'
  mascotLoading.hidden = false
}

frameTray?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.prop-chip') as HTMLButtonElement | null
  if (!btn) return
  e.preventDefault()
  const id = btn.dataset.frame
  if (!isFrameId(id)) return
  lsSet(FRAME_LS, id)
  syncFrameTray()
})

function applyPngFallback(cast: FaceId): void {
  const src = mascotStickerUrl(cast)
  if (!src) {
    // No 2D art for this face (the hatched buddy is mixer-only) — leave the layer empty
    // rather than pointing the <img> at the page URL, which renders as a broken image. The src
    // is cleared too: the previous face's art (the egg sprite) must not survive under the buddy.
    hideStickerImg()
    return
  }
  stickerImg.src = src
  stickerImg.alt = 'Your egg'
  stickerImg.hidden = false
  stickerImg.style.pointerEvents = "auto"
  bindStickerPointers(stickerImg)
  applyStickerTransform()
}

/**
 * The camera must never be empty. When the 3D buddy fails outright, or is still not ready after
 * this long, a flat 2D Axie takes the layer so the shot still composes and the player still sees
 * their Axie — with a toast saying what happened, rather than a silent blank frame.
 */
const BUDDY_3D_PATIENCE_MS = 15_000
let buddyStandInShown = false

function showBuddyStandIn(): void {
  const b = buddyState.active
  const name = b?.name || 'Your Axie'
  stickerImg.src = fallbackAxieSvg(b?.class ?? null, name)
  stickerImg.alt = `${name} (stand-in)`
  stickerImg.hidden = false
  stickerImg.style.pointerEvents = 'auto'
  bindStickerPointers(stickerImg)
  applyStickerTransform()
  buddyStandInShown = true
  setMascotLoading(false)
  showLiveToast(realBuddyAxieId() ? "Your Axie's picture couldn't load, using a stand-in" : "3D Axie couldn't load on this phone, using a stand-in", 3200)
}

/** The real character arrived after all — take the stand-in back off the layer. */
function hideBuddyStandIn(): void {
  if (!buddyStandInShown) return
  buddyStandInShown = false
  hideStickerImg()
}

async function initSticker3D(): Promise<void> {
  const cast = activeCast
  if (!cast) return
  const req = ++castRequest
  const label = cast === 'buddy' ? buddyState.active?.name || 'your Axie' : 'your egg'
  setMascotLoading(true, `Loading ${label}…`)
  applyPngFallback(cast)

  // A real Axie: its official art, cropped, on the ordinary sticker layer. No rig to warm up.
  const realId = cast === 'buddy' ? realBuddyAxieId() : null
  if (art2d) setWardrobeOverlayShown(false)
  wardrobeOverlay?.classList.remove('behind')
  art2d = null
  stickerImg.classList.remove('sticker-2d')
  if (realId) {
    disposeAxie3D()
    const art = await loadAxieArt(realId)
    if (req !== castRequest) return
    setMascotLoading(false)
    if (!art) { showBuddyStandIn(); return }
    buddyStandInShown = false
    art2d = art
    stickerImg.src = art.src
    stickerImg.alt = buddyState.active?.name || `Axie #${realId}`
    stickerImg.classList.add('sticker-2d')
    stickerImg.hidden = false
    stickerImg.style.pointerEvents = 'auto'
    bindStickerPointers(stickerImg)
    applyStickerTransform()
    runArt2DLoop()
    return
  }

  // A hatched Axie: the mixer's 3D rig
  if (is3DMixerFace(cast)) {
    // The hatched buddy has no 2D art of its own, so a failed or slow rig used to leave the
    // camera empty. Report it, and put a stand-in on the layer until the real one is ready.
    buddyStandInShown = false
    const slow = window.setTimeout(() => {
      if (req !== castRequest || axie3d?.ready) return
      reportDiag('3d-slow', `buddy face not ready after ${BUDDY_3D_PATIENCE_MS / 1000}s`)
      showBuddyStandIn()
    }, BUDDY_3D_PATIENCE_MS)
    const ok = await showAxie3D(cast, req)
    window.clearTimeout(slow)
    if (req !== castRequest) return
    setMascotLoading(false)
    if (ok) hideBuddyStandIn()
    else showBuddyStandIn()
    return
  }
  disposeAxie3D()

  // The egg: a flat sprite only
  setMascotLoading(false)
  applyPngFallback(cast)
}

async function selectCast(id: FaceId): Promise<void> {
  customAxieId = null
  ownedAuthorLabel = null
  activeCast = id
  await initSticker3D()
}

// (2D Spine upgrade retired: numeric Axies render as animated 3D via the mixer — see showAxie3D)

/** ?dev=1 only: put a numeric Axie on the camera (its PNG first, then the 3D rig). */
async function loadAxieIdSticker(id: string): Promise<void> {
  const trimmed = id.trim()
  if (!/^\d+$/.test(trimmed)) {
    showLiveToast('Enter a numeric Axie ID')
    return
  }

  const prevSrc = stickerImg.src
  const prevAlt = stickerImg.alt
  customAxieId = trimmed
  ownedAuthorLabel = `Axie #${trimmed}`
  // Cancel in-flight face loads
  const req = ++castRequest
  disposeAxie3D()
  const toastName = `Axie #${trimmed}`
  setMascotLoading(true, `Loading ${toastName}…`)

  stickerImg.crossOrigin = 'anonymous'
  const url = `/api/image/${trimmed}?t=${Date.now()}`

  await new Promise<void>((resolve) => {
    const onLoad = () => {
      cleanup()
      if (req !== castRequest || customAxieId !== trimmed) {
        resolve()
        return
      }
      stickerImg.hidden = false
      stickerImg.style.pointerEvents = 'auto'
      stickerImg.alt = toastName
      bindStickerPointers(stickerImg)
      applyStickerTransform()
      setMascotLoading(false)
      showLiveToast(`${toastName} on camera`)
      resolve()
      // Animated 3D via the mixer (PNG stays until ready)
      void showAxie3D(trimmed, req)
    }
    const onError = () => {
      cleanup()
      if (req !== castRequest) {
        resolve()
        return
      }
      setMascotLoading(false)
      showLiveToast(`Could not load Axie #${trimmed}`)
      // Restore the previous image, or the active face's flat sprite
      customAxieId = null
      ownedAuthorLabel = null
      if (prevSrc && !prevSrc.includes('axiecdn.axieinfinity.com')) {
        stickerImg.removeAttribute('crossorigin')
        stickerImg.src = prevSrc
        stickerImg.alt = prevAlt
      } else if (activeCast) {
        applyPngFallback(activeCast)
      }
      stickerImg.hidden = false
      stickerImg.style.pointerEvents = 'auto'
      bindStickerPointers(stickerImg)
      applyStickerTransform()
      resolve()
    }
    function cleanup() {
      stickerImg.removeEventListener('load', onLoad)
      stickerImg.removeEventListener('error', onError)
    }
    stickerImg.addEventListener('load', onLoad)
    stickerImg.addEventListener('error', onError)
    stickerImg.src = url
    // Cached image may already be complete
    if (stickerImg.complete && stickerImg.naturalWidth > 0) {
      onLoad()
    }
  })
}

const axieIdForm = document.querySelector<HTMLFormElement>('#axie-id-form')
const axieIdInput = document.querySelector<HTMLInputElement>('#axie-id-input')
axieIdForm?.addEventListener('submit', (e) => {
  e.preventDefault()
  if (!isDevMode()) {
    showLiveToast('Open ?dev=1 for Axie ID')
    return
  }
  const raw = axieIdInput?.value?.trim() ?? ''
  void loadAxieIdSticker(raw)
})

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

function hideAllScreens(): void {
  viewfinder.classList.remove('active')
  viewfinder.hidden = true
  previewScreen.classList.remove('active')
  previewScreen.hidden = true
  // The buddy screens too, so the camera never opens with one still painted underneath it.
  for (const s of document.querySelectorAll<HTMLElement>('.screen.buddy')) s.hidden = true
  pauseBuddyFace()
}

/**
 * Live buddy character inside a buddy screen's hero box. A second mixer handle, separate
 * from the camera's `axie3d`, so moving between Home and the camera never tears either down.
 * Unhatched buddies get the flat egg sprite instead — there is nothing to render yet.
 */
let buddyHero: Axie3D | null = null
let buddyHeroRequest = 0
/** The hero's own wardrobe overlay — same approach as the camera, on a second 2x canvas. */
let buddyHeroOverlay: HTMLCanvasElement | null = null
let buddyHeroCtx: CanvasRenderingContext2D | null = null
/** Mirrors the hero overlay's `hidden` (it is created hidden) — never read back off the element. */
let buddyHeroOverlayShown = false

/** Same contract as setWardrobeOverlayShown: visibility is set before anything measures the box. */
function setBuddyHeroOverlayShown(show: boolean): boolean {
  const overlay = buddyHeroOverlay
  if (!overlay || show === buddyHeroOverlayShown) return false
  buddyHeroOverlayShown = show
  overlay.hidden = !show
  if (!show && buddyHeroCtx) buddyHeroCtx.clearRect(0, 0, buddyHeroCtx.canvas.width, buddyHeroCtx.canvas.height)
  return show
}

function drawBuddyHeroWardrobe(): void {
  const hero = buddyHero
  const overlay = buddyHeroOverlay
  if (!hero || !overlay) return
  const worn = buddyState.active?.wardrobe.worn ?? null
  if (!worn || !hero.ready || !overlay.isConnected) {
    setBuddyHeroOverlayShown(false)
    return
  }
  // visible first, then measured — a display:none element measures 0x0
  setBuddyHeroOverlayShown(true)
  const pad = syncOverlaySize(overlay, hero.canvas)
  if (!pad) return // hero box not laid out yet; retry on the next frame
  if (!buddyHeroCtx) buddyHeroCtx = overlay.getContext('2d')
  if (!buddyHeroCtx) return
  drawWardrobe(buddyHeroCtx, worn, offsetJoints(hero.jointScreenPositions(), pad.dx, pad.dy))
}

/**
 * A real Axie in a hero box: its cropped art, sized to sit inside the box with room for a hat,
 * breathing gently, with the worn item drawn on a canvas twice the box's size around it (the same
 * geometry the 3D hero uses).
 */
async function showRealBuddyIn(host: HTMLElement, axieId: string, req: number): Promise<void> {
  buddyHero?.pause()
  setBuddyHeroOverlayShown(false)
  const art = await loadAxieArt(axieId)
  if (req !== buddyHeroRequest) return
  const img = document.createElement('img')
  img.alt = ''
  img.dataset.buddyFace = '2d'
  if (!art) {
    img.src = fallbackAxieSvg(buddyState.active?.class ?? null, buddyState.active?.name || 'Your Axie')
    img.className = 'bd-hero-art'
    host.append(img)
    return
  }
  const boxW = host.clientWidth || 116, boxH = host.clientHeight || 116
  const fit = Math.min((boxW * 0.78) / art.w, (boxH * 0.66) / art.h)
  const w = art.w * fit, h = art.h * fit
  // a little low in the box: the space above is where a hat or a crown goes
  const left = (boxW - w) / 2, top = (boxH - h) / 2 + boxH * 0.07
  img.src = art.src
  img.className = 'bd-hero-2d'
  // percentages, so the picture keeps its place when the box changes size (rotation, a resized window)
  img.style.cssText = `left:${(left / boxW) * 100}%;top:${(top / boxH) * 100}%;width:${(w / boxW) * 100}%;height:${(h / boxH) * 100}%`
  host.append(img)
  const worn = buddyState.active?.wardrobe.worn ?? null
  if (!worn) return
  const overlay = document.createElement('canvas')
  overlay.className = 'bd-hero-wardrobe'
  overlay.dataset.buddyFace = 'wardrobe'
  overlay.setAttribute('aria-hidden', 'true')
  // a cape goes under the picture, anything else over it
  if (BEHIND_2D.includes(worn)) host.insertBefore(overlay, img)
  else host.append(overlay)
  const density = Math.min(2, window.devicePixelRatio || 1)
  overlay.width = Math.round(boxW * 2 * density)
  overlay.height = Math.round(boxH * 2 * density)
  const g = overlay.getContext('2d')
  if (!g) return
  preloadWardrobe()
  // the overlay's corner is half a box up and left of the host's
  const joints = offsetJoints(jointsFor2D(w * density, h * density, art.topMid), (boxW / 2 + left) * density, (boxH / 2 + top) * density)
  let tries = 0
  const paint = (): void => {
    if (req !== buddyHeroRequest || !overlay.isConnected) return
    // the sprite may still be decoding on the first frames
    if (!drawWardrobe(g, worn, joints, wardrobeSprite2D, ITEM_ANCHORS_2D) && tries++ < 90) requestAnimationFrame(paint)
  }
  paint()
}

async function showBuddyFaceIn(host: HTMLElement): Promise<void> {
  const req = ++buddyHeroRequest
  for (const old of host.querySelectorAll('[data-buddy-face]')) old.remove()
  const realId = realBuddyAxieId()
  if (realId) { await showRealBuddyIn(host, realId, req); return }
  const spec = await specForFace('buddy').catch(() => null)
  if (req !== buddyHeroRequest) return
  if (!spec) {
    buddyHero?.pause()
    setBuddyHeroOverlayShown(false)
    const img = document.createElement('img')
    img.src = eggSpriteUrl()
    img.alt = ''
    img.dataset.buddyFace = 'egg'
    img.className = 'bd-hero-art'
    host.append(img)
    return
  }
  if (!buddyHero) {
    buddyHero = createAxie3D('buddy-hero')
    buddyHero.canvas.className = 'bd-hero-canvas'
    buddyHero.canvas.dataset.buddyFace = '3d'
    buddyHero.onFrame(drawBuddyHeroWardrobe)
  }
  if (!buddyHeroOverlay) {
    buddyHeroOverlay = document.createElement('canvas')
    buddyHeroOverlay.className = 'bd-hero-wardrobe'
    buddyHeroOverlay.dataset.buddyFace = 'wardrobe'
    buddyHeroOverlay.setAttribute('aria-hidden', 'true')
    buddyHeroOverlay.hidden = true
  }
  const hero = buddyHero
  await hero.load(spec)
  if (req !== buddyHeroRequest) return
  host.append(hero.canvas, buddyHeroOverlay)
  hero.resume()
}

/** No hero box on the screen that just opened (ladder, monthly, claim) — stop rendering. */
function pauseBuddyFace(): void {
  buddyHeroRequest++
  buddyHero?.pause()
  setBuddyHeroOverlayShown(false)
}

function showViewfinder(): void {
  hideAllScreens()
  viewfinder.hidden = false
  viewfinder.classList.add('active')
  // The face is always the buddy: the egg sprite before hatching, the character after.
  // faceIdForBuddy() handles a null buddy (a failed loadBuddy() at boot).
  const want = faceIdForBuddy()
  if (activeCast !== want) void selectCast(want)
  syncCameraHud()
  // sprites are cached per page; decode them before the first frame that needs them
  preloadWardrobe()
  requestBuddyBeforeLine()
  scheduleStickerCenter()
  if (stream && cameraStarted) {
    // The live camera is still running from the last shot.
    showCameraGate(false)
  } else if (lsGet(CAMERA_OK_LS) === '1') {
    // The player enabled the camera once already. This runs inside their tap on the Snap
    // button, so the browser treats it as the user gesture it needs; only a failure shows
    // the gate again.
    void (async () => {
      const ok = await startCamera(facing)
      showCameraGate(!ok)
    })()
  } else if (isMobileLike() || !stream) {
    showCameraGate(true)
    if (!isMobileLike()) {
      void (async () => {
        const ok = await startCamera('environment')
        showCameraGate(!ok)
      })()
    }
  }
}

/**
 * The before-the-shot line, over the character for four seconds. Fire-and-forget: it must
 * never gate the shutter, and a slow or failed request just leaves the viewfinder as it was.
 */
function requestBuddyBeforeLine(): void {
  if (!buddyState.active?.hatchedAt || !bdSpeechVf) return
  void beforeLine({})
    .then((line) => {
      if (!line || !bdSpeechVf || viewfinder.hidden) return
      bdSpeechVf.textContent = line
      bdSpeechVf.hidden = false
      if (bdSpeechTimer !== null) window.clearTimeout(bdSpeechTimer)
      bdSpeechTimer = window.setTimeout(() => {
        if (bdSpeechVf) bdSpeechVf.hidden = true
        bdSpeechTimer = null
      }, 4000)
    })
    .catch(() => {})
}

async function submitPost(): Promise<void> {
  if (posting) return
  if (!captureBlob && !captureUrl) {
    showLiveToast('Capture a photo first')
    return
  }
  posting = true
  btnPost.disabled = true
  const prevLabel = btnPost.textContent
  btnPost.textContent = 'Posting…'
  try {
    // A caption typed since the last look: let the Axie read it before the photo goes, so the
    // bubble on the image and the line on the card are the same words. Bounded, never blocking.
    if (plainCapture && buddyState.active?.hatchedAt && currentCaption() !== lookedCaption) {
      await Promise.race([lookAtCapture(plainCapture, captureSeq, currentCaption()), new Promise((r) => setTimeout(r, 7000))])
    }
    let blob = captureBlob
    if (!blob && captureUrl) {
      const r = await fetch(captureUrl)
      blob = await r.blob()
    }
    if (!blob) throw new Error('No image to post')
    const imageBase64 = await blobToDataUrl(blob)
    const caption = captionInput?.value?.trim()?.slice(0, 140) || ''

    // ?dev=1 Axie ID sticker on a device with a saved Ronin address: posts as that Axie
    const postingOwned =
      Boolean(customAxieId && roninAddress && /^\d+$/.test(customAxieId))
    const postAxieId = postingOwned
      ? customAxieId!
      : activeCast
    const axieLabel = postingOwned
      ? ownedAuthorLabel?.replace(/\s#\d+$/, '') || `Axie #${customAxieId}`
      : postAxieId
    const postAuthorLabel = postingOwned
      ? ownedAuthorLabel || `Axie #${customAxieId}`
      : authorLabel

    const body: Record<string, unknown> = {
      axieId: postAxieId,
      axieLabel,
      caption,
      authorGuestId: guestId,
      authorLabel: postAuthorLabel,
      imageBase64,
    }
    if (postingOwned) {
      body.ownerAddress = roninAddress
    }
    if (roninAddress) {
      body.address = roninAddress
    }

    // This snap is also egg progress / bond. `labels` stays empty until a captioner exists;
    // location comes from snapContext(), which never blocks the shutter.
    // An owned buddy posts under its real Axie id so ownership attribution lands; a wild one
    // posts under 'kotaro', the server's neutral id ('buddy'/'egg' would fail its id check).
    let buddyOwnedPost = false
    {
      const b = buddyState.active
      const ctx = await snapContext()
      Object.assign(body, { buddy: true, hour: ctx.hour, labels: [] as string[] })
      // the look this capture already had (its line is on the image): the server reuses it
      if (captureLookId) body.lookId = captureLookId
      if (ctx.lat !== undefined) Object.assign(body, { lat: ctx.lat, lng: ctx.lng })
      const buddyOwner = buddyState.address || roninAddress
      const buddyName = b?.name || 'Axie'
      if (b?.kind === 'owned' && b.axieId && buddyOwner) {
        buddyOwnedPost = true
        body.axieId = b.axieId
        body.ownerAddress = buddyOwner
        body.address = buddyOwner
        // The server rewrites both labels from chain data on an owned post; these are the fallback.
        body.axieLabel = buddyName
        body.authorLabel = buddyName
      } else if (!postingOwned) {
        body.axieId = 'kotaro'
        body.axieLabel = b?.hatchedAt ? buddyName : 'Egg'
      }
    }

    type PostResponse = {
      error?: string
      post?: { id?: string; imagePath?: string }
      buddy?: SnapResult | null
    }
    const sendPost = async (): Promise<{ res: Response; data: PostResponse }> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey,
      }
      // Without the session header the server resolves the account by device key, which a
      // Ronin sign-in has already emptied — the snap would earn no bond at all.
      if (buddyState.session) headers['X-Buddy-Session'] = buddyState.session
      const r = await fetch('/api/posts', { method: 'POST', headers, body: JSON.stringify(body) })
      return { res: r, data: (await r.json().catch(() => ({}))) as PostResponse }
    }

    let { res, data } = await sendPost()
    let ownedBadgeLost = false
    if (!res.ok && (res.status === 403 || res.status === 502) && buddyOwnedPost) {
      // The on-chain owner check disagreed with the wallet that claimed this buddy (403), or the
      // chain was unreachable (502). Never lose the snap or its bond over a badge: repost as the
      // neutral cast id and say so.
      body.axieId = 'kotaro'
      body.axieLabel = buddyState.active?.name || 'Axie'
      body.authorLabel = authorLabel
      delete body.ownerAddress
      ;({ res, data } = await sendPost())
      ownedBadgeLost = res.ok
    }
    if (!res.ok) {
      throw new Error(data.error || `Post failed (${res.status})`)
    }
    if (ownedBadgeLost) showLiveToast('Posted without the owned badge (wallet check failed)', 2800)
    previewScreen.classList.remove('active')
    previewScreen.hidden = true
    if (captureUrl) URL.revokeObjectURL(captureUrl)
    captureUrl = null
    captureBlob = null
    captureLookId = null
    plainCapture = null
    captureSeq += 1
    // Stay on the camera so Retake works, and float the after-the-shot sheets over it; the last
    // sheet lands on Home.
    viewfinder.hidden = false
    viewfinder.classList.add('active')
    await handleBuddySnap(data.buddy ?? null, data.post?.id ?? null, data.post?.imagePath ?? null)
  } catch (err) {
    console.warn('[axie-idol] post failed', err)
    showLiveToast(err instanceof Error ? err.message : 'Post failed', 2800)
    postToast.textContent = err instanceof Error ? err.message : 'Post failed'
    postToast.hidden = false
    window.setTimeout(() => {
      postToast.hidden = true
    }, 2800)
  } finally {
    posting = false
    btnPost.disabled = false
    btnPost.textContent = prevLabel || 'Post'
  }
}

/**
 * After-the-shot sheets, in order: reaction, then one card per new moment, then one per bond
 * unlock. A module-level queue (not a DOM event per post) so nothing accumulates listeners —
 * `buddyScreens` calls `advanceBuddySheet` from its single delegated handler.
 */
let buddySheetQueue: string[] = []
/**
 * The post the open after-the-shot sheets are about. "Don't keep this one" needs an id to send,
 * and the sheets are the only place it can be acted on, so it lives exactly as long as they do.
 */
let lastPhotoId: string | null = null

async function handleBuddySnap(snap: SnapResult | null, photoId: string | null = null, photoPath: string | null = null): Promise<void> {
  buddySheetQueue = []
  lastPhotoId = photoId
  if (!snap) {
    await buddyUi?.show('auto')
    return
  }
  try {
    await loadBuddy()
  } catch (err) {
    console.warn('[buddy] reload after snap failed', err)
  }
  syncCameraHud()
  // After a photo the player lands back on the egg or Home screen, not another camera shot:
  // the count is visible, and taking a break is the default rather than something to find.
  if (snap.kind === 'egg') {
    await buddyUi?.show('auto')
    showLiveToast(snap.canHatch ? `${snap.snaps} snaps. Hatch whenever you like.` : `${snap.snaps} of 5 to hatch`, 2600)
    return
  }
  const b = buddyState.active
  if (b) {
    buddySheetQueue = [
      ...(snap.happy?.overjoyed ? [joyHtml(snap.happy, b)] : []),
      ...snap.moments.map((m) => momentHtml(m, b)),
      ...snap.unlocks.map((u) => unlockHtml(u, b)),
    ]
  }
  await buddyUi?.show('home')
  buddyUi?.sheet(reactionHtml(snap, photoPath))
}

function advanceBuddySheet(): void {
  const html = buddySheetQueue.shift()
  if (html) {
    buddyUi?.sheet(html)
    return
  }
  buddyUi?.hideSheet()
  void buddyUi?.show('auto')
}

/** The guest id and label that go on a post. */
function refreshGuestIdentity(): void {
  const guest = ensureGuestIdentity(Boolean(roninAddress))
  guestId = guest.guestId
  authorLabel = guest.authorLabel
}

document.querySelector<HTMLButtonElement>('#btn-vf-back')?.addEventListener('click', () => {
  // Closing the camera goes back to the buddy screens.
  void buddyUi?.show('auto')
})

/** The camera HUD: the buddy chip, today's wish, the frame tray and the wardrobe tray. */
function syncCameraHud(): void {
  // With no active buddy (a failed loadBuddy() at boot) the chip goes empty.
  const b = buddyState.active
  if (bdChip) {
    bdChip.innerHTML = b ? vfChipHtml(b) : ''
    bdChip.hidden = !b
  }
  if (bdWishPill) {
    // Read-only in the HUD: marking a wish done mid-shot would navigate off the camera.
    const html = b?.hatchedAt && b.wish.id && !b.wish.done ? wishPillHtml(b, { interactive: false }) : ''
    bdWishPill.innerHTML = html
    bdWishPill.hidden = !html
  }
  syncFrameTray()
  // The wardrobe tray follows `buddyState`, and syncCameraHud() runs after every load and snap.
  syncCameraTrays()
}

async function boot(): Promise<void> {
  deviceKey = ensureDeviceKey()

  bindDeviceKey(() => deviceKey)
  preloadWardrobe()
  buddyUi = mountBuddyScreens({
    goSnap: () => showViewfinder(),
    showFace: (host) => showBuddyFaceIn(host),
    hideFace: () => pauseBuddyFace(),
    onSheetNext: () => advanceBuddySheet(),
    clearSheetQueue: () => { buddySheetQueue = []; lastPhotoId = null },
    lastPhotoId: () => lastPhotoId,
    toast: (message) => showLiveToast(message, 1800),
  })
  try {
    await loadBuddy()
  } catch (err) {
    console.warn('[buddy] load failed', err)
  }
  // Nothing paints for the rest of boot, before the first buddy screen mounts.
  hideAllScreens()
  syncCameraTrays()

  roninAddress = loadSavedRoninAddress()
  refreshGuestIdentity()
  syncCameraHud()

  const dev = isDevMode()
  if (axieIdForm) {
    axieIdForm.hidden = !dev
  }

  scheduleStickerCenter()
  setupGyro()
  btnFlip.disabled = true

  // ?dev=1 QA hooks: ?id= puts a numeric Axie on the camera, ?face=dev:<part ids> a set of parts
  void (async () => {
    const params = new URLSearchParams(window.location.search)
    const qid = params.get('id')?.trim()
    if (dev && qid && /^\d+$/.test(qid)) {
      if (axieIdInput) axieIdInput.value = qid
      await loadAxieIdSticker(qid)
      return
    }
    const devFace = isDevMode() ? new URLSearchParams(location.search).get('face') : null
    if (devFace && devFace.startsWith('dev:')) void showAxie3D(devFace, ++castRequest)
    if (isDevMode() && new URLSearchParams(location.search).get('raf') === 'timer') {
      // dev QA in a hidden browser pane: requestAnimationFrame never fires there, which stalls the
      // mixer's frame-scheduled loading; drive it from timers instead
      const w = window as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number; cancelAnimationFrame: (id: number) => void }
      w.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16)
      w.cancelAnimationFrame = (id) => window.clearTimeout(id)
    }
    if (isDevMode()) {
      // dev QA: #face=dev:<part ids> swaps the live face without a reload
      window.addEventListener('hashchange', () => {
        const h = decodeURIComponent(location.hash.replace(/^#/, '')).split('&')[0]
        const face = h.startsWith('face=') ? h.slice(5) : null
        if (face && face.startsWith('dev:')) void showAxie3D(face, ++castRequest)
      })
    }
  })()

  window.setTimeout(warmAxieMixer, 2500)
  console.info('[axie-idol] boot', {
    mobile: isMobileLike(),
    isSecureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices),
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
  })

  // The first screen: egg, hatch or home. If that first request cannot reach the server (loadBuddy
  // above already failed quietly, or startEgg fails here), show the retry card: every screen is
  // hidden by now, so anything else leaves a blank document.
  try {
    // a refresh stays on the screen you were on (the homepage, the scrapbook, the ladder)
    await buddyUi.show(screenFromHash(location.hash))
  } catch (err) {
    console.warn('[buddy] boot failed', err)
    buddyUi.showBootError()
  }
}

void boot()

// QA only: /?qa2d=2660,80 draws the 2D placement contact sheet (see src/qa2d.ts).
const qa2dIds = new URLSearchParams(location.search).get('qa2d')
if (qa2dIds) void import('./qa2d.ts').then((m) => m.renderArtSheet(qa2dIds.split(',').map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).slice(0, 24)))
