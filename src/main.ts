/**
 * Axie Idol LIVE viewfinder composer (Round 1 demo)
 * 7 kit mascots (no Sapidae) — on-demand GLB stickers + PNG fallback (see RIGHTS.md)
 */

import { icon } from './icons'
import { unlockLevelFor, CAST_ORDER } from './quests'
import { questHudHtml, questChipText, type QuestHudInput } from './questHud'
import { GroupPhoto, squadPhotoSlots, rollShiny, SHINY_FILTER, makeGlint, drawGlint } from './groupPhoto'
import type { Sticker3D } from './sticker3d'
import { createAxie3D, getAxieMixer, isAxieMixerReady, parsePartId, type Axie3D, type Axie3DSpec } from './axie3d'
import { descriptorFor, isCustomFace } from './castDescriptors'
import type { PropOverlay } from './propOverlay'
import type { SpineSticker } from './spineSticker'
import {
  buddyEnabled, bindDeviceKey, loadBuddy, buddyState, faceIdForBuddy, snapContext, beforeLine,
  wear, lsGet, lsSet, buddyHeaders,
  type SnapResult,
} from './buddy'
import { fallbackAxieSvg } from './fallbackAxie'
import { drawSpeechBubble, type BubbleAnchor } from './speechBubble'
import { mountBuddyScreens } from './buddyScreens'
import { reactionHtml, momentHtml, unlockHtml, vfChipHtml, wishPillHtml, frameTrayHtml, wardrobeTrayHtml, eggLine } from './buddyHtml.ts'
import {
  FRAME_IDS, drawFrame, drawWardrobe, isFrameId, offsetJoints, preloadWardrobe,
  type FrameId,
} from './wardrobe'
import {
  clearWaypointToken,
  connectWithWaypoint,
  preloadWaypointSdk,
  isWaypointConfigured,
  loadWaypointToken,
  saveWaypointToken,
  tryConsumeWaypointRedirect,
} from './roninWaypoint'

/** Vibeathon kit mascots + R1 quest cast pool. Sapidae excluded. */
const CAST_MASCOTS = [
  { id: 'kotaro', label: 'Kotaro', glb: 'kotaro.glb', preview: 'kotaro.png', sticker: 'kotaro.png', prop: 'kotaro-sword' as const, kind: 'kit' as const },
  { id: 'bing', label: 'Bing', glb: 'bing.glb', preview: 'bing.png', sticker: 'bing.png', prop: 'bing-cannon' as const, kind: 'kit' as const },
  { id: 'kibo', label: 'Kibo', glb: 'kibo.glb', preview: 'kibo.png', sticker: 'kibo.png', prop: 'kibo-hammer' as const, kind: 'kit' as const },
  { id: 'paladill', label: 'Paladill', glb: 'paladill.glb', preview: 'paladill.png', sticker: 'paladill.png', prop: 'paladill-axe' as const, kind: 'kit' as const },
  { id: 'pomodoro', label: 'Pomodoro', glb: 'pomodoro.glb', preview: 'pomodoro.png', sticker: 'pomodoro.png', prop: 'pomodoro-staff' as const, kind: 'kit' as const },
  { id: 'tripp', label: 'Tripp', glb: 'tripp.glb', preview: 'tripp.png', sticker: 'tripp.png', prop: 'tripp-sword' as const, kind: 'kit' as const },
  { id: 'xia', label: 'Xia', glb: 'xia.glb', preview: 'xia.png', sticker: 'xia.png', prop: 'xia-axe' as const, kind: 'kit' as const },
  // Starters — sticker/preview may be placeholders
  { id: 'buba', label: 'Buba', glb: 'buba.glb', preview: 'buba.png', sticker: 'buba.png', prop: null, kind: 'starter' as const },
  { id: 'olek', label: 'Olek', glb: '', preview: 'olek.png', sticker: 'olek.png', prop: null, kind: 'starter' as const },
  { id: 'puffy', label: 'Puffy', glb: 'puffy.glb', preview: 'puffy.png', sticker: 'puffy.png', prop: null, kind: 'starter' as const },
  // Numeric idol faces — CDN preview
  { id: '4154', label: 'Axie #4154', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: '4155', label: 'Axie #4155', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: '4156', label: 'Axie #4156', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: '991', label: 'Axie #991', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: '35', label: 'Axie #35', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: '1367', label: 'Axie #1367', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: '2660', label: 'Axie #2660', glb: '', preview: '', sticker: '', prop: null, kind: 'axie' as const },
  { id: 'agonia-echo', label: 'Agonia Echo', glb: '', preview: 'agonia-echo.png', sticker: 'agonia-echo.png', prop: null, kind: 'villain' as const },
  // Secret: only squads that found the Golden Axie have this unlocked
  { id: 'golden', label: 'Golden Axie', glb: '', preview: 'golden.png', sticker: 'golden.png', prop: null, kind: 'starter' as const },
] as const

type CastId = (typeof CAST_MASCOTS)[number]['id']
/**
 * What can sit on the camera. `buddy` (the hatched one-Axie character, rendered by the
 * mixer) and `egg` (a flat SVG sprite) are never in the cast tray, so they are not
 * CastIds — the tray keeps working untouched while the buddy flag owns the lead face.
 */
type FaceId = CastId | 'buddy' | 'egg'

/** Vibeathon kit equipment props (jaatster/axie-3d-assets). */
const EQUIPMENT_PROPS = [
  { id: 'kotaro-sword', file: 'kotaro-sword.glb', label: "Kotaro's sword", short: 'Sword' },
  { id: 'bing-cannon', file: 'bing-cannon.glb', label: "Bing's cannon", short: 'Cannon' },
  { id: 'kibo-hammer', file: 'kibo-hammer.glb', label: "Kibo's hammer", short: 'Hammer' },
  { id: 'paladill-axe', file: 'paladill-axe.glb', label: "Paladill's axe", short: 'Axe' },
  { id: 'pomodoro-staff', file: 'pomodoro-staff.glb', label: "Pomodoro's staff", short: 'Staff' },
  { id: 'tripp-sword', file: 'tripp-sword.glb', label: "Tripp's sword", short: 'Tripp' },
  { id: 'xia-axe', file: 'xia-axe.glb', label: "Xia's axe", short: 'Xia' },
] as const

type PropId = (typeof EQUIPMENT_PROPS)[number]['id']

type CastDef = {
  id: string
  label: string
  glb: string
  preview: string
  sticker: string
  prop: PropId | null
  kind: 'kit' | 'starter' | 'axie' | 'villain'
}

function castMeta(id: string): CastDef | null {
  return (CAST_MASCOTS as readonly CastDef[]).find((c) => c.id === id) || null
}

/** Egg sprite stage: 1 under five snaps, 2 from five, 3 from twenty. */
function eggStage(): 1 | 2 | 3 {
  const s = buddyState.active?.egg.snaps ?? 0
  return s >= 20 ? 3 : s >= 5 ? 2 : 1
}
function eggSpriteUrl(): string {
  return `/previews/egg-${eggStage()}.svg`
}

function mascotGlbUrl(id: FaceId): string {
  const meta = castMeta(id)
  if (!meta?.glb) return ''
  return `./models/mascots/${meta.glb}`
}

function mascotStickerUrl(id: string): string {
  // The unhatched buddy is a flat sprite, not a mixer face.
  if (id === 'egg') return eggSpriteUrl()
  const meta = castMeta(id)
  if (!meta) return ''
  if (meta.kind === 'axie' || /^\d+$/.test(id)) return axieCdnPngLocal(id)
  if (meta.sticker) return `./stickers/${meta.sticker}`
  return `./previews/${meta.preview || 'kotaro.png'}`
}

function axieCdnPngLocal(id: string): string {
  return `https://axiecdn.axieinfinity.com/axies/${id}/axie/axie-full-transparent.png`
}

function propUrl(id: PropId): string {
  const meta = EQUIPMENT_PROPS.find((p) => p.id === id)!
  return `./models/equipment/${meta.file}`
}

function defaultPropForCast(id: string): PropId | null {
  const meta = castMeta(id)
  return (meta?.prop as PropId | null | undefined) || null
}

function propLabelName(id: string): string {
  return EQUIPMENT_PROPS.find((p) => p.id === id)?.label || id
}

function isCastUnlocked(id: string): boolean {
  // The one-Axie loop's own face is always available — it is not a quest reward.
  if (id === 'buddy' || id === 'egg') return true
  // Dev preview (?dev=1): every face can be placed on the camera; the server still enforces posting.
  if (isDevMode()) return true
  if (id === 'kotaro') return true
  const unlocked = myCastCrew?.unlockedCast || myCastCrew?.unlocked || []
  return unlocked.includes(id)
}

function isPropUnlocked(id: string): boolean {
  const unlocked = myCastCrew?.unlockedProps || []
  return unlocked.includes(id)
}


/* --- Guest session + device key + Ronin (pure-B R1) --- */
const GUEST_SESSION_KEY = 'axieIdol.guestId'
const GUEST_REMEMBERED_LS = 'axieIdol.guestId'
const RONIN_LS = 'axieIdol.roninAddress'
const DEVICE_KEY_LS = 'axieIdol.deviceKey'
/** Set once the live camera has started successfully, so later Snap taps skip the enable gate. */
const CAMERA_OK_LS = 'axieIdol.cameraOk'
const BURNS_UI_LS = 'axieIdol.burnsUi'
const CAST_CREW_CACHE_LS = 'axieIdol.castCrew'
const CELEBRATED_NOTIFS_LS = 'axieIdol.celebratedNotifs'
const LIKED_LS = 'axieIdol.likedPosts'
const OWNER_NAMES_LS = 'axieIdol.ownerNames'

function shortGuestLabel(guestId: string): string {
  const short = guestId.replace(/-/g, '').slice(0, 4).toUpperCase()
  return `Guest-${short}`
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function sanitizeOwnerNameClient(raw: string): string {
  if (typeof raw !== 'string') return ''
  let n = raw.replace(/<[^>]*>/g, ' ')
  n = n.replace(/&[a-zA-Z0-9#]+;/g, ' ')
  n = n.replace(/[<>]/g, '')
  n = n.replace(/\s+/g, ' ').trim()
  if (!n || n.includes('@')) return ''
  if (n.length > 32) n = n.slice(0, 32).trim()
  return n
}

function loadOwnerNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OWNER_NAMES_LS)
    if (!raw) return {}
    const data = JSON.parse(raw) as Record<string, unknown>
    if (!data || typeof data !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      const addr = normalizeAddressClient(k)
      const name = sanitizeOwnerNameClient(typeof v === 'string' ? v : '')
      if (addr && name) out[addr] = name
    }
    return out
  } catch {
    return {}
  }
}

let ownerNameByAddress: Record<string, string> = {}

function stashOwnerName(addr: string, name: string): void {
  const a = normalizeAddressClient(addr)
  const n = sanitizeOwnerNameClient(name)
  if (!a || !n) return
  ownerNameByAddress[a] = n
  try {
    const all = loadOwnerNames()
    all[a] = n
    localStorage.setItem(OWNER_NAMES_LS, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

function ownerDisplayName(addr: string, serverName?: string): string {
  const a = normalizeAddressClient(addr) || (addr || '').trim().toLowerCase()
  const n = sanitizeOwnerNameClient(serverName || ownerNameByAddress[a] || '')
  if (n) return n
  return shortAddress(a || addr)
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

/**
 * Remembered guest for registered (Ronin) users — persists in localStorage.
 * Create if missing; used for free-cast voice while connected.
 */
function ensureRememberedGuest(): { guestId: string; authorLabel: string } {
  let guestId = localStorage.getItem(GUEST_REMEMBERED_LS)
  if (!guestId) {
    guestId = sessionStorage.getItem(GUEST_SESSION_KEY) || newGuestId()
    localStorage.setItem(GUEST_REMEMBERED_LS, guestId)
  }
  // Keep session in sync so free-cast voice is stable this tab
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

function saveRoninAddress(addr: string): void {
  localStorage.setItem(RONIN_LS, addr)
}

function clearRoninAddress(): void {
  localStorage.removeItem(RONIN_LS)
  clearWaypointToken()
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

function loadLikedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_LS)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x) => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveLikedSet(set: Set<string>): void {
  localStorage.setItem(LIKED_LS, JSON.stringify([...set].slice(-400)))
}

function isDevMode(): boolean {
  return new URLSearchParams(window.location.search).get('dev') === '1'
}

/** R1 soft-hide SLP burns UI; enable with ?burns=1 or localStorage axieIdol.burnsUi=1 */
function isBurnsUiEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('burns') === '1') return true
    if (localStorage.getItem(BURNS_UI_LS) === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

function syncBurnsUiClass(): void {
  document.body.classList.toggle('burns-ui-off', !isBurnsUiEnabled())
}

interface FeedComment {
  id: string
  createdAt: number
  authorGuestId: string
  authorLabel: string
  text: string
  cast?: boolean
  castId?: string
}

type CastCrewEngagement = {
  castId: string
  kind: 'like' | 'comment'
  text?: string
  commentId?: string
}

type CastCrewPayload = {
  level?: number
  postCount?: number
  unlocked?: string[]
  unlockedCast?: string[]
  unlockedProps?: string[]
  newlyUnlocked?: string[]
  newlyUnlockedCast?: string[]
  newlyUnlockedProps?: string[]
  engagement?: CastCrewEngagement[]
  crewFollowerCount?: number
  stats?: {
    posts?: number
    likesGiven?: number
    commentsGiven?: number
    followsGiven?: number
    likesReceivedHuman?: number
    commentsReceivedHuman?: number
    followsReceivedHuman?: number
    distinctPostDays?: string[]
    crewCastFollowers?: number
  }
  nextQuest?: {
    level: number
    description: string
    progress: number
    target: number
    unlockLabel?: string
  } | null
  nextUnlock?: {
    at: number
    castId?: string
    propId?: string
    label: string
    remaining: number
    description?: string
    level?: number
  } | null
  ladder?: {
    level?: number
    at?: number
    castId?: string
    label: string
    unlocked: boolean
    description?: string
  }[]
}

interface FeedPost {
  id: string
  createdAt: number
  axieId: string
  axieLabel: string
  caption: string
  authorGuestId: string
  authorLabel: string
  imagePath: string
  likes: number
  comments?: FeedComment[]
  ownerAddress?: string
  ownerName?: string
  ownerDisplayName?: string
  seed?: boolean
  castAuthor?: boolean
  castId?: string
  golden?: boolean
  shiny?: string[]
}

type SocialNotif = {
  id: string
  createdAt: number
  type: string
  postId: string
  axieId: string
  axieLabel: string
  fromLabel: string
  fromAddress?: string
  text?: string
  read: boolean
  preview?: string
}

type BurnByAxie = {
  spark: number
  crown: number
  fan: number
  total: number
}

type BurnsToday = {
  dayKey: string
  timezone?: string
  mode?: string
  modeLabel?: string
  pot: number
  sparkAmount: number
  potRemaining: number
  committed: { byAxie: Record<string, BurnByAxie> }
  projectedCrown: Record<string, number>
  resetsAt?: string
}

type TimelineOwner = {
  address: string
  name: string
  displayName: string
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
const feedScreen = document.querySelector<HTMLElement>('#feed')!
const feedList = document.querySelector<HTMLElement>('#feed-list')!
const feedEmpty = document.querySelector<HTMLElement>('#feed-empty')!
const feedError = document.querySelector<HTMLElement>('#feed-error')!
const feedScores = document.querySelector<HTMLElement>('#feed-scores')!
const feedGuest = document.querySelector<HTMLElement>('#feed-guest')!
const btnToFeed = document.querySelector<HTMLButtonElement>('#btn-to-feed')!
const btnFeedBack = document.querySelector<HTMLButtonElement>('#btn-feed-back')!
const btnToBoard = document.querySelector<HTMLButtonElement>('#btn-to-board')!
const feedTitle = document.querySelector<HTMLElement>('#feed .feed-title')!
const boardScreen = document.querySelector<HTMLElement>('#board')!
const btnBoardBack = document.querySelector<HTMLButtonElement>('#btn-board-back')!
const boardMeta = document.querySelector<HTMLElement>('#board-meta')!
const boardPodium = document.querySelector<HTMLElement>('#board-podium')!
const boardList = document.querySelector<HTMLElement>('#board-list')!
const boardError = document.querySelector<HTMLElement>('#board-error')!
const boardTitle = document.querySelector<HTMLElement>('#board-title')!
const boardRangeTabs = document.querySelector<HTMLElement>('.board-range-tabs')!
const profileScreen = document.querySelector<HTMLElement>('#profile')!
const btnToProfile = document.querySelector<HTMLButtonElement>('#btn-to-profile')!
const btnFeedToProfile = document.querySelector<HTMLButtonElement>('#btn-feed-to-profile')!
const btnFeedConnect = document.querySelector<HTMLButtonElement>('#btn-feed-connect')
const imgLightbox = document.querySelector<HTMLElement>('#img-lightbox')
const imgLightboxImg = document.querySelector<HTMLImageElement>('#img-lightbox-img')
const imgLightboxClose = document.querySelector<HTMLButtonElement>('#img-lightbox-close')
const btnProfileBack = document.querySelector<HTMLButtonElement>('#btn-profile-back')!
const btnProfileDisconnect = document.querySelector<HTMLButtonElement>('#btn-profile-disconnect')!
const btnProfilePost = document.querySelector<HTMLButtonElement>('#btn-profile-post')!
const btnProfileBell = document.querySelector<HTMLButtonElement>('#btn-profile-bell')!
const profileBellBadge = document.querySelector<HTMLElement>('#profile-bell-badge')!
const profileAddressEl = document.querySelector<HTMLElement>('#profile-address')!
const profileTodayPoints = document.querySelector<HTMLElement>('#profile-today-points')!
const profileAxieGrid = document.querySelector<HTMLElement>('#profile-axie-grid')!
const profileAxieEmpty = document.querySelector<HTMLElement>('#profile-axie-empty')!
const btnProfileAxieMore = document.querySelector<HTMLButtonElement>('#btn-profile-axie-more')!
const profileAxieSearch = document.querySelector<HTMLInputElement>('#profile-axie-search')!
const profilePostsList = document.querySelector<HTMLElement>('#profile-posts-list')!
const profilePostsEmpty = document.querySelector<HTMLElement>('#profile-posts-empty')!
const profileBoardList = document.querySelector<HTMLElement>('#profile-board-list')!
const profileBoardEmpty = document.querySelector<HTMLElement>('#profile-board-empty')!
const profileBellPanel = document.querySelector<HTMLElement>('#profile-bell-panel')!
const profileBellList = document.querySelector<HTMLElement>('#profile-bell-list')!
const profileBellEmpty = document.querySelector<HTMLElement>('#profile-bell-empty')!
const btnBellClose = document.querySelector<HTMLButtonElement>('#btn-bell-close')!
const feedModeBar = document.querySelector<HTMLElement>('#feed-mode-bar')!
const btnFeedGlobal = document.querySelector<HTMLButtonElement>('#btn-feed-global')!
const btnFeedFollowing = document.querySelector<HTMLButtonElement>('#btn-feed-following')!
const btnFeedRefresh = document.querySelector<HTMLButtonElement>('#btn-feed-refresh')
const feedTimelineBar = document.querySelector<HTMLElement>('#feed-timeline-bar')!
const btnFollowAxie = document.querySelector<HTMLButtonElement>('#btn-follow-axie')!
const btnTimelineOwner = document.querySelector<HTMLButtonElement>('#btn-timeline-owner')!
const btnBoostAxie = document.querySelector<HTMLButtonElement>('#btn-boost-axie')
const feedFollowerCount = document.querySelector<HTMLElement>('#feed-follower-count')!
const feedBurnMeter = document.querySelector<HTMLElement>('#feed-burn-meter')
const boardBurnMeta = document.querySelector<HTMLElement>('#board-burn-meta')
const castUnlock = document.querySelector<HTMLElement>('#cast-unlock')
const castUnlockConfetti = document.querySelector<HTMLCanvasElement>('#cast-unlock-confetti')
const profileCastCrew = document.querySelector<HTMLElement>('#profile-cast-crew')
const profileCastCrewGrid = document.querySelector<HTMLElement>('#profile-cast-crew-grid')
const profileCastCrewCount = document.querySelector<HTMLElement>('#profile-cast-crew-count')
const profileCastCrewHint = document.querySelector<HTMLElement>('#profile-cast-crew-hint')
const boostSheet = document.querySelector<HTMLElement>('#boost-sheet')
const boostSheetTarget = document.querySelector<HTMLElement>('#boost-sheet-target')
const btnBoostClose = document.querySelector<HTMLButtonElement>('#btn-boost-close')
const btnBoostConfirm = document.querySelector<HTMLButtonElement>('#btn-boost-confirm')
const boostAmountInput = document.querySelector<HTMLInputElement>('#boost-amount-input')
const sparkVictory = document.querySelector<HTMLElement>('#spark-victory')
const sparkVictoryConfetti = document.querySelector<HTMLCanvasElement>('#spark-victory-confetti')
const sparkVictoryKicker = document.querySelector<HTMLElement>('#spark-victory-kicker')
const sparkVictoryAvatar = document.querySelector<HTMLImageElement>('#spark-victory-avatar')
const sparkVictoryTitle = document.querySelector<HTMLElement>('#spark-victory-title')
const sparkVictoryAmount = document.querySelector<HTMLElement>('#spark-victory-amount')
const sparkVictoryBody = document.querySelector<HTMLElement>('#spark-victory-body')
const sparkVictorySub = document.querySelector<HTMLElement>('#spark-victory-sub')
const sparkVictoryDemo = document.querySelector<HTMLElement>('#spark-victory-demo')
const btnSparkVictoryOk = document.querySelector<HTMLButtonElement>('#btn-spark-victory-ok')
const ownerScreen = document.querySelector<HTMLElement>('#owner')!

type TabName = 'feed' | 'snap' | 'ladder' | 'crew'
const tabbar = document.querySelector<HTMLElement>('#tabbar')!

function setActiveTab(tab: TabName | null): void {
  if (!tab) {
    tabbar.hidden = true
    return
  }
  tabbar.hidden = false
  for (const b of tabbar.querySelectorAll<HTMLButtonElement>('.tab')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  }
}

// Paint SVG icons into every [data-icon] placeholder once
for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  el.innerHTML = icon(el.dataset.icon || 'chevron', el.classList.contains('tab-shutter') ? 26 : 24)
}
const btnOwnerBack = document.querySelector<HTMLButtonElement>('#btn-owner-back')!
const ownerTitle = document.querySelector<HTMLElement>('#owner-title')!
const ownerNameEl = document.querySelector<HTMLElement>('#owner-name')!
const ownerAddressEl = document.querySelector<HTMLElement>('#owner-address')!
const ownerTodayPoints = document.querySelector<HTMLElement>('#owner-today-points')!
const ownerAxieGrid = document.querySelector<HTMLElement>('#owner-axie-grid')!
const ownerAxieEmpty = document.querySelector<HTMLElement>('#owner-axie-empty')!
const ownerPostsList = document.querySelector<HTMLElement>('#owner-posts-list')!
const ownerPostsEmpty = document.querySelector<HTMLElement>('#owner-posts-empty')!
const ownerBoardList = document.querySelector<HTMLElement>('#owner-board-list')!
const ownerBoardEmpty = document.querySelector<HTMLElement>('#owner-board-empty')!
const captionInput = document.querySelector<HTMLInputElement>('#caption-input')!
const guestBadge = document.querySelector<HTMLElement>('#guest-badge')!
const btnConnectRonin = document.querySelector<HTMLButtonElement>('#btn-connect-ronin')!
const btnDisconnectRonin = document.querySelector<HTMLButtonElement>('#btn-disconnect-ronin')!
const roninModal = document.querySelector<HTMLElement>('#ronin-modal')!
const roninAddressInput = document.querySelector<HTMLInputElement>('#ronin-address-input')!
const roninModalError = document.querySelector<HTMLElement>('#ronin-modal-error')!
const btnRoninCancel = document.querySelector<HTMLButtonElement>('#btn-ronin-cancel')!
const btnRoninSave = document.querySelector<HTMLButtonElement>('#btn-ronin-save')!
const inventoryTray = document.querySelector<HTMLElement>('#inventory-tray')!
const inventoryScroll = document.querySelector<HTMLElement>('#inventory-scroll')!
const inventoryEmpty = document.querySelector<HTMLElement>('#inventory-empty')!
const inventoryLoading = document.querySelector<HTMLElement>('#inventory-loading')!
const propTray = document.querySelector<HTMLElement>('#prop-tray')!
/** One-Axie loop: worn-item overlay over the live 3D canvas, and the photo-frame picker. */
const wardrobeOverlay = document.querySelector<HTMLCanvasElement>('#wardrobe-overlay')
const frameTray = document.querySelector<HTMLElement>('#frame-tray')
/** One-Axie loop: the wardrobe chips that replace the legacy crew tray under the flag. */
const wardrobeTray = document.querySelector<HTMLElement>('#wardrobe-tray')
const trayHead = document.querySelector<HTMLElement>('#tray-head')
const castTray = document.querySelector<HTMLElement>('#cast-tray')!
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
/** One-Axie loop UI (VITE_BUDDY=1); null when the flag is off. */
let buddyUi: ReturnType<typeof mountBuddyScreens> | null = null
let likedPosts = new Set<string>()
let posting = false
let feedLoading = false
let boardLoading = false
let boardResetsAt: string | null = null
let boardCountdownTimer: number | null = null
let boardRange: 'daily' | 'all' = 'daily'
type InventoryAxie = {
  id: string
  name: string
  image: string
  class: string | null
  label: string
  thumb?: string
}

/** Global / Following / per-Axie timeline (reuse #feed screen). */
let feedMode: 'global' | 'following' | 'axie' = 'global'
/** Quiet auto-refresh while Global/Following feed is visible (~25s). */
let feedAutoRefreshTimer: number | null = null
const FEED_AUTO_REFRESH_MS = 25_000
/** Paused while R1 is in active development — manual ↻ / pull still work */
const FEED_AUTO_REFRESH_ENABLED = false
let timelineAxieId: string | null = null
let timelineFollowerCount = 0
let followedAxieIds = new Set<string>()
let timelineOwner: TimelineOwner | null = null
let burnsToday: BurnsToday | null = null
/** Guest cast-follow CTA should Connect so crew isn't lost */
let pendingCastFollowSave = false
let boostTargetAxieId: string | null = null
let viewingOwnerAddress = ''
let ownerTab: 'axies' | 'posts' | 'board' = 'axies'
let profileTab: 'axies' | 'posts' | 'board' = 'axies'
let profileAxieFilter: 'all' | 'used' | 'never' = 'all'
let profileInventory: InventoryAxie[] = []
let profileInventoryTotal = 0
let profileInventoryFrom = 0
let profileInventoryLoading = false
let profilePostedIdsToday = new Set<string>()
let profilePostedIdsAll = new Set<string>()
let notifUnread = 0
let lastNotifList: SocialNotif[] = []
let celebrationQueue: SocialNotif[] = []
let celebratingSocial = false
let activeCelebrationNotifId: string | null = null
const INVENTORY_TRAY_CAP = 12
let sticker3d: Sticker3D | null = null
/** Mixer-backed animated 3D Axie (numeric cast, owned Axies, Olek, villain, golden). */
let axie3d: Axie3D | null = null
const snapshotCache = new Map<string, string>()

function is3DMixerFace(id: string): boolean {
  return /^\d+$/.test(id) || id === 'buddy' || isCustomFace(id) || (isDevMode() && id.startsWith('dev:'))
}

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
  if (isCustomFace(id)) {
    const mixer = await getAxieMixer()
    const { descriptor, gold } = descriptorFor(id, mixer)
    return { kind: 'descriptor', descriptor, gold, label: id }
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
  return buddyEnabled && Boolean(buddyState.active?.wardrobe.unlocked.includes('cape'))
}

function syncFrameTray(): void {
  if (!frameTray) return
  const on = framesUnlocked()
  frameTray.innerHTML = on ? frameTrayHtml(FRAME_IDS, activeFrame()) : ''
  frameTray.hidden = !on
}

/**
 * The Mystic glow, bond level 10. No new art: the live 3D layer and the Home hero box get a CSS
 * drop-shadow halo, and `captureComposite` paints the same colour into the photo.
 */
function buddyGlowOn(): boolean {
  return buddyEnabled && (buddyState.active?.level ?? 0) >= 10
}
function syncBuddyGlow(): void {
  stickerLayer.classList.toggle('bd-glow', buddyGlowOn())
}

/** The buddy's wardrobe chips. Empty (and hidden) with no active hatched Axie. */
function syncWardrobeTray(): void {
  if (!wardrobeTray) return
  const html = buddyEnabled ? wardrobeTrayHtml(buddyState.active) : ''
  wardrobeTray.innerHTML = html
  wardrobeTray.hidden = !html
}

/**
 * R1 camera tray: the one-Axie loop owns it. The legacy "Your crew" head, the cast tray, the prop
 * tray and the owned-inventory tray are all hidden, and the buddy wardrobe takes their slot.
 *
 * Called from every place that un-hides one of those (`renderCreateTrays`, `refreshIdentityChrome`,
 * `syncQuestHud`) rather than once at boot, because those run again later.
 */
function syncCameraTrays(): void {
  if (!buddyEnabled) return
  if (trayHead) trayHead.hidden = true
  castTray.hidden = true
  propTray.hidden = true
  inventoryTray.hidden = true
  // Top-chrome nav chips into the legacy screens: R1 has no feed and no profile.
  if (btnToFeed) btnToFeed.hidden = true
  if (btnToProfile) btnToProfile.hidden = true
  syncWardrobeTray()
  syncBuddyGlow()
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
  if (!buddyEnabled || activeCast !== 'buddy') return null
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

/** Runs on every 3D frame: clear the overlay and stamp the worn sprite on its joint. */
function drawWardrobeOverlay(): void {
  if (!wardrobeOverlay) return
  const worn = wornItem()
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
 * Hide the legacy `<img>` sticker because a 3D face has taken over the layer, and drop whatever it
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

/** Transparent PNG of a 3D face for group-photo extras (rendered offscreen once). */
async function snapshotFace(id: string): Promise<string | null> {
  const hit = snapshotCache.get(id)
  if (hit) return hit
  try {
    const spec = await specForFace(id)
    if (!spec) return null
    const off = createAxie3D(`axie3d-snap-${id}`)
    off.canvas.style.position = 'absolute'
    off.canvas.style.left = '-9999px'
    off.canvas.style.width = '512px'
    off.canvas.style.height = '512px'
    document.body.appendChild(off.canvas)
    const ok = await off.load(spec)
    const url = ok ? off.snapshot(512) : null
    off.dispose()
    if (url) snapshotCache.set(id, url)
    return url
  } catch (err) {
    console.warn('[axie-idol] snapshot failed', id, err)
    return null
  }
}
let spineSticker: SpineSticker | null = null
let propOverlay: PropOverlay | null = null
let equippedProp: PropId | null = null
let equipRequest = 0
/** Active kit mascot — default Kotaro */
let activeCast: FaceId = 'kotaro'
let castRequest = 0
/** Official Axie ID PNG sticker (CDN) — null when using kit cast */
let customAxieId: string | null = null
/** Connected Ronin address (normalized 0x…) or '' */
let roninAddress = ''
/** Owned inventory cache */
let inventoryAxies: InventoryAxie[] = []
let inventoryLoadingFlag = false
/** Label for active owned Axie (Name #id) */
let ownedAuthorLabel: string | null = null
/** Interactive hit target: 3D canvas or PNG img */
let stickerTarget: HTMLElement = stickerImg
/** User-controlled prop offset from the default hand-ish slot (viewfinder px). */
const propDrag = { offsetX: 0, offsetY: 0, scale: 1 }

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
  // When camera is hidden (Feed landing), rect is 0×0 — fall back so we never
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

function defaultPropHandOffset(): { ox: number; oy: number } {
  const base = Math.min(220, Math.max(140, 0.42 * Math.min(window.innerWidth, window.innerHeight)))
  const handX = base * 0.38 * state.scale
  const handY = base * -0.02 * state.scale
  const rad = (state.rotation * Math.PI) / 180
  return {
    ox: handX * Math.cos(rad) - handY * Math.sin(rad),
    oy: handX * Math.sin(rad) + handY * Math.cos(rad),
  }
}

function resetPropDrag(): void {
  propDrag.offsetX = 0
  propDrag.offsetY = 0
  propDrag.scale = 1
}

function applyStickerTransform(): void {
  const gx = state.gyroX
  const gy = state.gyroY
  stickerTarget.style.left = `${state.x + gx}px`
  stickerTarget.style.top = `${state.y + gy}px`
  stickerTarget.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg) scale(${state.scale})`
  sticker3d?.setLean(gx, gy)
  spineSticker?.setLean?.(gx, gy)
  syncLeadShinyClass()
  positionWardrobeOverlay()

  // Equipped prop is a separate canvas hit-target; tracks sticker + user offset.
  if (propOverlay?.canvas && !propOverlay.canvas.hidden) {
    const el = propOverlay.canvas
    const { ox, oy } = defaultPropHandOffset()
    el.style.left = `${state.x + gx + ox + propDrag.offsetX}px`
    el.style.top = `${state.y + gy + oy + propDrag.offsetY}px`
    el.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg) scale(${state.scale * propDrag.scale})`
  }
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
  btnFlip.disabled = true
}

function loadUpload(file: File): void {
  const url = URL.createObjectURL(file)
  uploadPreview.onload = () => {
    uploadPreview.hidden = false
    video.hidden = true
    mode = 'upload'
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
    if (!propDragging && propPointers.size === 0) {
      stickerLayer.style.zIndex = '2'
    }
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

/* --- independent prop drag (separate hit target from mascot) --- */
let propDragging = false
let propDragId: number | null = null
let propLastX = 0
let propLastY = 0
const propPointers = new Map<number, { x: number; y: number }>()
let propPinchStartDist = 0
let propPinchStartScale = 1
let propPinching = false
let propPointerBound = false
let propPointerEl: HTMLElement | null = null

function onPropPointerDown(e: PointerEvent): void {
  e.preventDefault()
  e.stopPropagation()
  const el = propPointerEl
  if (!el) return
  el.setPointerCapture(e.pointerId)
  stickerLayer.style.zIndex = '6'
  el.style.zIndex = '7'
  propPointers.set(e.pointerId, pointerPos(e))
  if (propPointers.size === 1) {
    propDragging = true
    propDragId = e.pointerId
    propLastX = e.clientX
    propLastY = e.clientY
    propPinching = false
  } else if (propPointers.size === 2) {
    propDragging = false
    propPinching = true
    const pts = [...propPointers.values()]
    propPinchStartDist = dist(pts[0], pts[1])
    propPinchStartScale = propDrag.scale
  }
}

function onPropPointerMove(e: PointerEvent): void {
  if (!propPointers.has(e.pointerId)) return
  propPointers.set(e.pointerId, pointerPos(e))

  if (propPointers.size >= 2 && propPinching) {
    const pts = [...propPointers.values()]
    const d = dist(pts[0], pts[1])
    if (propPinchStartDist > 0) {
      propDrag.scale = clamp(propPinchStartScale * (d / propPinchStartDist), 0.4, 2.5)
      applyStickerTransform()
    }
    return
  }

  if (propDragging && e.pointerId === propDragId) {
    const dx = e.clientX - propLastX
    const dy = e.clientY - propLastY
    propLastX = e.clientX
    propLastY = e.clientY
    propDrag.offsetX += dx
    propDrag.offsetY += dy
    applyStickerTransform()
  }
}

function endPropPointer(e: PointerEvent): void {
  propPointers.delete(e.pointerId)
  if (e.pointerId === propDragId) {
    propDragging = false
    propDragId = null
  }
  if (propPointers.size < 2) propPinching = false
  if (propPointers.size === 1) {
    const [id, pos] = [...propPointers.entries()][0]
    propDragging = true
    propDragId = id
    const rect = viewfinder.getBoundingClientRect()
    propLastX = pos.x + rect.left
    propLastY = pos.y + rect.top
  }
  if (propPointers.size === 0 && propPointerEl) {
    propPointerEl.style.zIndex = '2'
    if (!dragging && activePointers.size === 0) {
      stickerLayer.style.zIndex = '2'
    }
  }
}

function bindPropPointers(el: HTMLElement | null): void {
  if (propPointerBound && propPointerEl) {
    propPointerEl.removeEventListener('pointerdown', onPropPointerDown)
    propPointerEl.removeEventListener('pointermove', onPropPointerMove)
    propPointerEl.removeEventListener('pointerup', endPropPointer)
    propPointerEl.removeEventListener('pointercancel', endPropPointer)
    propPointerBound = false
    propPointerEl = null
  }
  if (!el) return
  propPointerEl = el
  el.addEventListener('pointerdown', onPropPointerDown)
  el.addEventListener('pointermove', onPropPointerMove)
  el.addEventListener('pointerup', endPropPointer)
  el.addEventListener('pointercancel', endPropPointer)
  propPointerBound = true
}

function unbindPropPointers(): void {
  bindPropPointers(null)
}

/* --- viewfinder-wide two-finger pinch (hit target does not shrink with CSS scale) --- */
const vfPointers = new Map<number, { x: number; y: number }>()
let vfPinching = false
let vfPinchStartDist = 0
let vfPinchStartScale = 1
let vfPinchStartAngle = 0
let vfPinchStartRotation = 0

function isPropPointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('#prop-overlay'))
}

function isUiChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.chrome, .toolbar, .cast-tray, .prop-tray, .inventory-tray, .ronin-modal, .spark-victory, .cast-unlock, .camera-gate, .extra-sticker, #feed, #board, #profile, button, a, input, label, form',
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
  return Boolean(target.closest('#sticker, #sticker3d, #axie3d, #sticker-layer canvas:not(.wardrobe-overlay)'))
}

function onVfPointerDown(e: PointerEvent): void {
  if (isPropPointerTarget(e.target)) return
  if (isUiChromeTarget(e.target)) return
  // Avoid fighting an in-progress prop pinch/drag
  if (propPointers.size > 0 || propPinching) return

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
    // Bail if prop took over mid-gesture
    if (propPointers.size > 0 || propPinching) {
      vfPinching = false
      rotatingWithTwoFingers = false
      return
    }
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
  if (isPropPointerTarget(e.target) || isUiChromeTarget(e.target)) return
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

btnToFeed.addEventListener('click', () => {
  void showFeed()
})

btnFeedBack.addEventListener('click', () => {
  if (feedMode === 'axie') {
    clearAxieTimeline()
    return
  }
  showViewfinderFromFeed()
})

btnToProfile?.addEventListener('click', () => {
  void showProfile()
})
btnFeedToProfile?.addEventListener('click', () => {
  void showProfile()
})
btnFeedConnect?.addEventListener('click', () => {
  void connectRonin()
})
btnProfileBack?.addEventListener('click', () => {
  void showFeed(feedMode === 'following' ? 'following' : 'global')
})
btnProfileDisconnect?.addEventListener('click', () => {
  disconnectRonin()
  void showFeed('global')
})
btnProfilePost?.addEventListener('click', () => {
  hideAllScreens()
  setActiveTab(null)
  viewfinder.hidden = false
  viewfinder.classList.add('active')
  showLiveToast('Pick an owned Axie, then capture & Post', 2200)
})
btnProfileBell?.addEventListener('click', () => {
  if (profileBellPanel) profileBellPanel.hidden = false
  void refreshNotifications()
})
btnBellClose?.addEventListener('click', () => {
  if (profileBellPanel) profileBellPanel.hidden = true
  void markNotificationsRead()
})
btnFeedGlobal?.addEventListener('click', () => {
  void showFeed('global')
})

btnFeedRefresh?.addEventListener('click', () => {
  void refreshFeed()
})

/* Light pull-to-refresh on feed list (touch, at top). */
;(function setupFeedPullRefresh() {
  let startY = 0
  let pulling = false
  feedList.addEventListener(
    'touchstart',
    (e) => {
      if (feedScreen.hidden) return
      if (feedMode !== 'global' && feedMode !== 'following' && feedMode !== 'axie') return
      if (feedList.scrollTop > 2) return
      const t = e.touches[0]
      if (!t) return
      startY = t.clientY
      pulling = true
    },
    { passive: true },
  )
  feedList.addEventListener(
    'touchend',
    (e) => {
      if (!pulling) return
      pulling = false
      const t = e.changedTouches[0]
      if (!t) return
      const dy = t.clientY - startY
      if (dy > 70 && feedList.scrollTop <= 2) {
        void refreshFeed()
      }
    },
    { passive: true },
  )
})()

btnFeedFollowing?.addEventListener('click', () => {
  if (!roninAddress) {
    void connectRonin()
    return
  }
  void showFeed('following')
})
btnFollowAxie?.addEventListener('click', () => {
  const id = btnFollowAxie.dataset.axieId || timelineAxieId
  if (!id) return
  void toggleFollowCostume(id)
})
btnBoostAxie?.addEventListener('click', () => {
  const id = btnBoostAxie.dataset.axieId || timelineAxieId
  if (!id) return
  if (!roninAddress) {
    void connectRonin()
    return
  }
  openBoostSheet(id)
})
btnBoostClose?.addEventListener('click', () => closeBoostSheet())
boostSheet?.addEventListener('click', (e) => {
  if (e.target === boostSheet) closeBoostSheet()
})
btnSparkVictoryOk?.addEventListener('click', () => {
  const snapCast = btnSparkVictoryOk.dataset.snapCast
  const equipId = btnSparkVictoryOk.dataset.equipProp
  if (snapCast || equipId) {
    delete btnSparkVictoryOk.dataset.snapCast
    delete btnSparkVictoryOk.dataset.equipProp
    hideSparkVictory()
    showViewfinderFromFeed()
    if (snapCast) void selectCast(snapCast as CastId)
    if (equipId) void equipProp(equipId as PropId)
    return
  }
  const wasSocial = Boolean(activeCelebrationNotifId)
  const wasCastFollow = sparkVictory?.classList.contains('is-cast-follow') && !sparkVictory?.classList.contains('is-social')
  const shouldConnect = pendingCastFollowSave && !roninAddress && wasCastFollow && !wasSocial
  pendingCastFollowSave = false
  hideSparkVictory()
  if (shouldConnect) {
    void showFeed()
    void connectRonin()
    return
  }
  // Cast-follow after post → return to feed; social cards just dismiss into queue
  if (wasCastFollow && !wasSocial) void showFeed()
})
sparkVictory?.addEventListener('click', (e) => {
  if (e.target === sparkVictory) hideSparkVictory()
})

boostSheet?.querySelectorAll('.boost-chip').forEach((el) => {
  el.addEventListener('click', () => {
    const amt = (el as HTMLElement).dataset.amount || '100'
    if (boostAmountInput) boostAmountInput.value = amt
    boostSheet.querySelectorAll('.boost-chip').forEach((c) => c.classList.remove('is-active'))
    el.classList.add('is-active')
  })
})
btnBoostConfirm?.addEventListener('click', () => {
  const amt = Number(boostAmountInput?.value || 100)
  void submitFanBoost(amt)
})
btnTimelineOwner?.addEventListener('click', () => {
  const addr = btnTimelineOwner.dataset.ownerAddress || timelineOwner?.address || ''
  if (!addr) return
  void openOwnerHouse(addr)
})
btnOwnerBack?.addEventListener('click', () => {
  void showFeed(feedMode === 'following' ? 'following' : 'global')
})
document.querySelectorAll<HTMLButtonElement>('.owner-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab as 'axies' | 'posts' | 'board' | undefined
    if (!tab) return
    setOwnerTab(tab)
  })
})
btnProfileAxieMore?.addEventListener('click', () => {
  void loadProfileAxies(false)
})
profileAxieSearch?.addEventListener('input', () => {
  renderProfileAxieGrid()
})

document.querySelectorAll<HTMLButtonElement>('.profile-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab as 'axies' | 'posts' | 'board' | undefined
    if (!tab) return
    setProfileTab(tab)
  })
})
document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.filter as 'all' | 'used' | 'never' | undefined
    if (!f) return
    profileAxieFilter = f
    document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.filter === f)
    })
    renderProfileAxieGrid()
  })
})

profileAxieGrid?.addEventListener('click', (e) => {
  const timelineBtn = (e.target as HTMLElement | null)?.closest?.('.profile-axie-timeline') as HTMLElement | null
  if (timelineBtn?.dataset?.axieId) {
    e.preventDefault()
    void openAxieTimeline(timelineBtn.dataset.axieId)
    return
  }
  const pick = (e.target as HTMLElement | null)?.closest?.('.profile-axie-pick') as HTMLElement | null
  const id = pick?.dataset?.axieId
  if (!id) return
  const meta = profileInventory.find((a) => a.id === id)
  void loadAxieIdSticker(id, {
    skipSpine: false,
    label: meta?.label,
    toastName: meta?.label || `Axie #${id}`,
  })
  renderProfileAxieGrid()
  showLiveToast(`Costume: ${meta?.label || '#' + id}`, 1600)
})

profileBoardList?.addEventListener('click', (e) => {
  const row = (e.target as HTMLElement | null)?.closest?.('[data-axie-id]') as HTMLElement | null
  const id = row?.dataset?.axieId
  if (!id) return
  void openAxieTimeline(id)
})

ownerAxieGrid?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement | null)?.closest?.('[data-axie-id]') as HTMLElement | null
  const id = card?.dataset?.axieId
  if (!id) return
  void openAxieTimeline(id)
})
ownerBoardList?.addEventListener('click', (e) => {
  const row = (e.target as HTMLElement | null)?.closest?.('[data-axie-id]') as HTMLElement | null
  const id = row?.dataset?.axieId
  if (!id) return
  void openAxieTimeline(id)
})
ownerPostsList?.addEventListener('click', (e) => {
  if (handleOwnerByClick(e)) return
  const axieEl = (e.target as HTMLElement | null)?.closest?.('.feed-axie') as HTMLElement | null
  if (axieEl?.dataset?.axieId) {
    e.preventDefault()
    void openAxieTimeline(axieEl.dataset.axieId)
    return
  }
  const likeBtn = (e.target as HTMLElement | null)?.closest?.('.like-btn') as HTMLButtonElement | null
  if (likeBtn?.dataset.postId) {
    e.preventDefault()
    void toggleLike(likeBtn.dataset.postId, likeBtn)
    return
  }
  const commentBtn = (e.target as HTMLElement | null)?.closest?.('.comment-submit') as HTMLButtonElement | null
  if (commentBtn) {
    e.preventDefault()
    const form = commentBtn.closest('form.comment-form') as HTMLFormElement | null
    if (form) void submitComment(form)
  }
})
ownerPostsList?.addEventListener('submit', (e) => {
  const form = (e.target as HTMLElement | null)?.closest?.('form.comment-form') as HTMLFormElement | null
  if (!form) return
  e.preventDefault()
  void submitComment(form)
})

profileBellList?.addEventListener('click', (e) => {
  const item = (e.target as HTMLElement | null)?.closest?.('.bell-item') as HTMLElement | null
  if (!item) return
  const postId = item.dataset.postId
  const notifId = item.dataset.notifId
  if (notifId) void markNotificationsRead([notifId])
  if (profileBellPanel) profileBellPanel.hidden = true
  void (async () => {
    await showFeed('global')
    // Scroll to post if present
    if (postId) {
      const el = feedList.querySelector(`[data-post-id="${CSS.escape(postId)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })()
})

profilePostsList?.addEventListener('click', (e) => {
  if (handleOwnerByClick(e)) return
  const axieEl = (e.target as HTMLElement | null)?.closest?.('.feed-axie') as HTMLElement | null
  if (axieEl?.dataset?.axieId) {
    e.preventDefault()
    void openAxieTimeline(axieEl.dataset.axieId)
    return
  }
  const likeBtn = (e.target as HTMLElement | null)?.closest?.('.like-btn') as HTMLButtonElement | null
  if (likeBtn?.dataset.postId) {
    e.preventDefault()
    void toggleLike(likeBtn.dataset.postId, likeBtn)
  }
})

feedEmpty?.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement | null)?.closest?.('[data-go="board"]') as HTMLElement | null
  if (!link) return
  e.preventDefault()
  void showBoard()
})

guestBadge?.addEventListener('click', () => {
  if (!roninAddress) return
  void showProfile()
})


btnToBoard.addEventListener('click', () => {
  void showBoard()
})

btnBoardBack.addEventListener('click', () => {
  void showFeed()
})

boardRangeTabs.addEventListener('click', (e) => {
  const tab = (e.target as HTMLElement | null)?.closest?.('.board-range-tab') as HTMLButtonElement | null
  const next = tab?.dataset?.range
  if (next !== 'daily' && next !== 'all') return
  if (next === boardRange) return
  boardRange = next
  syncBoardRangeTabs()
  void refreshBoard()
})

boardList.addEventListener('click', (e) => {
  const shareBtn = (e.target as HTMLElement | null)?.closest?.('.board-share-btn') as HTMLElement | null
  if (shareBtn) {
    e.preventDefault()
    e.stopPropagation()
    const axieId = shareBtn.dataset.axieId || ''
    const posterKey = shareBtn.dataset.posterKey || ''
    const rank = Number(shareBtn.dataset.shareRank || 0)
    const row =
      (posterKey
        ? lastBoardRankings.find((r) => r.posterKey === posterKey && r.rank === rank)
        : null) ||
      lastBoardRankings.find((r) => r.axieId === axieId && r.rank === rank) ||
      lastBoardRankings.find((r) => r.axieId === axieId)
    if (row) void shareBoardRankCard(row, boardRange)
    return
  }
  if (handleOwnerByClick(e)) return
  const row = (e.target as HTMLElement | null)?.closest?.('[data-axie-id], [data-owner-address]') as HTMLElement | null
  const ownerAddr = row?.dataset?.ownerAddress
  if (ownerAddr) {
    e.preventDefault()
    void openOwnerHouse(ownerAddr)
    return
  }
  const id = row?.dataset?.axieId
  if (!id) return
  e.preventDefault()
  void openAxieTimeline(id)
})

boardPodium.addEventListener('click', (e) => {
  const shareBtn = (e.target as HTMLElement | null)?.closest?.('.board-share-btn') as HTMLElement | null
  if (shareBtn) {
    e.preventDefault()
    e.stopPropagation()
    const axieId = shareBtn.dataset.axieId || ''
    const posterKey = shareBtn.dataset.posterKey || ''
    const rank = Number(shareBtn.dataset.shareRank || 0)
    const row =
      (posterKey
        ? lastBoardRankings.find((r) => r.posterKey === posterKey && r.rank === rank)
        : null) ||
      lastBoardRankings.find((r) => r.axieId === axieId && r.rank === rank) ||
      lastBoardRankings.find((r) => r.axieId === axieId)
    if (row) void shareBoardRankCard(row, boardRange)
    return
  }
  if (handleOwnerByClick(e)) return
  const row = (e.target as HTMLElement | null)?.closest?.('[data-axie-id], [data-owner-address]') as HTMLElement | null
  const ownerAddr = row?.dataset?.ownerAddress
  if (ownerAddr) {
    e.preventDefault()
    void openOwnerHouse(ownerAddr)
    return
  }
  const id = row?.dataset?.axieId
  if (!id) return
  e.preventDefault()
  void openAxieTimeline(id)
})

feedScores.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement | null)?.closest?.('.score-chip') as HTMLElement | null
  const id = chip?.dataset?.axieId
  if (!id) return
  e.preventDefault()
  void openAxieTimeline(id)
})

feedList.addEventListener('click', (e) => {
  if (handleOwnerByClick(e)) return
  const axieEl = (e.target as HTMLElement | null)?.closest?.(
    '.feed-axie, .id-chip[data-axie-id]',
  ) as HTMLElement | null
  if (axieEl?.dataset?.axieId) {
    e.preventDefault()
    void openAxieTimeline(axieEl.dataset.axieId)
    return
  }
  const followBtn = (e.target as HTMLElement | null)?.closest?.('[data-follow-axie]') as HTMLButtonElement | null
  if (followBtn?.dataset.followAxie) {
    e.preventDefault()
    void toggleFollowCostume(followBtn.dataset.followAxie)
    return
  }
  const likeBtn = (e.target as HTMLElement | null)?.closest?.('.like-btn') as HTMLButtonElement | null
  if (likeBtn) {
    e.preventDefault()
    const id = likeBtn.dataset.postId
    if (!id) return
    void toggleLike(id, likeBtn)
    return
  }
  const commentBtn = (e.target as HTMLElement | null)?.closest?.(
    '.comment-submit',
  ) as HTMLButtonElement | null
  if (commentBtn) {
    e.preventDefault()
    const form = commentBtn.closest('form.comment-form') as HTMLFormElement | null
    if (!form) return
    void submitComment(form)
  }
})

feedList.addEventListener('submit', (e) => {
  const form = (e.target as HTMLElement | null)?.closest?.('form.comment-form') as HTMLFormElement | null
  if (!form) return
  e.preventDefault()
  void submitComment(form)
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
  if (!buddyEnabled || !buddyState.active?.hatchedAt || !captureAnchor) return
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

/** A fresh copy of the plain capture with a speech bubble drawn on it, or null if that failed. */
async function bubbleOnto(plain: Blob, line: string, anchor: BubbleAnchor): Promise<Blob | null> {
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
  if (!drawSpeechBubble(ctx, line, anchor, family)) return null
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
}

/**
 * The egg's line on the photo: no model, no server, just the next line in its small voice, so the
 * five photos before the hatch already feel like something is in there.
 */
async function stampEggLine(plain: Blob, seq: number): Promise<void> {
  const b = buddyState.active
  if (!buddyEnabled || !b || b.hatchedAt || !captureAnchor) return
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
  const outW = Math.min(1440, Math.max(srcW, 720))
  const outH = Math.round(outW * (vf.height / vf.width))
  canvas.width = outW
  canvas.height = outH

  // Draw video/image with cover crop into canvas
  const scaleCover = Math.max(outW / srcW, outH / srcH)
  const dw = srcW * scaleCover
  const dh = srcH * scaleCover
  const dx = (outW - dw) / 2
  const dy = (outH - dh) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, outW, outH)
  ctx.clip()
  ctx.translate(dx, dy)
  ctx.scale(scaleCover, scaleCover)
  drawBase(ctx, srcW, srcH)
  ctx.restore()

  const scaleX = outW / vf.width
  const cx = (state.x + state.gyroX) * scaleX
  const cy = (state.y + state.gyroY) * scaleX
  captureAnchor = null

  const useSpine = Boolean(spineSticker?.ready && spineSticker.canvas)
  const use3d = Boolean(sticker3d?.ready)
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
    if (leadShiny && !customAxieId) ctx.filter = SHINY_FILTER
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
  } else if (useSpine && spineSticker) {
    spineSticker.renderNow()
    const spCanvas = spineSticker.canvas
    const baseW = spCanvas.clientWidth * scaleX
    const baseH = spCanvas.clientHeight * scaleX
    ctx.save()
    if (leadShiny && !customAxieId) ctx.filter = SHINY_FILTER
    ctx.translate(cx, cy)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(state.scale, state.scale)
    ctx.drawImage(spCanvas, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()
  } else if (use3d && sticker3d) {
    sticker3d.renderNow()
    const glCanvas = sticker3d.canvas
    const baseW = glCanvas.clientWidth * scaleX
    const baseH = glCanvas.clientHeight * scaleX
    ctx.save()
    if (leadShiny && !customAxieId) ctx.filter = SHINY_FILTER
    ctx.translate(cx, cy)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(state.scale, state.scale)
    ctx.drawImage(glCanvas, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()
  } else {
    if (!stickerImg.complete) {
      await stickerImg.decode().catch(() => undefined)
    }
    const baseW = stickerImg.offsetWidth * scaleX
    const naturalAspect = stickerImg.naturalHeight / Math.max(1, stickerImg.naturalWidth)
    const baseH = baseW * naturalAspect
    captureAnchor = { x: cx, y: cy, halfW: (baseW * state.scale) / 2, halfH: (baseH * state.scale) / 2 }
    ctx.save()
    if (leadShiny && !customAxieId) ctx.filter = SHINY_FILTER
    ctx.translate(cx, cy)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(state.scale, state.scale)
    ctx.drawImage(stickerImg, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()
  }

  if (leadShiny && !customAxieId && leadGlint) {
    await drawGlint(ctx, leadGlint, state.x + state.gyroX, state.y + state.gyroY, state.scale, state.rotation, scaleX)
  }

  // Extra squad mates (group photo)
  await groupPhoto.drawExtras(ctx, scaleX)

  // Equipped prop is always a separate overlay (independent drag hit-target).
  if (propOverlay?.ready && propOverlay.canvas && !propOverlay.canvas.hidden) {
    propOverlay.renderNow()
    const pc = propOverlay.canvas
    const { ox, oy } = defaultPropHandOffset()
    const px = (ox + propDrag.offsetX) * scaleX
    const py = (oy + propDrag.offsetY) * scaleX
    const pw = pc.clientWidth * scaleX
    const ph = pc.clientHeight * scaleX
    const pScale = state.scale * propDrag.scale
    ctx.save()
    ctx.translate(cx + px, cy + py)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(pScale, pScale)
    ctx.drawImage(pc, -pw / 2, -ph / 2, pw, ph)
    ctx.restore()
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
  if (buddyEnabled && buddyState.active && !buddyState.active.hatchedAt) void stampEggLine(blob, captureSeq)
  else void lookAtCapture(blob, captureSeq)

  disposeSpineSticker()
  disposeSticker3D()
  disposeAxie3D()
  disposePropOverlay()
  viewfinder.classList.remove('active')
  viewfinder.hidden = true
  previewScreen.hidden = false
  previewScreen.classList.add('active')
  setActiveTab(null)
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
  // Boot left sticker at 0,0 while Feed was visible — snap to center once sized.
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

function syncPropTrayUI(): void {
  const match = defaultPropForCast(activeCast)
  propTray.querySelectorAll<HTMLButtonElement>('.prop-chip').forEach((btn) => {
    const id = btn.dataset.prop as PropId | undefined
    const on = Boolean(id && equippedProp === id)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.classList.toggle('is-match', Boolean(id && match && id === match))
  })
}

function syncCastTrayUI(): void {
  castTray.querySelectorAll<HTMLButtonElement>('.cast-chip').forEach((btn) => {
    const id = btn.dataset.cast as CastId | undefined
    // Custom Axie ID sticker: no cast chip pressed
    const on = Boolean(!customAxieId && id && activeCast === id)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
  syncInventoryTrayUI()
  syncGroupPhotoUi()
}

/** Transparent PNG for a squad mate joining a group photo. */
function groupStickerSrc(id: string): string {
  const meta = castMeta(id)
  if (!meta || /^\d+$/.test(id)) return axieCdnPng(id)
  return `./stickers/${meta.sticker || `${id}.png`}`
}

/** Group-photo slots for the current level (dev mode: all three, for previews). */
function photoSlots(): number {
  return isDevMode() ? 3 : squadPhotoSlots(currentLevel())
}

function currentLevel(): number {
  return (myCastCrew || loadCachedCastCrew())?.level ?? 0
}

const trayPhotoCount = document.querySelector<HTMLElement>('#tray-photo-count')
const btnTrayClear = document.querySelector<HTMLButtonElement>('#btn-tray-clear')

/** Numbered badges on tray chips + the "photo 1 of 3" counter. */
function syncGroupPhotoUi(): void {
  const slots = photoSlots()
  const inPhoto = 1 + groupPhoto.count()
  castTray.querySelectorAll<HTMLButtonElement>('.cast-chip').forEach((btn) => {
    const id = btn.dataset.cast || ''
    btn.querySelector('.in-photo-badge')?.remove()
    let n = 0
    if (!customAxieId && id === activeCast) n = 1
    else {
      const idx = groupPhoto.list().findIndex((x) => x.id === id)
      if (idx >= 0) n = idx + 2
    }
    if (n > 0 && slots > 1) {
      btn.insertAdjacentHTML('beforeend', `<span class="in-photo-badge" aria-hidden="true">${n}</span>`)
    }
  })
  if (trayPhotoCount) {
    trayPhotoCount.textContent = slots > 1 ? `· photo ${inPhoto} of ${slots}` : '· group photos at Lv 3'
  }
  if (btnTrayClear) btnTrayClear.hidden = groupPhoto.count() === 0
}

const groupPhoto = new GroupPhoto(stickerLayer, () => syncGroupPhotoUi())

/** Lead squad mate rolled shiny for the current photo? */
let leadShiny = false
const SHINIES_LS = 'axieIdol.shinies'
let goldenOdds = 5000
function goldenOddsLabel(): string {
  return goldenOdds.toLocaleString('en-US')
}
function loadSeenShinies(): Set<string> {
  try {
    const raw = localStorage.getItem(SHINIES_LS)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}
function rememberShiny(id: string): void {
  try {
    const seen = loadSeenShinies()
    seen.add(id)
    localStorage.setItem(SHINIES_LS, JSON.stringify([...seen]))
  } catch {
    /* ignore */
  }
}
function announceShiny(id: string): void {
  rememberShiny(id)
  showLiveToast(`Shiny ${castLabelName(id)}! 1 in 256`, 2400)
}
let leadGlint: HTMLImageElement | null = null
function syncLeadShinyClass(): void {
  const on = leadShiny && !customAxieId
  stickerTarget.classList.toggle('is-shiny', on)
  if (on && !leadGlint) {
    leadGlint = makeGlint()
    stickerLayer.appendChild(leadGlint)
  } else if (!on && leadGlint) {
    leadGlint.remove()
    leadGlint = null
  }
  if (leadGlint) {
    leadGlint.style.left = stickerTarget.style.left
    leadGlint.style.top = stickerTarget.style.top
    leadGlint.style.width = `${stickerTarget.offsetWidth || 220}px`
    leadGlint.style.transform = stickerTarget.style.transform
  }
}
/** Dev hook (?dev=1 only): <html data-force-shiny="1"> makes every roll shiny for QA. */
function shinyRandom(): () => number {
  return isDevMode() && document.documentElement.dataset.forceShiny === '1' ? () => 0 : Math.random
}
function rollLeadShiny(id: string): void {
  leadShiny = rollShiny(shinyRandom())
  syncLeadShinyClass()
  if (leadShiny) announceShiny(id)
}

/** Golden Axie found: gold modal, then Snap with it. */
function showGoldenFound(): void {
  if (!sparkVictory) return
  sparkVictory.classList.add('is-cast-follow', 'is-golden')
  if (sparkVictoryKicker) sparkVictoryKicker.textContent = 'GOLDEN AXIE'
  if (sparkVictoryAvatar) {
    sparkVictoryAvatar.src = '/previews/golden.png'
    sparkVictoryAvatar.alt = 'Golden Axie'
    sparkVictoryAvatar.hidden = false
  }
  if (sparkVictoryAmount) sparkVictoryAmount.hidden = true
  if (sparkVictoryTitle) sparkVictoryTitle.textContent = 'You found the Golden Axie!'
  if (sparkVictoryBody) {
    sparkVictoryBody.innerHTML = `One in every <strong>${goldenOddsLabel()}</strong> Snaps hides it, and yours did. Your squad is in the Hall of Fame, and the Golden Axie joins your squad.`
  }
  if (sparkVictorySub) sparkVictorySub.textContent = ''
  if (sparkVictoryNext) sparkVictoryNext.hidden = true
  if (btnSparkVictoryOk) {
    btnSparkVictoryOk.textContent = 'Snap with the Golden Axie'
    btnSparkVictoryOk.dataset.snapCast = 'golden'
  }
  sparkVictory.hidden = false
  startSparkConfetti(4000, sparkVictoryConfetti)
  window.setTimeout(() => btnSparkVictoryOk?.focus(), 60)
}

type GoldenSummary = {
  odds?: number
  count?: number
  latest?: { postId: string; label: string; createdAt: number } | null
  finders?: { postId: string; label: string; axieId: string; createdAt: number }[]
}
function applyGoldenSummary(g: GoldenSummary | null | undefined): void {
  if (!g) return
  if (typeof g.odds === 'number' && g.odds > 0) goldenOdds = g.odds
  const banner = document.querySelector<HTMLElement>('#feed-golden-banner')
  if (banner) {
    banner.innerHTML = g.latest
      ? `<div class="golden-banner">${icon('trophy', 20)}<span><strong>${escapeHtml(g.latest.label)}</strong> found the Golden Axie</span><span class="golden-count">${g.count || 1} found</span></div>`
      : ''
  }
  const hof = document.querySelector<HTMLElement>('#board-hof')
  if (hof) {
    const list = (g.finders || []).map((f) => `<span>${escapeHtml(f.label)}</span>`).join('')
    hof.innerHTML = `<div class="board-hof-head"><span>Golden Axies found</span><span class="board-hof-count">${g.count || 0}</span></div>
<div class="board-hof-sub">Hidden in 1 of every ${goldenOddsLabel()} Snaps. Nobody knows which one.</div>
${list ? `<div class="board-hof-list">${list}</div>` : ''}`
  }
}
btnTrayClear?.addEventListener('click', () => {
  groupPhoto.clear()
  showLiveToast('Back to a solo photo', 1400)
})

function syncInventoryTrayUI(): void {
  inventoryScroll.querySelectorAll<HTMLButtonElement>('.inv-chip').forEach((btn) => {
    const id = btn.dataset.axieId
    const on = Boolean(customAxieId && id && customAxieId === id)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
}

function setMascotLoading(show: boolean, label?: string): void {
  if (!show) {
    mascotLoading.hidden = true
    return
  }
  mascotLoadingText.textContent = label ?? 'Loading…'
  mascotLoading.hidden = false
}

async function clearEquippedProp(): Promise<void> {
  equippedProp = null
  syncPropTrayUI()
  resetPropDrag()
  unbindPropPointers()
  // Legacy in-scene equipment (no longer used for display).
  if (sticker3d?.ready) {
    await sticker3d.setEquipment(null)
  }
  if (propOverlay) {
    await propOverlay.setUrl(null)
  }
}

async function ensurePropOverlay(): Promise<PropOverlay | null> {
  if (propOverlay) return propOverlay
  try {
    const { createPropOverlay } = await import('./propOverlay')
    propOverlay = createPropOverlay(stickerLayer)
    return propOverlay
  } catch (err) {
    console.warn('[axie-idol] prop overlay init failed', err)
    return null
  }
}

function disposePropOverlay(): void {
  if (!propOverlay) return
  unbindPropPointers()
  propOverlay.dispose()
  propOverlay = null
}

async function equipProp(id: PropId): Promise<void> {
  const req = ++equipRequest
  const url = propUrl(id)
  equippedProp = id
  syncPropTrayUI()
  resetPropDrag()

  // Keep the mascot 3D canvas free of in-scene props so the overlay is the
  // sole (independently draggable) prop hit-target for both 3D and PNG paths.
  if (sticker3d?.ready) {
    await sticker3d.setEquipment(null)
  }

  const overlay = await ensurePropOverlay()
  if (req !== equipRequest) return
  if (!overlay) {
    showLiveToast('Props need WebGL — skipped')
    equippedProp = null
    syncPropTrayUI()
    return
  }
  const ok = await overlay.setUrl(url)
  if (req !== equipRequest) return
  if (!ok) {
    showLiveToast('Could not load that prop')
    equippedProp = null
    syncPropTrayUI()
    unbindPropPointers()
    return
  }
  bindPropPointers(overlay.canvas)
  applyStickerTransform()
}

propTray.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.prop-chip') as HTMLButtonElement | null
  if (!btn) return
  e.preventDefault()
  const id = btn.dataset.prop as PropId | undefined
  if (!id) return
  if (!isPropUnlocked(id)) {
    showLiveToast('Keep questing to unlock this prop', 1800)
    return
  }
  if (equippedProp === id) {
    void clearEquippedProp()
    return
  }
  void equipProp(id)
})

frameTray?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.prop-chip') as HTMLButtonElement | null
  if (!btn) return
  e.preventDefault()
  const id = btn.dataset.frame
  if (!isFrameId(id)) return
  lsSet(FRAME_LS, id)
  syncFrameTray()
})


function disposeSpineSticker(): void {
  if (!spineSticker) return
  const wasTarget = stickerTarget === spineSticker.canvas
  try {
    spineSticker.dispose()
  } catch (err) {
    console.warn('[axie-idol] Spine dispose failed', err)
  }
  spineSticker = null
  if (wasTarget) {
    stickerImg.hidden = false
    stickerImg.style.pointerEvents = 'auto'
    bindStickerPointers(stickerImg)
    applyStickerTransform()
  }
}

function disposeSticker3D(): void {
  if (!sticker3d) return
  if (stickerTarget === sticker3d.canvas) stickerTarget = stickerImg
  sticker3d.dispose()
  sticker3d = null
  stickerImg.hidden = false
  stickerImg.style.pointerEvents = "auto"
  bindStickerPointers(stickerImg)
  applyStickerTransform()
}

function applyPngFallback(cast: FaceId): void {
  const meta = castMeta(cast)
  const src = mascotStickerUrl(cast)
  if (!src) {
    // No 2D art for this face (the hatched buddy is mixer-only) — leave the layer empty
    // rather than pointing the <img> at the page URL, which renders as a broken image. The src
    // is cleared too: the previous face's art (the egg sprite) must not survive under the buddy.
    hideStickerImg()
    return
  }
  stickerImg.src = src
  stickerImg.alt = cast === 'egg' ? 'Your egg' : `${meta?.label || cast} Axie sticker`
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
  showLiveToast("3D Axie couldn't load on this phone, using a stand-in", 3200)
}

/** The real character arrived after all — take the stand-in back off the layer. */
function hideBuddyStandIn(): void {
  if (!buddyStandInShown) return
  buddyStandInShown = false
  hideStickerImg()
}

async function initSticker3D(): Promise<void> {
  disposeSpineSticker()
  const cast = activeCast
  const req = ++castRequest
  const url = mascotGlbUrl(cast)
  const meta = castMeta(cast)
  const heavy = cast === 'tripp'
  const label = cast === 'buddy'
    ? buddyState.active?.name || 'your Axie'
    : cast === 'egg'
      ? 'your egg'
      : meta?.label || cast
  setMascotLoading(true, heavy ? `Loading ${label}… (~7MB)` : `Loading ${label}…`)
  applyPngFallback(cast)

  // Mixer-backed faces: numeric cast, Olek, Agonia Echo, Golden
  if (!url && is3DMixerFace(cast)) {
    disposeSticker3D()
    // The hatched buddy has no 2D art of its own, so a failed or slow rig used to leave the
    // camera empty. Report it, and put a stand-in on the layer until the real one is ready.
    const isBuddy = cast === 'buddy'
    buddyStandInShown = false
    const slow = isBuddy
      ? window.setTimeout(() => {
          if (req !== castRequest || axie3d?.ready) return
          reportDiag('3d-slow', `buddy face not ready after ${BUDDY_3D_PATIENCE_MS / 1000}s`)
          showBuddyStandIn()
        }, BUDDY_3D_PATIENCE_MS)
      : 0
    const ok = await showAxie3D(cast, req)
    if (slow) window.clearTimeout(slow)
    if (req !== castRequest) return
    setMascotLoading(false)
    if (ok) hideBuddyStandIn()
    else if (isBuddy) showBuddyStandIn()
    else applyPngFallback(cast)
    return
  }
  disposeAxie3D()

  // No GLB and not a mixer face — PNG only
  if (!url) {
    setMascotLoading(false)
    disposeSticker3D()
    applyPngFallback(cast)
    return
  }

  // Prefer swapping model in-place to avoid tearing down WebGL.
  if (sticker3d) {
    try {
      const ok = await sticker3d.setModel(url)
      if (req !== castRequest) return
      setMascotLoading(false)
      if (!ok) {
        console.info("[axie-idol] using PNG sticker")
        disposeSticker3D()
        applyPngFallback(cast)
        if (equippedProp) void equipProp(equippedProp)
        return
      }
      stickerImg.hidden = true
      stickerImg.style.pointerEvents = "none"
      bindStickerPointers(sticker3d.canvas)
      console.info("[axie-idol] 3D sticker active", cast)
      if (equippedProp) void equipProp(equippedProp)
      return
    } catch (err) {
      console.warn("[axie-idol] setModel failed — recreating", err)
      if (req !== castRequest) return
      disposeSticker3D()
    }
  }

  if (req !== castRequest) return
  disposeSticker3D()
  bindStickerPointers(stickerImg)
  try {
    const { createSticker3D } = await import("./sticker3d")
    const handle = await createSticker3D(stickerLayer, url)
    if (req !== castRequest) {
      handle?.dispose()
      return
    }
    setMascotLoading(false)
    if (!handle || !handle.ready) {
      console.info("[axie-idol] using PNG sticker")
      applyPngFallback(cast)
      if (equippedProp) void equipProp(equippedProp)
      return
    }
    sticker3d = handle
    stickerImg.hidden = true
    stickerImg.style.pointerEvents = "none"
    bindStickerPointers(handle.canvas)
    console.info("[axie-idol] 3D sticker active", cast)
    if (equippedProp) {
      void equipProp(equippedProp)
    }
  } catch (err) {
    if (req !== castRequest) return
    setMascotLoading(false)
    console.warn("[axie-idol] 3D init failed — PNG fallback", err)
    applyPngFallback(cast)
    if (equippedProp) void equipProp(equippedProp)
  }
}

async function selectCast(id: FaceId): Promise<void> {
  if (!isCastUnlocked(id)) {
    showLiveToast('Keep questing to unlock this cast', 1800)
    return
  }
  // Returning to kit cast clears any CDN Axie ID sticker / Spine
  disposeSpineSticker()
  const wasCustom = customAxieId !== null
  customAxieId = null
  ownedAuthorLabel = null
  if (!wasCustom && id === activeCast && sticker3d?.ready) return
  activeCast = id
  if (groupPhoto.has(id)) groupPhoto.remove(id)
  rollLeadShiny(id)
  syncCastTrayUI()
  syncPropTrayUI()
  const match = defaultPropForCast(id)
  await initSticker3D()
  if (activeCast !== id) return
  if (match && isPropUnlocked(match)) void equipProp(match)
  else void clearEquippedProp()
}

castTray.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.cast-chip') as HTMLButtonElement | null
  if (!btn) return
  e.preventDefault()
  const id = btn.dataset.cast as CastId | undefined
  if (!id) return
  const slots = photoSlots()
  const isLead = !customAxieId && id === activeCast
  if (slots <= 1 || isLead) {
    void selectCast(id)
    return
  }
  if (!isCastUnlocked(id)) {
    showLiveToast('Keep questing to unlock this cast', 1800)
    return
  }
  if (groupPhoto.has(id)) {
    groupPhoto.remove(id)
    showLiveToast(`${castLabelName(id)} stepped out of the photo`, 1400)
    return
  }
  if (1 + groupPhoto.count() >= slots) {
    showLiveToast(`Photo is full (${slots} of ${slots}). Tap a face to swap it out.`, 2000)
    return
  }
  const shiny = rollShiny(shinyRandom())
  const extra = groupPhoto.add(id, groupStickerSrc(id), { x: state.x, y: state.y }, groupPhoto.count(), shiny)
  if (extra && is3DMixerFace(id)) {
    void snapshotFace(id).then((url) => {
      if (url && groupPhoto.has(id)) extra.el.src = url
    })
  }
  if (shiny) announceShiny(id)
  else showLiveToast(`${castLabelName(id)} joined the photo · double-tap to make lead`, 1800)
})
castTray.addEventListener('dblclick', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.cast-chip') as HTMLButtonElement | null
  const id = btn?.dataset.cast as CastId | undefined
  if (!id) return
  e.preventDefault()
  if (groupPhoto.has(id)) groupPhoto.remove(id)
  void selectCast(id)
})


function axieCdnPng(id: string): string {
  return `https://axiecdn.axieinfinity.com/axies/${id}/axie/axie-full-transparent.png`
}


// (2D Spine upgrade retired: numeric Axies render as animated 3D via the mixer — see showAxie3D)


async function loadAxieIdSticker(
  id: string,
  opts?: { skipSpine?: boolean; label?: string; toastName?: string },
): Promise<void> {
  const trimmed = id.trim()
  if (!/^\d+$/.test(trimmed)) {
    showLiveToast('Enter a numeric Axie ID')
    return
  }

  const prevSrc = stickerImg.src
  const prevAlt = stickerImg.alt
  customAxieId = trimmed
  if (opts?.label) {
    ownedAuthorLabel = opts.label
  } else {
    const inv = inventoryAxies.find((a) => a.id === trimmed)
    ownedAuthorLabel = inv?.label || `Axie #${trimmed}`
  }
  // Cancel in-flight GLB / cast loads
  const req = ++castRequest
  disposeSpineSticker()
  disposeSticker3D()
  disposeAxie3D()
  syncCastTrayUI()
  void clearEquippedProp()
  const toastName = opts?.toastName || opts?.label || `Axie #${trimmed}`
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
      // Restore previous image or kotaro PNG fallback
      customAxieId = null
      ownedAuthorLabel = null
      syncCastTrayUI()
      if (prevSrc && !prevSrc.includes('axiecdn.axieinfinity.com')) {
        stickerImg.removeAttribute('crossorigin')
        stickerImg.src = prevSrc
        stickerImg.alt = prevAlt
      } else {
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
    showLiveToast('Free cast only — open ?dev=1 for Axie ID')
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
  stopFeedAutoRefresh()
  onboardScreen.classList.remove('active')
  onboardScreen.hidden = true
  viewfinder.classList.remove('active')
  viewfinder.hidden = true
  previewScreen.classList.remove('active')
  previewScreen.hidden = true
  feedScreen.classList.remove('active')
  feedScreen.hidden = true
  boardScreen.classList.remove('active')
  boardScreen.hidden = true
  profileScreen.classList.remove('active')
  profileScreen.hidden = true
  if (ownerScreen) {
    ownerScreen.classList.remove('active')
    ownerScreen.hidden = true
  }
  if (profileBellPanel) profileBellPanel.hidden = true
  // One-Axie loop screens live outside the legacy screen set; hide them too so the camera
  // never opens with a buddy screen still painted underneath it.
  for (const s of document.querySelectorAll<HTMLElement>('.screen.buddy')) s.hidden = true
  pauseBuddyFace()
  stopBoardCountdown()
}

function isCostumeIdClient(id: string): boolean {
  const s = (id || '').trim()
  if (!s) return false
  if (CAST_MASCOTS.some((c) => c.id === s)) return true
  return /^\d+$/.test(s)
}

function castOrAxieLabel(id: string): string {
  const cast = CAST_MASCOTS.find((c) => c.id === id)
  if (cast) return cast.label
  const inv = inventoryAxies.find((a) => a.id === id) || profileInventory.find((a) => a.id === id)
  if (inv?.label) return inv.label
  if (/^\d+$/.test(id)) return `Axie #${id}`
  return id
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

async function showBuddyFaceIn(host: HTMLElement): Promise<void> {
  const req = ++buddyHeroRequest
  for (const old of host.querySelectorAll('[data-buddy-face]')) old.remove()
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

function showViewfinderFromFeed(): void {
  hideAllScreens()
  setActiveTab(null)
  viewfinder.hidden = false
  viewfinder.classList.add('active')
  if (buddyEnabled) {
    // R1: the lead face is always the buddy — the egg sprite before hatching, the character
    // after. Gated on the flag, not on an active buddy: if loadBuddy() failed at boot the
    // legacy Kotaro cast must still never take the camera. faceIdForBuddy() handles null.
    const want = faceIdForBuddy()
    if (activeCast !== want) void selectCast(want)
    else syncCastTrayUI()
    syncQuestHud()
    // sprites are cached per page; decode them before the first frame that needs them
    preloadWardrobe()
    requestBuddyBeforeLine()
  } else if (!customAxieId) {
    // Guest dopamine: default Kotaro on camera if none selected
    if (activeCast !== 'kotaro') {
      void selectCast('kotaro')
    } else {
      syncCastTrayUI()
    }
  }
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
  if (!buddyEnabled || !buddyState.active?.hatchedAt || !bdSpeechVf) return
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

function castLabelFor(id: string): string {
  return castOrAxieLabel(id)
}

function updateFeedChrome(): void {
  const connected = Boolean(roninAddress)
  if (feedModeBar) feedModeBar.hidden = !connected || feedMode === 'axie'
  if (feedTimelineBar) feedTimelineBar.hidden = feedMode !== 'axie'
  const numericTimeline =
    feedMode === 'axie' && Boolean(timelineAxieId) && /^\d+$/.test(timelineAxieId || '')
  if (btnTimelineOwner) {
    const showOwner = numericTimeline && Boolean(timelineOwner?.address)
    btnTimelineOwner.hidden = !showOwner
    if (showOwner && timelineOwner) {
      btnTimelineOwner.dataset.ownerAddress = timelineOwner.address
      btnTimelineOwner.title = `House · ${timelineOwner.displayName}`
    } else {
      btnTimelineOwner.dataset.ownerAddress = ''
    }
  }
  if (btnBoostAxie) {
    btnBoostAxie.hidden = !isBurnsUiEnabled() || !numericTimeline
    if (isBurnsUiEnabled() && numericTimeline && timelineAxieId) {
      btnBoostAxie.dataset.axieId = timelineAxieId
      btnBoostAxie.textContent = roninAddress ? '🔥 Boost' : 'Connect to Boost'
      btnBoostAxie.title = roninAddress
        ? 'Demo burn (ledger) — fan boost'
        : 'Connect Ronin to boost'
    } else {
      btnBoostAxie.dataset.axieId = ''
    }
  }
  updateTimelineBurnMeter()
  if (btnFeedGlobal && btnFeedFollowing) {
    btnFeedGlobal.classList.toggle('is-active', feedMode === 'global')
    btnFeedGlobal.setAttribute('aria-pressed', feedMode === 'global' ? 'true' : 'false')
    btnFeedFollowing.classList.toggle('is-active', feedMode === 'following')
    btnFeedFollowing.setAttribute('aria-pressed', feedMode === 'following' ? 'true' : 'false')
  }
  if (feedMode === 'axie' && timelineAxieId) {
    const label = castOrAxieLabel(timelineAxieId)
    feedTitle.textContent = `${label}'s Idol`
    btnFeedBack.textContent = '← Feed'
    btnFeedBack.title = 'Back to Idol Feed'
    btnFeedBack.classList.remove('feed-create-btn')
    syncFollowButton(timelineAxieId, timelineFollowerCount)
  } else if (feedMode === 'following') {
    feedTitle.textContent = 'Following'
    btnFeedBack.textContent = 'Create'
    btnFeedBack.title = 'Create a moment'
    btnFeedBack.classList.add('feed-create-btn')
  } else {
    feedTitle.textContent = 'Feed'
    btnFeedBack.textContent = 'Create'
    btnFeedBack.title = 'Create a moment'
    btnFeedBack.classList.add('feed-create-btn')
  }
}

function syncFollowButton(axieId: string, count: number): void {
  if (!btnFollowAxie || !feedFollowerCount) return
  btnFollowAxie.dataset.axieId = axieId
  const following = followedAxieIds.has(axieId)
  if (!roninAddress) {
    btnFollowAxie.textContent = 'Connect to Follow'
    btnFollowAxie.classList.remove('is-following')
  } else {
    btnFollowAxie.textContent = following ? 'Following' : 'Follow'
    btnFollowAxie.classList.toggle('is-following', following)
  }
  feedFollowerCount.textContent =
    count === 1 ? '1 follower' : `${count} followers`
}

function clearAxieTimeline(): void {
  feedMode = 'global'
  timelineAxieId = null
  timelineFollowerCount = 0
  updateFeedChrome()
  void refreshFeed().then(() => syncFeedAutoRefresh())
}

async function openAxieTimeline(axieId: string): Promise<void> {
  if (legacyScreensBlocked()) return
  const id = axieId.trim()
  if (!isCostumeIdClient(id)) return
  feedMode = 'axie'
  timelineAxieId = id
  updateFeedChrome()
  if (feedScreen.hidden) {
    hideAllScreens()
    setActiveTab('feed')
    feedScreen.hidden = false
    feedScreen.classList.add('active')
    feedGuest.textContent = authorLabel
  }
  stopFeedAutoRefresh()
  await refreshFeed()
}

/**
 * R1 legacy-screen guard. Under `VITE_BUDDY=1` the one-Axie loop is the whole app: the feed,
 * the quest ladder, the crew profile and the first-run onboarding have no way in. Boot and every
 * buddy screen are already routed away from them; this is the backstop for the legacy handlers
 * that survive on chrome the camera still shares, so a stray click lands on the buddy screens
 * instead of a screen R1 has no navigation out of.
 */
function legacyScreensBlocked(): boolean {
  if (!buddyEnabled) return false
  void buddyUi?.show('auto')
  return true
}

async function showFeed(mode: 'global' | 'following' = 'global'): Promise<void> {
  if (legacyScreensBlocked()) return
  feedMode = mode
  timelineAxieId = null
  timelineFollowerCount = 0
  updateFeedChrome()
  hideAllScreens()
  setActiveTab('feed')
  feedScreen.hidden = false
  feedScreen.classList.add('active')
  feedGuest.textContent = roninAddress
    ? `${ownerDisplayName(roninAddress)} · ${authorLabel}`
    : authorLabel
  if (mode === 'following' && roninAddress) {
    await ensureFollowsLoaded()
  }
  await refreshFeed()
  syncFeedAutoRefresh()
}

function applyBurnsPayload(burns: BurnsToday | null | undefined): void {
  if (!burns || typeof burns !== 'object') return
  burnsToday = burns
  updateTimelineBurnMeter()
  updateBoardBurnMeta()
}

function burnTotalsFor(axieId: string): { total: number; projected: number } {
  const id = String(axieId || '')
  const committed = burnsToday?.committed?.byAxie?.[id]
  const total = committed ? Number(committed.total) || 0 : 0
  const projected = Number(burnsToday?.projectedCrown?.[id] || 0) || 0
  return { total, projected }
}

function formatSlp(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(Math.floor(n))
}

function burnChipsHtml(axieId: string, opts?: { compact?: boolean }): string {
  if (!isBurnsUiEnabled()) return ''
  if (!/^\d+$/.test(axieId)) return ''
  const { total, projected } = burnTotalsFor(axieId)
  if (!total && !projected) return ''
  const parts: string[] = []
  if (total > 0) {
    parts.push(
      `<span class="burn-chip" title="Committed burns today (spark+crown+fan)">🔥 ${formatSlp(total)}</span>`,
    )
  }
  if (projected > 0) {
    parts.push(
      `<span class="burn-chip burn-chip-proj" title="Projected crown if day ended now">👑 ~${formatSlp(projected)}</span>`,
    )
  }
  if (!parts.length) return ''
  if (opts?.compact) return parts.join(' ')
  return `<div class="feed-card-burns">${parts.join('')}</div>`
}

function updateTimelineBurnMeter(): void {
  if (!feedBurnMeter) return
  if (!isBurnsUiEnabled()) {
    feedBurnMeter.hidden = true
    feedBurnMeter.textContent = ''
    return
  }
  if (feedMode !== 'axie' || !timelineAxieId || !/^\d+$/.test(timelineAxieId)) {
    feedBurnMeter.hidden = true
    feedBurnMeter.textContent = ''
    return
  }
  const { total, projected } = burnTotalsFor(timelineAxieId)
  if (!total && !projected) {
    feedBurnMeter.hidden = true
    feedBurnMeter.textContent = ''
    return
  }
  const bits: string[] = []
  if (total > 0) bits.push(`🔥 ${formatSlp(total)} today`)
  if (projected > 0) bits.push(`👑 ~${formatSlp(projected)}`)
  feedBurnMeter.textContent = bits.join(' · ')
  feedBurnMeter.hidden = false
  feedBurnMeter.title = burnsToday?.modeLabel || 'Demo burn (ledger)'
}

function updateBoardBurnMeta(): void {
  if (!boardBurnMeta) return
  if (!isBurnsUiEnabled()) {
    boardBurnMeta.hidden = true
    return
  }
  if (!burnsToday) {
    boardBurnMeta.hidden = true
    return
  }
  const pot = formatSlp(burnsToday.pot)
  const rem = formatSlp(burnsToday.potRemaining)
  boardBurnMeta.hidden = false
  boardBurnMeta.textContent = `Treasury pot ${pot} SLP · remaining ${rem} · ${burnsToday.modeLabel || 'Demo burn (ledger)'}`
}

function openBoostSheet(axieId: string): void {
  if (!boostSheet) return
  if (!isBurnsUiEnabled()) {
    showLiveToast('Burns UI off for R1 — add ?burns=1 to enable', 2200)
    return
  }
  if (!/^\d+$/.test(axieId)) {
    showLiveToast('Boost only for numeric Axies', 2000)
    return
  }
  if (!roninAddress) {
    void connectRonin()
    return
  }
  boostTargetAxieId = axieId
  if (boostSheetTarget) {
    boostSheetTarget.textContent = `${castOrAxieLabel(axieId)} · #${axieId}`
  }
  if (boostAmountInput) boostAmountInput.value = '100'
  boostSheet.querySelectorAll('.boost-chip').forEach((el) => {
    el.classList.toggle('is-active', (el as HTMLElement).dataset.amount === '100')
  })
  boostSheet.hidden = false
}

function closeBoostSheet(): void {
  if (boostSheet) boostSheet.hidden = true
  boostTargetAxieId = null
}

type SparkVictoryOpts = {
  amount?: number
  axieId?: string
  axieLabel?: string
  mode?: string
  modeLabel?: string
  /** Cast-follow / human social celebrations. Not gated by burns UI. */
  kind?: 'spark' | 'castFollow' | 'propUnlock' | 'follow' | 'like' | 'comment'
  castId?: string
  moreUnlocked?: string[]
  fromLabel?: string
  text?: string
  notifId?: string
}

let sparkConfettiRaf = 0
let sparkConfettiUntil = 0

function activeConfettiCanvas(): HTMLCanvasElement | null {
  if (castUnlock && !castUnlock.hidden && castUnlockConfetti) return castUnlockConfetti
  if (sparkVictory && !sparkVictory.hidden && sparkVictoryConfetti) return sparkVictoryConfetti
  return castUnlockConfetti || sparkVictoryConfetti
}

function stopSparkConfetti(): void {
  if (sparkConfettiRaf) {
    cancelAnimationFrame(sparkConfettiRaf)
    sparkConfettiRaf = 0
  }
  sparkConfettiUntil = 0
  for (const canvas of [sparkVictoryConfetti, castUnlockConfetti]) {
    if (!canvas) continue
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

function startSparkConfetti(durationMs = 2600, canvasOverride?: HTMLCanvasElement | null): void {
  const canvas = canvasOverride || activeConfettiCanvas()
  if (!canvas) return
  stopSparkConfetti()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const colors = ['#FF6B2C', '#2B8CEE', '#3ECF8E', '#FFE566', '#E5484D', '#FFFFFF', '#FF9F1C', '#9B5DE5']
  type Flake = {
    x: number
    y: number
    vx: number
    vy: number
    w: number
    h: number
    rot: number
    vr: number
    color: string
  }
  const flakes: Flake[] = []
  const count = Math.min(120, Math.floor(70 + w / 8))
  for (let i = 0; i < count; i++) {
    flakes.push({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.35,
      vx: (Math.random() - 0.5) * 3.2,
      vy: 2.2 + Math.random() * 4.2,
      w: 5 + Math.random() * 8,
      h: 3 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.28,
      color: colors[i % colors.length]!,
    })
  }

  sparkConfettiUntil = performance.now() + durationMs
  const tick = (now: number) => {
    ctx.clearRect(0, 0, w, h)
    const fading = now > sparkConfettiUntil - 500
    const alpha = fading ? Math.max(0, (sparkConfettiUntil - now) / 500) : 1
    for (const f of flakes) {
      f.x += f.vx
      f.y += f.vy
      f.vy += 0.035
      f.rot += f.vr
      if (f.y > h + 24) {
        f.y = -16
        f.x = Math.random() * w
        f.vy = 2 + Math.random() * 3.5
      }
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.rot)
      ctx.globalAlpha = alpha
      ctx.fillStyle = f.color
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
      ctx.restore()
    }
    if (now < sparkConfettiUntil) {
      sparkConfettiRaf = requestAnimationFrame(tick)
    } else {
      sparkConfettiRaf = 0
      ctx.clearRect(0, 0, w, h)
    }
  }
  sparkConfettiRaf = requestAnimationFrame(tick)
}

function hideSparkVictory(): void {
  pendingCastFollowSave = false
  if (btnSparkVictoryOk) {
    btnSparkVictoryOk.textContent = 'Back to the feed'
    delete btnSparkVictoryOk.dataset.snapCast
    delete btnSparkVictoryOk.dataset.equipProp
  }
  if (sparkVictoryNext) sparkVictoryNext.hidden = true
  stopSparkConfetti()
  const dismissedId = activeCelebrationNotifId
  activeCelebrationNotifId = null
  if (sparkVictory) {
    sparkVictory.hidden = true
    sparkVictory.classList.remove('is-cast-follow', 'is-social', 'is-golden')
  }
  if (sparkVictoryAvatar) {
    sparkVictoryAvatar.hidden = true
    sparkVictoryAvatar.removeAttribute('src')
  }
  if (sparkVictoryAmount) sparkVictoryAmount.hidden = false
  if (dismissedId) {
    markCelebratedNotif(dismissedId)
    void markNotificationsRead([dismissedId])
  }
  celebratingSocial = false
  window.setTimeout(() => pumpCelebrationQueue(), 120)
}

let myCastCrew: CastCrewPayload | null = null
function cacheCastCrew(payload: CastCrewPayload | null | undefined): void {
  if (!payload || typeof payload !== 'object') return
  const unlockedCast = payload.unlockedCast || payload.unlocked || ['kotaro']
  if (!unlockedCast.includes('kotaro')) unlockedCast.unshift('kotaro')
  myCastCrew = {
    ...payload,
    unlockedCast,
    unlocked: unlockedCast,
    unlockedProps: payload.unlockedProps || [],
    level: payload.level ?? 0,
  }
  try {
    localStorage.setItem(
      CAST_CREW_CACHE_LS,
      JSON.stringify({
        level: myCastCrew.level,
        postCount: myCastCrew.stats?.posts ?? myCastCrew.postCount ?? 0,
        unlocked: unlockedCast,
        unlockedCast,
        unlockedProps: myCastCrew.unlockedProps || [],
        stats: myCastCrew.stats || null,
        crewFollowerCount: myCastCrew.crewFollowerCount ?? unlockedCast.length,
        nextQuest: myCastCrew.nextQuest ?? null,
        nextUnlock: myCastCrew.nextUnlock ?? null,
        ladder: myCastCrew.ladder || [],
      }),
    )
  } catch {
    /* ignore */
  }
  renderCreateTrays()
  syncQuestHud()
}

function loadCachedCastCrew(): CastCrewPayload | null {
  try {
    const raw = localStorage.getItem(CAST_CREW_CACHE_LS)
    if (!raw) return null
    return JSON.parse(raw) as CastCrewPayload
  } catch {
    return null
  }
}

function castLabelName(castId: string): string {
  return CAST_MASCOTS.find((c) => c.id === castId)?.label || castId
}

function castPreviewSrc(castId: string): string {
  const meta = CAST_MASCOTS.find((c) => c.id === castId)
  if (!meta) {
    if (/^\d+$/.test(castId)) return axieCdnPng(castId)
    return ''
  }
  if (meta.kind === 'axie' || /^\d+$/.test(castId)) return axieCdnPng(castId)
  if (meta.preview) return `/previews/${meta.preview}`
  return axieCdnPng(castId)
}

function loadCelebratedNotifIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CELEBRATED_NOTIFS_LS)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.map(String).slice(0, 200))
  } catch {
    return new Set()
  }
}

function markCelebratedNotif(id: string): void {
  if (!id) return
  const set = loadCelebratedNotifIds()
  set.add(id)
  try {
    localStorage.setItem(CELEBRATED_NOTIFS_LS, JSON.stringify([...set].slice(-120)))
  } catch {
    /* ignore */
  }
}

function enqueueSocialCelebrations(list: SocialNotif[]): void {
  const celebrated = loadCelebratedNotifIds()
  for (const n of list) {
    if (!n || n.read) continue
    if (!['follow', 'like', 'comment'].includes(n.type)) continue
    if (celebrated.has(n.id)) continue
    if (celebrationQueue.some((q) => q.id === n.id)) continue
    if (activeCelebrationNotifId === n.id) continue
    celebrationQueue.push(n)
  }
  pumpCelebrationQueue()
}

function pumpCelebrationQueue(): void {
  if (celebratingSocial) return
  if (sparkVictory && !sparkVictory.hidden) return
  const next = celebrationQueue.shift()
  if (!next) return
  celebratingSocial = true
  activeCelebrationNotifId = next.id
  showSparkVictory({
    kind: next.type as 'follow' | 'like' | 'comment',
    axieId: next.axieId,
    axieLabel: next.axieLabel,
    fromLabel: next.fromLabel,
    text: next.text,
    notifId: next.id,
  })
}

function maybeCelebrateUnread(): void {
  if (!roninAddress || !lastNotifList.length) return
  enqueueSocialCelebrations(lastNotifList)
}

function axiePreviewSrc(axieId: string): string {
  if (CAST_MASCOTS.some((c) => c.id === axieId)) return castPreviewSrc(axieId)
  if (/^\d+$/.test(axieId)) return axieCdnPng(axieId)
  return previewFor(axieId) || ''
}

/** Unified identity chip: Cast / Axie / Owner / Guest */
function identityChipHtml(opts: {
  kind: 'cast' | 'axie' | 'owner' | 'guest'
  name: string
  id?: string
  preview?: string
  button?: boolean
  dataAttrs?: string
  title?: string
}): string {
  const name = escapeHtml(opts.name || 'Guest')
  const title = escapeHtml(opts.title || opts.name || '')
  const thumb = opts.preview
    ? `<img class="id-chip-thumb" src="${escapeHtml(opts.preview)}" alt="" loading="lazy" />`
    : ''
  const badge =
    opts.kind === 'cast'
      ? '<span class="id-chip-badge is-cast">Cast</span>'
      : opts.kind === 'axie'
        ? '<span class="id-chip-badge is-owned">Owned</span>'
        : ''
  const cls = `id-chip is-${opts.kind}`
  const attrs = opts.dataAttrs || ''
  if (opts.button) {
    return `<button type="button" class="${cls}" ${attrs} title="${title}">${thumb}<span class="id-chip-name">${name}</span>${badge}</button>`
  }
  return `<span class="${cls}" ${attrs} title="${title}">${thumb}<span class="id-chip-name">${name}</span>${badge}</span>`
}

function axieIdentityChip(axieId: string, axieLabel: string, asButton = true): string {
  const isCast = CAST_MASCOTS.some((c) => c.id === axieId)
  const preview = axiePreviewSrc(axieId)
  if (isCast) {
    const label = castLabelName(axieId) || axieLabel || axieId
    return identityChipHtml({
      kind: 'cast',
      name: label,
      id: axieId,
      preview,
      button: asButton,
      dataAttrs: `data-axie-id="${escapeHtml(axieId)}"`,
      title: `${label} timeline`,
    })
  }
  const base = (axieLabel || '').replace(/\s#\d+$/, '').trim() || 'Axie'
  const name = /^\d+$/.test(axieId)
    ? base.includes(`#${axieId}`)
      ? base
      : `${base} #${axieId}`
    : axieLabel || axieId
  return identityChipHtml({
    kind: 'axie',
    name,
    id: axieId,
    preview,
    button: asButton,
    dataAttrs: `data-axie-id="${escapeHtml(axieId)}"`,
    title: `${name} timeline`,
  })
}

function authorIdentityChip(p: FeedPost): string {
  if (p.castAuthor || (p.authorGuestId || '').startsWith('cast:') || p.seed) {
    const cid = p.castId || (p.authorGuestId || '').replace(/^cast:/, '') || p.axieId
    return identityChipHtml({
      kind: 'cast',
      name: castLabelName(cid) || p.authorLabel || 'Cast',
      preview: castPreviewSrc(cid),
    })
  }
  const ownerAddr = normalizeAddressClient(p.ownerAddress || '')
  if (ownerAddr) {
    const dn = p.ownerDisplayName || ownerDisplayName(ownerAddr, p.ownerName)
    return identityChipHtml({
      kind: 'owner',
      name: dn,
      button: true,
      dataAttrs: `data-owner-address="${escapeHtml(ownerAddr)}"`,
      title: `House · ${dn}`,
    })
  }
  return identityChipHtml({
    kind: 'guest',
    name: p.authorLabel || 'Guest',
  })
}

function loadImageForShare(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function shareBoardRankCard(
  r: { axieId: string; label: string; points: number; level?: number; rank: number; preview?: string },
  range: 'daily' | 'all',
): Promise<void> {
  const w = 720
  const h = 900
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    showLiveToast('Share unavailable', 1600)
    return
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#FFF6C2')
  grad.addColorStop(0.4, '#FFE566')
  grad.addColorStop(1, '#FFB84D')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // frame
  ctx.strokeStyle = '#F5A623'
  ctx.lineWidth = 10
  ctx.strokeRect(24, 24, w - 48, h - 48)

  ctx.fillStyle = '#1A1A1A'
  ctx.font = '800 42px Nunito, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Axie Idol', w / 2, 90)

  ctx.fillStyle = '#7A5A00'
  ctx.font = '700 28px Nunito, system-ui, sans-serif'
  const rangeLabel = range === 'all' ? 'All-time Quest Ladder' : 'Ladder'
  ctx.fillText(rangeLabel, w / 2, 130)

  const imgSrc = r.preview || previewFor(r.axieId) || axiePreviewSrc(r.axieId)
  const face = await loadImageForShare(imgSrc)
  const cx = w / 2
  const cy = 340
  const rad = 140
  ctx.beginPath()
  ctx.arc(cx, cy, rad + 8, 0, Math.PI * 2)
  ctx.fillStyle = r.rank === 1 ? '#FFD700' : '#FFFFFF'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, rad, 0, Math.PI * 2)
  ctx.closePath()
  ctx.save()
  ctx.clip()
  if (face) {
    ctx.drawImage(face, cx - rad, cy - rad, rad * 2, rad * 2)
  } else {
    ctx.fillStyle = '#E8F6FF'
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
  }
  ctx.restore()

  if (r.rank === 1) {
    ctx.font = '80px serif'
    ctx.fillText('TOP', cx, cy - rad - 20)
  }

  ctx.fillStyle = '#1A1A1A'
  ctx.font = '800 64px Nunito, system-ui, sans-serif'
  ctx.fillText(`#${r.rank}`, w / 2, 560)

  ctx.font = '800 36px Nunito, system-ui, sans-serif'
  const label = (r.label || castOrAxieLabel(r.axieId)).slice(0, 36)
  ctx.fillText(label, w / 2, 620)

  ctx.fillStyle = '#C45C00'
  ctx.font = '800 48px Nunito, system-ui, sans-serif'
  ctx.fillText(`Lv ${typeof r.level === 'number' ? r.level : r.points}`, w / 2, 690)

  ctx.fillStyle = '#7A5A00'
  ctx.font = '600 24px Nunito, system-ui, sans-serif'
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  ctx.fillText(dateStr, w / 2, 760)

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  )
  if (!blob) {
    showLiveToast('Could not build share card', 1800)
    return
  }
  const fileName = `axie-idol-${range}-rank-${r.rank}.png`
  const file = new File([blob], fileName, { type: 'image/png' })
  try {
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Axie Idol #${r.rank}`,
        text: `${label} is #${r.rank} on the ${rangeLabel} at Lv ${typeof r.level === 'number' ? r.level : r.points}!`,
      })
      showLiveToast('Shared!', 1400)
      return
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  showLiveToast('Rank card downloaded', 1600)
}

/** Show yellow spark-victory shell as cast-follow / prop unlock celebration. */
function showCastFollowVictory(castIds: string[]): void {
  const clean = castIds.filter((id) => CAST_MASCOTS.some((c) => c.id === id))
  if (!clean.length) return
  const primary = clean[0]!
  const more = clean.slice(1)
  showSparkVictory({
    kind: 'castFollow',
    castId: primary,
    moreUnlocked: more,
    axieId: primary,
    axieLabel: castLabelName(primary),
  })
}

function showPropUnlockVictory(propIds: string[]): void {
  const clean = propIds.filter((id) => EQUIPMENT_PROPS.some((p) => p.id === id))
  if (!clean.length) return
  const primary = clean[0]!
  const more = clean.slice(1)
  const label = propLabelName(primary)
  showSparkVictory({
    kind: 'propUnlock',
    castId: primary,
    moreUnlocked: more,
    axieId: primary,
    axieLabel: label,
  })
}

function queueCastUnlocks(ids: string[], propIds?: string[]): void {
  const casts = (ids || []).filter((id) => id !== 'golden' && CAST_MASCOTS.some((c) => c.id === id))
  const props = (propIds || []).filter((id) => EQUIPMENT_PROPS.some((p) => p.id === id))
  // Prefer celebrating cast faces; otherwise props
  if (casts.length) showCastFollowVictory(casts)
  else if (props.length) showPropUnlockVictory(props)
  // If both, celebrate cast first then prop shortly after
  if (casts.length && props.length) {
    window.setTimeout(() => showPropUnlockVictory(props), 3200)
  }
}


function applyQuestPayload(castCrew: CastCrewPayload | null | undefined, celebrate = true): void {
  if (!castCrew) return
  cacheCastCrew(castCrew)
  renderCastCrewStrip(castCrew)
  const newlyCast = (
    castCrew.newlyUnlockedCast ||
    (castCrew.newlyUnlocked || []).filter((id) => CAST_MASCOTS.some((c) => c.id === id))
  ).filter(Boolean)
  const newlyProps = (
    castCrew.newlyUnlockedProps ||
    (castCrew.newlyUnlocked || []).filter((id) => EQUIPMENT_PROPS.some((p) => p.id === id))
  ).filter(Boolean)
  if (celebrate && (newlyCast.length || newlyProps.length)) {
    queueCastUnlocks(newlyCast, newlyProps)
  }
}

function toastCastEngagement(engagement: CastCrewEngagement[] | undefined): void {
  if (!engagement?.length) return
  const like = engagement.find((e) => e.kind === 'like')
  const comment = engagement.find((e) => e.kind === 'comment')
  const pick = like || comment
  if (!pick) return
  const name = castLabelName(pick.castId)
  if (pick.kind === 'like') showLiveToast(`${name} liked your post`, 1800)
  else showLiveToast(`${name} commented on your post`, 1800)
}

function renderCastCrewStrip(payload: CastCrewPayload | null | undefined): void {
  if (!profileCastCrew || !profileCastCrewGrid) return
  const data = payload || myCastCrew || loadCachedCastCrew()
  if (!data) {
    profileCastCrew.hidden = true
    return
  }
  const unlocked = new Set(data.unlockedCast || data.unlocked || ['kotaro'])
  const unlockedProps = new Set(data.unlockedProps || [])
  profileCastCrew.hidden = false
  profileCastCrewGrid.innerHTML = CAST_ORDER.map((id) => {
    const c = CAST_MASCOTS.find((m) => m.id === id)
    if (!c) return ''
    const on = unlocked.has(id)
    const lvl = unlockLevelFor(id) ?? 0
    const src = castPreviewSrc(id)
    const isVillain = id === 'agonia-echo'
    const name = on ? escapeHtml(c.label) : isVillain ? '???' : escapeHtml(c.label)
    const title = `${escapeHtml(c.label)}${on ? '' : ` · level ${lvl}`}`
    return `<div class="crew-slot${on ? ' is-unlocked' : ' is-locked'}${isVillain ? ' is-villain' : ''}" role="listitem" title="${title}">
  <div class="crew-face"><img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.src='/previews/kotaro.png'" />${on ? '' : `<span class="crew-lvl">LV ${lvl}</span>`}</div>
  <span class="crew-slot-name">${name}</span>
</div>`
  }).join('')
  {
    const goldOn = unlocked.has('golden')
    profileCastCrewGrid.innerHTML += `<div class="crew-slot is-golden${goldOn ? ' is-unlocked' : ' is-locked'}" role="listitem" title="${goldOn ? 'Golden Axie' : 'Golden Axie · hidden in 1 of every ' + goldenOddsLabel() + ' Snaps'}">
  <div class="crew-face">${goldOn ? '<img src="/previews/golden.png" alt="" loading="lazy" />' : '<span class="crew-q">?</span>'}</div>
  <span class="crew-slot-name">${goldOn ? 'Golden Axie' : 'Golden?'}</span>
</div>`
    const seen = loadSeenShinies()
    profileCastCrewGrid.querySelectorAll<HTMLElement>('.crew-slot').forEach((slot) => {
      const nameEl = slot.querySelector('.crew-slot-name')
      const face = slot.querySelector('.crew-face')
      const id = CAST_ORDER.find((cid) => castLabelName(cid) === nameEl?.textContent) || ''
      if (id && seen.has(id) && face) face.insertAdjacentHTML('beforeend', `<span class="crew-shiny" title="Seen shiny">${icon('star', 12)}</span>`)
    })
  }
  if (profileCastCrewCount) profileCastCrewCount.textContent = `${unlocked.size - (unlocked.has('golden') ? 1 : 0)} of ${CAST_ORDER.length}`
  const propsEl = document.querySelector<HTMLElement>('#crew-props')
  const propsCount = document.querySelector<HTMLElement>('#crew-props-count')
  if (propsEl) {
    propsEl.innerHTML = EQUIPMENT_PROPS.map((p) => {
      const on = unlockedProps.has(p.id)
      const lvl = unlockLevelFor(p.id) ?? 0
      return `<span class="crew-prop${on ? ' is-unlocked' : ''}">${on ? icon('sword', 16) : icon('lock', 16)}${escapeHtml(p.label)}${on ? '' : ` · Lv ${lvl}`}</span>`
    }).join('')
  }
  if (propsCount) propsCount.textContent = `${unlockedProps.size} of ${EQUIPMENT_PROPS.length}`
  if (profileCastCrewHint) profileCastCrewHint.hidden = true
}

/** Rebuild Create trays from unlocked cast/props (hide locked). */
function renderCreateTrays(): void {
  const unlockedCast = new Set(
    myCastCrew?.unlockedCast || myCastCrew?.unlocked || ['kotaro'],
  )
  if (!unlockedCast.has('kotaro')) unlockedCast.add('kotaro')
  const unlockedProps = new Set(myCastCrew?.unlockedProps || [])

  // Cast tray: every face; locked ones greyed with the level that unlocks them
  const castHtml = CAST_MASCOTS.filter((c) => c.id !== 'golden' || unlockedCast.has('golden') || isDevMode()).map((c) => {
    const src = castPreviewSrc(c.id)
    const locked = !unlockedCast.has(c.id)
    const pressed = !locked && !customAxieId && activeCast === c.id
    const lvl = unlockLevelFor(c.id)
    const sub = locked && lvl != null ? `Lv ${lvl}` : escapeHtml(c.label)
    const title = `${escapeHtml(c.label)}${locked && lvl != null ? ` · unlocks at level ${lvl}` : ''}`
    return `<button type="button" class="cast-chip${locked ? ' is-locked' : ''}" data-cast="${c.id}" aria-pressed="${pressed ? 'true' : 'false'}" title="${title}">
  <img class="cast-thumb" src="${escapeHtml(src)}" alt="" draggable="false" onerror="this.src='/previews/kotaro.png'" />
  ${locked ? `<span class="cast-lock">${icon('lock', 18)}</span>` : ''}
  <span class="cast-name">${sub}</span>
</button>`
  }).join('')
  castTray.innerHTML = castHtml || ''

  // Prop tray: only unlocked props (none free at launch)
  const propHtml = (EQUIPMENT_PROPS as readonly { id: PropId; file: string; label: string; short?: string }[]).filter((p) => unlockedProps.has(p.id))
    .map((p) => {
      const on = equippedProp === p.id
      return `<button type="button" class="prop-chip" data-prop="${p.id}" aria-pressed="${on ? 'true' : 'false'}" title="${escapeHtml(p.label)}">
  <span class="prop-ico" aria-hidden="true">${icon('sword', 16)}</span>
  <span class="prop-name">${escapeHtml(p.short || p.label)}</span>
</button>`
    })
    .join('')
  propTray.innerHTML = propHtml
  propTray.hidden = unlockedProps.size === 0
  syncCastTrayUI()
  syncPropTrayUI()
  syncCameraTrays()
}

async function refreshMyCastCrew(): Promise<void> {
  const params = new URLSearchParams()
  if (roninAddress) params.set('address', roninAddress)
  else if (guestId) params.set('guestId', guestId)
  else return
  try {
    const res = await fetch(`/api/cast-crew?${params}`, {
      headers: { 'X-Device-Key': deviceKey },
    })
    if (!res.ok) return
    const data = (await res.json()) as CastCrewPayload
    cacheCastCrew(data)
    renderCastCrewStrip(data)
  } catch {
    /* ignore */
  }
}

const sparkVictoryNext = document.querySelector<HTMLElement>('#spark-victory-next')
const sparkVictoryNextText = document.querySelector<HTMLElement>('#spark-victory-next-text')

function fillSparkVictoryNext(): void {
  const p = questHudInput()
  if (sparkVictoryNext && sparkVictoryNextText && p && p.nextQuest) {
    sparkVictoryNextText.textContent = questChipText(p)
    sparkVictoryNext.hidden = false
  } else if (sparkVictoryNext) {
    sparkVictoryNext.hidden = true
  }
}

function showSparkVictory(opts: SparkVictoryOpts): void {
  if (!sparkVictory) return
  const kind = opts.kind || 'spark'

  if (kind === 'follow' || kind === 'like' || kind === 'comment') {
    const axieId = String(opts.axieId || '').trim()
    const axieLabel = (opts.axieLabel || '').trim() || castOrAxieLabel(axieId) || 'your Axie'
    const from = (opts.fromLabel || 'Someone').trim()
    sparkVictory.classList.add('is-cast-follow', 'is-social')
    if (sparkVictoryKicker) {
      sparkVictoryKicker.textContent =
        kind === 'follow' ? 'NEW FOLLOWER' : kind === 'like' ? 'NEW LIKE' : 'NEW COMMENT'
    }
    if (sparkVictoryAvatar) {
      const src = axiePreviewSrc(axieId)
      sparkVictoryAvatar.src = src
      sparkVictoryAvatar.alt = axieLabel
      sparkVictoryAvatar.hidden = !src
    }
    if (sparkVictoryAmount) {
      sparkVictoryAmount.textContent = ''
      sparkVictoryAmount.hidden = true
    }
    if (sparkVictoryTitle) {
      sparkVictoryTitle.textContent =
        kind === 'follow'
          ? `${from} followed ${axieLabel}!`
          : kind === 'like'
            ? `${from} liked your post!`
            : `${from} commented!`
    }
    if (sparkVictoryBody) {
      const snippet =
        kind === 'comment' && opts.text
          ? ` “${escapeHtml(opts.text.slice(0, 80))}”`
          : ''
      sparkVictoryBody.innerHTML =
        kind === 'follow'
          ? `<strong>${escapeHtml(from)}</strong> just followed your <strong>${escapeHtml(axieLabel)}</strong>. Your Axie is climbing!`
          : kind === 'like'
            ? `<strong>${escapeHtml(from)}</strong> liked your <strong>${escapeHtml(axieLabel)}</strong> post.`
            : `<strong>${escapeHtml(from)}</strong> on your <strong>${escapeHtml(axieLabel)}</strong> post.${snippet}`
    }
    if (sparkVictorySub) {
      sparkVictorySub.textContent = 'Keep posting — Idol love stacks up.'
    }
    if (sparkVictoryDemo) sparkVictoryDemo.hidden = true
    sparkVictory.hidden = false
    startSparkConfetti(2800, sparkVictoryConfetti)
    window.setTimeout(() => btnSparkVictoryOk?.focus(), 60)
    return
  }

  if (kind === 'propUnlock') {
    const propId = String(opts.castId || opts.axieId || '').trim()
    const label = (opts.axieLabel || '').trim() || propLabelName(propId) || 'Prop'
    const more = (opts.moreUnlocked || []).filter(Boolean)
    pendingCastFollowSave = false
    sparkVictory.classList.add('is-cast-follow')
    if (sparkVictoryKicker) sparkVictoryKicker.textContent = 'PROP UNLOCKED'
    if (sparkVictoryAvatar) {
      sparkVictoryAvatar.src = '/previews/kotaro.png'
      sparkVictoryAvatar.alt = label
      sparkVictoryAvatar.hidden = false
    }
    if (sparkVictoryAmount) {
      sparkVictoryAmount.textContent = ''
      sparkVictoryAmount.hidden = true
    }
    if (sparkVictoryTitle) sparkVictoryTitle.textContent = `You unlocked ${label}!`
    if (sparkVictoryBody) {
      const extra =
        more.length === 1
          ? ` Also unlocked ${propLabelName(more[0]!)}.`
          : more.length > 1
            ? ` Plus ${more.length} more props.`
            : ''
      sparkVictoryBody.innerHTML =
        `Quest reward! <strong>${escapeHtml(label)}</strong> is ready in your Create tray.${extra}`
    }
    if (sparkVictorySub) sparkVictorySub.textContent = ''
    fillSparkVictoryNext()
    if (btnSparkVictoryOk) {
      btnSparkVictoryOk.textContent = 'Equip it on Snap'
      btnSparkVictoryOk.dataset.equipProp = propId
    }
    if (sparkVictoryDemo) sparkVictoryDemo.hidden = true
    sparkVictory.hidden = false
    startSparkConfetti(2800, sparkVictoryConfetti)
    window.setTimeout(() => btnSparkVictoryOk?.focus(), 60)
    return
  }

  if (kind === 'castFollow') {
    const castId = String(opts.castId || opts.axieId || '').trim()
    const label = (opts.axieLabel || '').trim() || castLabelName(castId) || 'Cast'
    const more = (opts.moreUnlocked || []).filter(Boolean)
    const guestNeedsSave = !roninAddress
    pendingCastFollowSave = guestNeedsSave
    sparkVictory.classList.add('is-cast-follow')
    if (sparkVictoryKicker) sparkVictoryKicker.textContent = `LEVEL ${myCastCrew?.level ?? ''} REACHED`.replace(/\s+/g, ' ').trim()
    if (sparkVictoryAvatar) {
      const src = castPreviewSrc(castId)
      sparkVictoryAvatar.src = src
      sparkVictoryAvatar.alt = label
      sparkVictoryAvatar.hidden = !src
    }
    if (sparkVictoryAmount) {
      sparkVictoryAmount.textContent = ''
      sparkVictoryAmount.hidden = true
    }
    if (sparkVictoryTitle) sparkVictoryTitle.textContent = `${label} joined your crew`
    if (sparkVictoryBody) {
      const extra =
        more.length === 1
          ? ` ${castLabelName(more[0]!)} joined too.`
          : more.length > 1
            ? ` Plus ${more.length} more cast mates.`
            : ''
      sparkVictoryBody.innerHTML =
        `<strong>${escapeHtml(label)}</strong> follows you now and will show up in your comments.${extra} ` +
        `Take ${escapeHtml(label)} out for a photo whenever you like.`
    }
    if (sparkVictorySub) {
      sparkVictorySub.textContent = guestNeedsSave
        ? 'Connect Ronin on the Crew tab to keep your crew across devices.'
        : ''
    }
    fillSparkVictoryNext()
    pendingCastFollowSave = false
    if (btnSparkVictoryOk) {
      btnSparkVictoryOk.textContent = `Snap with ${label}`
      btnSparkVictoryOk.dataset.snapCast = castId
    }
    if (sparkVictoryDemo) sparkVictoryDemo.hidden = true
    sparkVictory.hidden = false
    startSparkConfetti(2800, sparkVictoryConfetti)
    window.setTimeout(() => btnSparkVictoryOk?.focus(), 60)
    return
  }

  // SLP spark prestige (only when burns UI enabled)
  const amount = Math.max(0, Math.floor(Number(opts.amount) || 0))
  if (amount <= 0) return
  const axieId = String(opts.axieId || '').trim()
  const labelRaw = (opts.axieLabel || '').trim()
  const axieName =
    labelRaw ||
    (axieId ? castOrAxieLabel(axieId) : 'Your Axie')
  const who =
    axieId && !axieName.includes(`#${axieId}`)
      ? `${axieName} (#${axieId})`
      : axieName

  sparkVictory.classList.remove('is-cast-follow')
  if (sparkVictoryKicker) sparkVictoryKicker.textContent = 'SLP SPARK'
  if (sparkVictoryAvatar) {
    sparkVictoryAvatar.hidden = true
    sparkVictoryAvatar.removeAttribute('src')
  }
  if (sparkVictoryAmount) {
    sparkVictoryAmount.hidden = false
    sparkVictoryAmount.textContent = `${formatSlp(amount)} $SLP`
  }
  if (sparkVictoryTitle) sparkVictoryTitle.textContent = 'Prestige!'
  if (sparkVictoryBody) {
    sparkVictoryBody.innerHTML =
      `Thanks for posting. You just burned <strong>${formatSlp(amount)} $SLP</strong> and earned prestige. ` +
      `${who} is climbing the social ladder.`
  }
  if (sparkVictorySub) {
    sparkVictorySub.innerHTML =
      'Likes and comments climb the ladder.'
  }
  const mode = (opts.mode || burnsToday?.mode || '').toLowerCase()
  const modeLabel = opts.modeLabel || burnsToday?.modeLabel || ''
  const isDemo = mode === 'ledger' || /demo|ledger/i.test(modeLabel)
  if (sparkVictoryDemo) {
    if (isDemo) {
      sparkVictoryDemo.textContent = modeLabel || 'Demo burn (ledger)'
      sparkVictoryDemo.hidden = false
    } else {
      sparkVictoryDemo.hidden = true
    }
  }

  sparkVictory.hidden = false
  startSparkConfetti(2600, sparkVictoryConfetti)
  window.setTimeout(() => btnSparkVictoryOk?.focus(), 60)
}


async function submitFanBoost(amount: number): Promise<void> {
  if (!roninAddress) {
    void connectRonin()
    return
  }
  const axieId = boostTargetAxieId || timelineAxieId
  if (!axieId || !/^\d+$/.test(axieId)) {
    showLiveToast('Pick a numeric Axie to boost', 2000)
    return
  }
  const amt = Math.floor(Number(amount))
  if (!Number.isFinite(amt) || amt < 1 || amt > 10000) {
    showLiveToast('Amount must be 1–10000', 2000)
    return
  }
  if (btnBoostConfirm) btnBoostConfirm.disabled = true
  try {
    const res = await fetch('/api/burns/boost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ address: roninAddress, axieId, amount: amt }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      burns?: BurnsToday
      burn?: { amount: number; axieId: string }
      modeLabel?: string
    }
    if (!res.ok) throw new Error(data.error || `Boost failed (${res.status})`)
    applyBurnsPayload(data.burns)
    closeBoostSheet()
    showLiveToast(
      `🔥 ${amt} SLP demo-burned for #${axieId} (ledger)`,
      2800,
    )
    await refreshFeed()
  } catch (err) {
    console.warn('[axie-idol] boost failed', err)
    showLiveToast(err instanceof Error ? err.message : 'Boost failed', 2800)
  } finally {
    if (btnBoostConfirm) btnBoostConfirm.disabled = false
  }
}

function renderScores(axieScores: Record<string, number>): void {
  const scores = axieScores || {}
  let entries: [string, number][] = Object.entries(scores)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
  // Timeline: always surface this Axie's score (even 0)
  if (feedMode === 'axie' && timelineAxieId) {
    const tid = timelineAxieId
    if (!entries.some(([id]) => id === tid)) {
      const row: [string, number] = [tid, scores[tid] || 0]
      entries = [row, ...entries].slice(0, 7)
    }
  }
  const todayLabel = `<span class="score-today-label" title="Cast activity today (Asia/Manila)">Today</span>`
  if (!entries.length) {
    feedScores.innerHTML = todayLabel
    return
  }
  feedScores.innerHTML =
    todayLabel +
    entries
      .map(([id, n]) => {
        const label = escapeHtml(castLabelFor(id))
        const active = feedMode === 'axie' && timelineAxieId === id ? ' is-active' : ''
        return `<button type="button" class="score-chip${active}" data-axie-id="${escapeHtml(id)}" title="${label} timeline · today"><span>${label}</span><strong>${n}</strong></button>`
      })
      .join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderCommentsHtml(comments: FeedComment[] | undefined): string {
  const list = Array.isArray(comments) ? comments : []
  const items = list
    .map((c) => {
      const isCast = Boolean(c.cast || (c.castId && CAST_MASCOTS.some((m) => m.id === c.castId)))
      const castId = c.castId || (c.authorGuestId || '').replace(/^cast:/, '')
      const who = escapeHtml(
        isCast ? castLabelName(castId) || c.authorLabel || 'Cast' : c.authorLabel || 'Guest',
      )
      const body = escapeHtml(c.text || '')
      if (isCast) {
        const thumb = escapeHtml(castPreviewSrc(castId))
        return `<li class="feed-comment is-cast" data-comment-id="${escapeHtml(c.id)}" data-cast-id="${escapeHtml(castId)}"><img class="feed-comment-cast-thumb" src="${thumb}" alt="" loading="lazy" /><span class="feed-comment-author">${who}<span class="feed-comment-cast-badge">Cast</span></span>: <span class="feed-comment-text">${body}</span></li>`
      }
      return `<li class="feed-comment" data-comment-id="${escapeHtml(c.id)}"><span class="feed-comment-author id-chip is-guest"><span class="id-chip-name">${who}</span></span>: <span class="feed-comment-text">${body}</span></li>`
    })
    .join('')
  return `<ul class="feed-comments" data-comments-for="">${items}</ul>`
}

function renderFeed(posts: FeedPost[]): void {
  feedError.hidden = true
  if (!posts.length) {
    feedList.innerHTML = ''
    feedEmpty.hidden = false
    if (feedMode === 'axie' && timelineAxieId) {
      feedEmpty.textContent = `No posts yet for ${castLabelFor(timelineAxieId)} — capture & Post!`
    } else if (feedMode === 'following') {
      feedEmpty.innerHTML =
        'Nothing from costumes you follow yet. Try a <button type="button" class="feed-empty-link" data-go="board">free-cast on the Board</button> or Follow from a timeline.'
    } else {
      feedEmpty.textContent = 'No posts yet — capture a cast moment and Post!'
    }
    return
  }
  feedEmpty.hidden = true
  feedList.innerHTML = posts
    .map((p) => {
      const liked = likedPosts.has(p.id)
      const cap = escapeHtml(p.caption || '')
      const axieChip = axieIdentityChip(p.axieId, p.axieLabel || p.axieId, true)
      const authorChip = authorIdentityChip(p)
      const commentsHtml = renderCommentsHtml(p.comments).replace(
        'data-comments-for=""',
        `data-comments-for="${escapeHtml(p.id)}"`,
      )
      const burnsHtml = burnChipsHtml(p.axieId)
      const seedMark = p.seed ? ' data-seed="1"' : ''
      const commentCount = (p.comments || []).length
      const followLabel = castLabelFor(p.axieId)
      const shinyTag = p.shiny?.length ? `<span class="shiny-tag">${icon('star', 12)}Shiny ${escapeHtml(p.shiny.map((id) => castLabelFor(id)).join(', '))}</span>` : ''
      return `<article class="feed-card${p.golden ? ' is-golden' : ''}" data-post-id="${p.id}"${seedMark}>
  <div class="feed-card-img-wrap">
    <img class="feed-card-img" src="${escapeHtml(p.imagePath)}" alt="${escapeHtml(p.axieLabel || p.axieId)} post" loading="lazy" />
    <div class="feed-chip-tl">${axieChip}</div>
    <div class="feed-chip-tr">by ${authorChip}</div>
  </div>
  <div class="feed-card-body">
    ${cap ? `<p class="feed-caption">${cap}</p>` : ''}
    <div class="feed-like-row">
      <button type="button" class="btn like-btn${liked ? ' is-liked' : ''}" data-post-id="${p.id}" aria-pressed="${liked ? 'true' : 'false'}" aria-label="Like">${icon(liked ? 'heartFilled' : 'heart', 18)}<span class="like-count" data-like-count="${p.id}">${p.likes || 0}</span></button>
      <span class="btn comment-count" aria-label="Comments">${icon('comment', 18)}<span>${commentCount}</span></span>
      ${shinyTag}
      <span class="feed-spacer"></span>
      <button type="button" class="btn follow-chip" data-follow-axie="${escapeHtml(p.axieId)}">Follow ${escapeHtml(followLabel)}</button>
    </div>
    ${burnsHtml}
    ${commentsHtml}
    <form class="comment-form" data-post-id="${p.id}">
      <input type="text" class="comment-input" name="text" maxlength="140" placeholder="Add a comment…" autocomplete="off" enterkeyhint="send" />
      <button type="submit" class="btn comment-submit">Comment</button>
    </form>
  </div>
</article>`
    })
    .join('')
}


type BoardRank = {
  axieId: string
  label: string
  /** Quest level 0–24 (primary board score). */
  level?: number
  /** Back-compat alias of level for older share/render paths. */
  points: number
  rank: number
  preview?: string
  previewCastId?: string
  posterKey?: string
  address?: string | null
  guestId?: string | null
  followerCount?: number
  owner?: { address: string; displayName?: string } | null
  nextQuest?: {
    level: number
    description: string
    progress: number
    target: number
    unlockLabel?: string
  } | null
}

function boardLevelOf(r: BoardRank): number {
  if (typeof r.level === 'number' && Number.isFinite(r.level)) return r.level
  return Number(r.points) || 0
}

function boardLevelLabel(r: BoardRank): string {
  return `Lv ${boardLevelOf(r)}`
}

let lastBoardRankings: BoardRank[] = []

function stopBoardCountdown(): void {
  if (boardCountdownTimer != null) {
    window.clearInterval(boardCountdownTimer)
    boardCountdownTimer = null
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'resetting…'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

function updateBoardCountdown(): void {
  if (boardRange === 'all') {
    boardMeta.textContent = 'All-time Quest Level'
    return
  }
  if (!boardResetsAt) {
    boardMeta.textContent = 'Resets midnight PH'
    return
  }
  const ms = new Date(boardResetsAt).getTime() - Date.now()
  boardMeta.textContent = `Resets midnight PH · ${formatCountdown(ms)}`
  if (ms <= 0) {
    void refreshBoard()
  }
}

function startBoardCountdown(): void {
  stopBoardCountdown()
  updateBoardCountdown()
  boardCountdownTimer = window.setInterval(updateBoardCountdown, 1000)
}

function previewFor(axieId: string): string {
  return CAST_MASCOTS.find((c) => c.id === axieId)?.preview
    ? `/previews/${CAST_MASCOTS.find((c) => c.id === axieId)!.preview}`
    : ''
}

function syncBoardRangeTabs(): void {
  boardRangeTabs.querySelectorAll<HTMLButtonElement>('.board-range-tab').forEach((btn) => {
    const active = btn.dataset.range === boardRange
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  if (boardTitle) {
    boardTitle.textContent = boardRange === 'all' ? 'All-time Quest Ladder' : 'Ladder'
  }
}

function renderBoard(
  rankings: BoardRank[],
  dayKey: string,
  resetsAt: string | null | undefined,
  range: 'daily' | 'all' = 'daily',
): void {
  boardError.hidden = true
  boardRange = range
  lastBoardRankings = rankings.slice()
  syncBoardRangeTabs()
  const top = rankings.slice(0, 3)
  const order = [1, 0, 2] // visual: 2nd, 1st, 3rd
  boardPodium.innerHTML = order
    .map((i) => {
      const r = top[i]
      if (!r) return ''
      const place = r.rank
      const tag = place === 1 ? '<span class="board-top-tag">Top climber</span>' : ''
      const img = escapeHtml(r.preview || previewFor(r.axieId))
      return `<div class="board-podium-card place-${place}${place === 1 ? ' is-crown' : ''}" data-axie-id="${escapeHtml(r.axieId)}" data-poster-key="${escapeHtml(r.posterKey || '')}"${
        r.owner?.address ? ` data-owner-address="${escapeHtml(r.owner.address)}"` : ''
      }>
  <button type="button" class="board-podium-main" data-axie-id="${escapeHtml(r.axieId)}" title="${escapeHtml(r.label)}">
    ${tag}
    <img class="board-avatar" src="${img}" alt="" loading="lazy" />
    <span class="board-name">${escapeHtml(r.label)}</span>
    <span class="board-step"><span class="board-place">#${place}</span><strong class="board-points">${boardLevelLabel(r)}</strong></span>
  </button>
  <button type="button" class="btn board-share-btn board-share-podium" data-share-rank="${place}" data-axie-id="${escapeHtml(r.axieId)}" data-poster-key="${escapeHtml(r.posterKey || '')}" title="Share rank card">Share</button>
</div>`
    })
    .join('')

  boardList.innerHTML = rankings
    .map((r) => {
      const img = escapeHtml(r.preview || previewFor(r.axieId))
      const fc = typeof r.followerCount === 'number' ? r.followerCount : null
      const follows =
        fc == null ? '' : `<span class="board-row-follows">${fc} foll</span>`
      const burns = burnChipsHtml(r.axieId, { compact: true })
      const crown = r.rank === 1 ? ' is-crown' : ''
      const isPlayerRow = Boolean(r.posterKey || r.address || r.guestId)
      const playerChip = isPlayerRow
        ? identityChipHtml({
            kind: r.owner?.address ? 'owner' : 'guest',
            name: r.label,
            button: Boolean(r.owner?.address),
            dataAttrs: r.owner?.address
              ? `data-owner-address="${escapeHtml(r.owner.address)}"`
              : '',
            preview: r.preview || previewFor(r.axieId),
          })
        : CAST_MASCOTS.some((c) => c.id === r.axieId)
          ? identityChipHtml({
              kind: 'cast',
              name: r.label,
              preview: r.preview || previewFor(r.axieId),
            })
          : identityChipHtml({
              kind: 'axie',
              name: r.label.includes('#')
                ? r.label
                : `${r.label}${/^\d+$/.test(r.axieId) ? ' #' + r.axieId : ''}`,
              preview: r.preview || previewFor(r.axieId) || `/api/image/${r.axieId}`,
            })
      const nextBlurb =
        r.nextQuest && r.nextQuest.description
          ? `<span class="board-row-follows" title="${escapeHtml(r.nextQuest.description)}">next: ${escapeHtml(
              r.nextQuest.description.length > 28
                ? r.nextQuest.description.slice(0, 28) + '…'
                : r.nextQuest.description,
            )}</span>`
          : follows
      return `<div class="board-row${crown}" role="listitem" data-axie-id="${escapeHtml(r.axieId)}" data-poster-key="${escapeHtml(r.posterKey || '')}"${
        r.owner?.address ? ` data-owner-address="${escapeHtml(r.owner.address)}"` : ''
      }>
  <button type="button" class="board-row-main" data-axie-id="${escapeHtml(r.axieId)}" title="${escapeHtml(r.label)}">
    <span class="board-rank">#${r.rank}</span>
    <img class="board-row-avatar" src="${img}" alt="" loading="lazy" />
    <span class="board-row-identity">${playerChip}</span>
    ${nextBlurb}
    <strong class="board-row-points board-lvl-pill">${boardLevelLabel(r)}</strong>
    ${burns ? `<span class="board-row-burns">${burns}</span>` : ''}
  </button>
  <button type="button" class="btn board-share-btn" data-share-rank="${r.rank}" data-axie-id="${escapeHtml(r.axieId)}" data-poster-key="${escapeHtml(r.posterKey || '')}" title="Share rank card">Share</button>
</div>`
    })
    .join('')

  boardMeta.dataset.dayKey = dayKey
  if (range === 'all') {
    boardResetsAt = null
    stopBoardCountdown()
    boardMeta.textContent = 'All-time Quest Level'
  } else {
    boardResetsAt = resetsAt || null
    startBoardCountdown()
  }
  updateBoardBurnMeta()
}

async function refreshBoard(): Promise<void> {
  if (boardLoading) return
  boardLoading = true
  boardError.hidden = true
  try {
    const qs = boardRange === 'all' ? '?range=all' : '?range=daily'
    const res = await fetch(`/api/board${qs}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`board ${res.status}`)
    const data = (await res.json()) as {
      range?: string
      dayKey: string
      timezone: string
      resetsAt?: string | null
      rankings: BoardRank[]
      burns?: BurnsToday
    }
    applyBurnsPayload(data.burns)
    applyGoldenSummary((data as { golden?: GoldenSummary }).golden)
    const range: 'daily' | 'all' =
      data.range === 'all' || boardRange === 'all' ? 'all' : 'daily'
    renderBoard(data.rankings || [], data.dayKey, data.resetsAt ?? null, range)
  } catch (err) {
    console.warn('[axie-idol] board load failed', err)
    boardError.hidden = false
    boardError.textContent = 'Could not load Quest Ladder — try again.'
  } finally {
    boardLoading = false
  }
}

async function showBoard(): Promise<void> {
  if (legacyScreensBlocked()) return
  hideAllScreens()
  setActiveTab('ladder')
  boardScreen.hidden = false
  boardScreen.classList.add('active')
  await refreshBoard()
}


function stopFeedAutoRefresh(): void {
  if (feedAutoRefreshTimer != null) {
    window.clearInterval(feedAutoRefreshTimer)
    feedAutoRefreshTimer = null
  }
}

/** Quiet 25s poll while Global / Following feed is on screen. */
function syncFeedAutoRefresh(): void {
  stopFeedAutoRefresh()
  if (!FEED_AUTO_REFRESH_ENABLED) return
  const onFeed = Boolean(feedScreen && !feedScreen.hidden)
  if (!onFeed) return
  if (feedMode !== 'global' && feedMode !== 'following') return
  feedAutoRefreshTimer = window.setInterval(() => {
    if (feedScreen.hidden) {
      stopFeedAutoRefresh()
      return
    }
    if (feedMode !== 'global' && feedMode !== 'following') {
      stopFeedAutoRefresh()
      return
    }
    void refreshFeed()
  }, FEED_AUTO_REFRESH_MS)
}

async function refreshFeed(): Promise<void> {
  if (feedLoading) return
  feedLoading = true
  feedError.hidden = true
  try {
    const params = new URLSearchParams()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (feedMode === 'axie' && timelineAxieId) {
      params.set('axieId', timelineAxieId)
    } else if (feedMode === 'following' && roninAddress) {
      params.set('following', '1')
      params.set('address', roninAddress)
    } else if (feedMode === 'global') {
      // Warm chronological personalization (guests + connected)
      if (roninAddress) params.set('address', roninAddress)
      if (deviceKey) {
        params.set('deviceKey', deviceKey)
        headers['X-Device-Key'] = deviceKey
      }
      if (guestId) {
        params.set('authorGuestId', guestId)
        params.set('guestId', guestId)
      }
    }
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`/api/feed${qs}`, { headers })
    if (!res.ok) throw new Error(`feed ${res.status}`)
    const data = (await res.json()) as {
      posts: FeedPost[]
      axieScores?: Record<string, number>
      dailyAxieScores?: Record<string, number>
      followerCount?: number
      follows?: string[]
      owner?: TimelineOwner | null
      burns?: BurnsToday
    }
    applyBurnsPayload(data.burns)
    if (typeof data.followerCount === 'number') {
      timelineFollowerCount = data.followerCount
    }
    if (feedMode === 'axie' && timelineAxieId && /^\d+$/.test(timelineAxieId)) {
      const o = data.owner
      if (o && o.address) {
        const addr = normalizeAddressClient(o.address)
        timelineOwner = addr
          ? {
              address: addr,
              name: sanitizeOwnerNameClient(o.name || ''),
              displayName: o.displayName || ownerDisplayName(addr, o.name),
            }
          : null
        if (timelineOwner?.name) stashOwnerName(timelineOwner.address, timelineOwner.name)
      } else {
        timelineOwner = null
      }
    } else {
      timelineOwner = null
    }
    if (Array.isArray(data.follows)) {
      followedAxieIds = new Set(data.follows.map(String))
    }
    renderScores(data.dailyAxieScores || data.axieScores || {})
    applyGoldenSummary((data as { golden?: GoldenSummary }).golden)
    renderFeed(data.posts || [])
    updateFeedChrome()
  } catch (err) {
    console.warn('[axie-idol] feed load failed', err)
    feedError.hidden = false
    feedError.textContent = 'Could not load feed — try again.'
  } finally {
    feedLoading = false
  }
}

function paintLike(btn: HTMLButtonElement, liked: boolean): void {
  const html = icon(liked ? 'heartFilled' : 'heart', 18)
  const svg = btn.querySelector('svg')
  if (svg) svg.outerHTML = html
  else btn.insertAdjacentHTML('afterbegin', html)
}

async function toggleLike(postId: string, btn: HTMLButtonElement): Promise<void> {
  const wasLiked = likedPosts.has(postId)
  const countEl =
    btn.closest('.feed-card')?.querySelector<HTMLElement>(`[data-like-count="${postId}"]`) ||
    feedList.querySelector<HTMLElement>(`[data-like-count="${postId}"]`)
  const prevCount = Number(countEl?.textContent || '0') || 0

  // Optimistic
  if (wasLiked) {
    likedPosts.delete(postId)
    btn.classList.remove('is-liked')
    btn.setAttribute('aria-pressed', 'false')
    paintLike(btn, false)
    if (countEl) countEl.textContent = String(Math.max(0, prevCount - 1))
  } else {
    likedPosts.add(postId)
    btn.classList.add('is-liked')
    btn.setAttribute('aria-pressed', 'true')
    paintLike(btn, true)
    if (countEl) countEl.textContent = String(prevCount + 1)
  }
  saveLikedSet(likedPosts)

  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey,
      },
      body: JSON.stringify({
        deviceKey,
        unlike: wasLiked,
        authorLabel,
        authorGuestId: guestId,
        address: roninAddress || undefined,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      post?: FeedPost
      liked?: boolean
      axieScores?: Record<string, number>
      dailyAxieScores?: Record<string, number>
      castCrew?: CastCrewPayload
    }
    if (!res.ok) {
      throw new Error(data.error || `like ${res.status}`)
    }
    applyQuestPayload(data.castCrew)
    if (data.post && countEl) countEl.textContent = String(data.post.likes || 0)
    const likeScores = data.dailyAxieScores || data.axieScores
    if (likeScores) renderScores(likeScores)
    if ((data as { burns?: BurnsToday }).burns) {
      applyBurnsPayload((data as { burns?: BurnsToday }).burns)
      // Re-paint burn chips without full reload
      const cards = feedList.querySelectorAll<HTMLElement>('.feed-card')
      cards.forEach((card) => {
        const axieBtn = card.querySelector<HTMLElement>('.feed-axie')
        const id = axieBtn?.dataset?.axieId
        if (!id) return
        let wrap = card.querySelector<HTMLElement>('.feed-card-burns')
        const html = burnChipsHtml(id)
        if (!html) {
          wrap?.remove()
          return
        }
        if (wrap) wrap.outerHTML = html
        else {
          const top = card.querySelector('.feed-card-top')
          if (top) top.insertAdjacentHTML('beforeend', html)
        }
      })
      updateTimelineBurnMeter()
    }
    const liked = Boolean(data.liked)
    if (liked) likedPosts.add(postId)
    else likedPosts.delete(postId)
    saveLikedSet(likedPosts)
    btn.classList.toggle('is-liked', liked)
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false')
    paintLike(btn, liked)
  } catch (err) {
    console.warn('[axie-idol] like failed', err)
    // Revert optimistic
    if (wasLiked) {
      likedPosts.add(postId)
      btn.classList.add('is-liked')
      btn.setAttribute('aria-pressed', 'true')
      paintLike(btn, true)
      if (countEl) countEl.textContent = String(prevCount)
    } else {
      likedPosts.delete(postId)
      btn.classList.remove('is-liked')
      btn.setAttribute('aria-pressed', 'false')
      paintLike(btn, false)
      if (countEl) countEl.textContent = String(prevCount)
    }
    saveLikedSet(likedPosts)
    showLiveToast(err instanceof Error ? err.message : 'Like failed', 2200)
  }
}

async function submitComment(form: HTMLFormElement): Promise<void> {
  const postId = form.dataset.postId
  if (!postId) return
  const input = form.querySelector<HTMLInputElement>('.comment-input')
  const btn = form.querySelector<HTMLButtonElement>('.comment-submit')
  const text = (input?.value || '').trim().slice(0, 140)
  if (!text) {
    showLiveToast('Write a short comment first', 1600)
    return
  }
  if (btn) btn.disabled = true
  if (input) input.disabled = true
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey,
      },
      body: JSON.stringify({
        text,
        authorGuestId: guestId,
        authorLabel,
        address: roninAddress || undefined,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      comment?: FeedComment
      post?: FeedPost
      axieScores?: Record<string, number>
      dailyAxieScores?: Record<string, number>
      castCrew?: CastCrewPayload
    }
    if (!res.ok) {
      throw new Error(data.error || `comment ${res.status}`)
    }
    applyQuestPayload(data.castCrew)
    const comment = data.comment
    if (comment) {
      const card = form.closest('.feed-card')
      const list = card?.querySelector<HTMLElement>('.feed-comments')
      if (list) {
        const li = document.createElement('li')
        li.className = 'feed-comment'
        li.dataset.commentId = comment.id
        const authorSpan = document.createElement('span')
        authorSpan.className = 'feed-comment-author'
        authorSpan.textContent = comment.authorLabel || 'Guest'
        const textSpan = document.createElement('span')
        textSpan.className = 'feed-comment-text'
        textSpan.textContent = comment.text || ''
        li.append(authorSpan, document.createTextNode(': '), textSpan)
        list.appendChild(li)
      }
    }
    const commentScores = data.dailyAxieScores || data.axieScores
    if (commentScores) renderScores(commentScores)
    if ((data as { burns?: BurnsToday }).burns) {
      applyBurnsPayload((data as { burns?: BurnsToday }).burns)
      updateTimelineBurnMeter()
    }
    if (input) input.value = ''
  } catch (err) {
    console.warn('[axie-idol] comment failed', err)
    showLiveToast(err instanceof Error ? err.message : 'Comment failed', 2200)
  } finally {
    if (btn) btn.disabled = false
    if (input) {
      input.disabled = false
      input.focus()
    }
  }
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
    if (buddyEnabled && plainCapture && buddyState.active?.hatchedAt && currentCaption() !== lookedCaption) {
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

    // Owned Axie (connected + selected from inventory / numeric costume)
    const postingOwned =
      Boolean(customAxieId && roninAddress && /^\d+$/.test(customAxieId))
    // Dev-only non-owned Axie ID sticker still maps to active free cast
    const postAxieId = postingOwned
      ? customAxieId!
      : activeCast
    const axieLabel = postingOwned
      ? ownedAuthorLabel?.replace(/\s#\d+$/, '') || `Axie #${customAxieId}`
      : castMeta(postAxieId)?.label || postAxieId
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
    {
      const shinyIds = [...groupPhoto.shinyIds()]
      // 'buddy'/'egg' are not costume ids — the server drops them, so never send them.
      if (leadShiny && !customAxieId && castMeta(activeCast)) shinyIds.unshift(activeCast)
      if (shinyIds.length) body.shiny = shinyIds
    }
    if (postingOwned) {
      body.ownerAddress = roninAddress
    }
    if (roninAddress) {
      body.address = roninAddress
    }

    // One-Axie loop: this snap is also egg progress / bond. `labels` stays empty until a
    // captioner exists; location comes from snapContext(), which never blocks the shutter.
    // An owned buddy posts under its real Axie id so spark and ownership attribution land;
    // a wild one posts under 'kotaro', the server's neutral cast id ('buddy'/'egg' would
    // fail the cast lock).
    let buddyOwnedPost = false
    if (buddyEnabled) {
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
      post?: FeedPost
      sparkBurn?: { axieId: string; amount: number; mode?: string }
      burns?: BurnsToday
      castCrew?: CastCrewPayload
      buddy?: SnapResult | null
    }
    const sendPost = async (): Promise<{ res: Response; data: PostResponse }> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey,
      }
      // Without the session header the server resolves the account by device key, which a
      // Ronin sign-in has already emptied — the snap would earn no bond at all.
      if (buddyEnabled && buddyState.session) headers['X-Buddy-Session'] = buddyState.session
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
    applyBurnsPayload(data.burns)
    const goldenHit = Boolean((data as { goldenFound?: boolean }).goldenFound)
    applyGoldenSummary((data as { golden?: GoldenSummary }).golden)
    leadShiny = false
    syncLeadShinyClass()
    if (data.castCrew) {
      cacheCastCrew(data.castCrew)
      renderCastCrewStrip(data.castCrew)
    }
    if (goldenHit) window.setTimeout(() => showGoldenFound(), 400)
    const spark = data.sparkBurn
    const sparkAmount = spark && Number(spark.amount) > 0 ? Number(spark.amount) : 0
    const newlyCast = (
      data.castCrew?.newlyUnlockedCast ||
      (data.castCrew?.newlyUnlocked || []).filter((id) => CAST_MASCOTS.some((c) => c.id === id))
    ).filter(Boolean)
    const newlyProps = (
      data.castCrew?.newlyUnlockedProps ||
      (data.castCrew?.newlyUnlocked || []).filter((id) => EQUIPMENT_PROPS.some((p) => p.id === id))
    ).filter(Boolean)
    const newly = [...newlyCast, ...newlyProps]
    // Go to feed
    previewScreen.classList.remove('active')
    previewScreen.hidden = true
    if (captureUrl) URL.revokeObjectURL(captureUrl)
    captureUrl = null
    captureBlob = null
    captureLookId = null
    plainCapture = null
    captureSeq += 1
    // One-Axie loop: never the legacy feed. Stay on the camera so Retake works, and float the
    // after-the-shot sheets over it; the last sheet lands on Home.
    if (buddyEnabled) {
      viewfinder.hidden = false
      viewfinder.classList.add('active')
      await handleBuddySnap(data.buddy ?? null, data.post?.id ?? null)
      return
    }
    await showFeed()
    if (newly.length) {
      postToast.hidden = true
      queueCastUnlocks(newlyCast, newlyProps)
      // Light engagement toast after unlocks settle
      const eng = (data.castCrew?.engagement || []).filter(
        (e) => !newlyCast.includes(e.castId) || e.kind === 'like',
      )
      if (eng.length) {
        window.setTimeout(() => toastCastEngagement(eng), 900)
      }
    } else if (isBurnsUiEnabled() && sparkAmount > 0 && spark) {
      // Prestige modal only when burns UI is on
      postToast.hidden = true
      showSparkVictory({
        amount: sparkAmount,
        axieId: spark.axieId || postAxieId || '',
        axieLabel: axieLabel || postAuthorLabel || undefined,
        mode: spark.mode || data.burns?.mode,
        modeLabel: data.burns?.modeLabel,
      })
    } else {
      postToast.textContent = 'Posted'
      groupPhoto.clear()
      postToast.hidden = false
      window.setTimeout(() => {
        postToast.hidden = true
      }, 1600)
      toastCastEngagement(data.castCrew?.engagement)
    }
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

async function handleBuddySnap(snap: SnapResult | null, photoId: string | null = null): Promise<void> {
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
  syncQuestHud()
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
      ...snap.moments.map((m) => momentHtml(m, b)),
      ...snap.unlocks.map((u) => unlockHtml(u, b)),
    ]
  }
  await buddyUi?.show('home')
  buddyUi?.sheet(reactionHtml(snap))
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

function openFeedLightbox(src: string, alt: string): void {
  if (!imgLightbox || !imgLightboxImg || !src) return
  imgLightboxImg.src = src
  imgLightboxImg.alt = alt || ''
  imgLightbox.hidden = false
}

function closeFeedLightbox(): void {
  if (!imgLightbox || !imgLightboxImg) return
  imgLightbox.hidden = true
  imgLightboxImg.src = ''
}

imgLightbox?.addEventListener('click', (e) => {
  if (e.target === imgLightbox || e.target === imgLightboxClose || e.target === imgLightboxImg) {
    closeFeedLightbox()
  }
})
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (sparkVictory && !sparkVictory.hidden) {
    hideSparkVictory()
    return
  }
  closeFeedLightbox()
})

feedList.addEventListener('click', (e) => {
  const img = (e.target as HTMLElement | null)?.closest?.('img.feed-card-img') as HTMLImageElement | null
  if (!img) return
  e.preventDefault()
  openFeedLightbox(img.currentSrc || img.src, img.alt || '')
})

function refreshIdentityChrome(): void {
  const connected = Boolean(roninAddress)
  const guest = ensureGuestIdentity(connected)
  guestId = guest.guestId
  authorLabel = guest.authorLabel
  if (guestBadge) {
    guestBadge.hidden = false
    if (connected) {
      guestBadge.textContent = ownerDisplayName(roninAddress)
      guestBadge.classList.add('is-ronin')
      guestBadge.title = roninAddress
    } else {
      guestBadge.textContent = authorLabel
      guestBadge.classList.remove('is-ronin')
      guestBadge.title = authorLabel
    }
  }
  if (btnConnectRonin) {
    btnConnectRonin.hidden = connected
    if (!connected) {
      btnConnectRonin.textContent = 'Bring your Axies'
      btnConnectRonin.title = 'Optional upgrade — connect Ronin to post owned Axies'
    }
  }
  if (btnDisconnectRonin) btnDisconnectRonin.hidden = !connected
  feedGuest.textContent = connected
    ? `${ownerDisplayName(roninAddress)} · ${authorLabel}`
    : authorLabel
  inventoryTray.hidden = !connected
  if (btnToProfile) btnToProfile.hidden = !connected
  if (btnFeedConnect) btnFeedConnect.hidden = connected
  if (btnFeedToProfile) btnFeedToProfile.hidden = !connected
  if (feedModeBar && !feedScreen.hidden) {
    feedModeBar.hidden = !connected || feedMode === 'axie'
  }
  if (connected) void ensureFollowsLoaded()
  else {
    followedAxieIds = new Set()
    notifUnread = 0
    syncBellBadge()
  }
  // R1: connecting a wallet must not bring the legacy inventory tray or the Profile chip back.
  syncCameraTrays()
}

function openRoninModal(): void {
  roninModalError.hidden = true
  roninModalError.textContent = ''
  roninAddressInput.value = roninAddress || ''
  roninModal.hidden = false
  window.setTimeout(() => roninAddressInput.focus(), 50)
}

function closeRoninModal(): void {
  roninModal.hidden = true
}

async function tryWalletAccounts(): Promise<string | null> {
  type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  const w = window as Window & {
    ronin?: { provider?: Eip1193 }
    ethereum?: Eip1193
  }
  const provider = w.ronin?.provider || w.ethereum
  if (!provider || typeof provider.request !== 'function') return null
  try {
    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
    if (Array.isArray(accounts) && accounts[0]) {
      return normalizeAddressClient(accounts[0])
    }
  } catch (err) {
    console.warn('[axie-idol] wallet request failed', err)
  }
  return null
}

async function connectRonin(): Promise<void> {
  // 1) Waypoint when VITE_WAYPOINT_CLIENT_ID is set
  if (isWaypointConfigured()) {
    try {
      showLiveToast('Connecting Waypoint…', 1200)
      const result = await connectWithWaypoint()
      await applyRoninAddress(result.address, { token: result.token, source: 'waypoint' })
      return
    } catch (err) {
      console.warn('[axie-idol] Waypoint connect failed', err)
      showLiveToast('Waypoint cancelled — paste address', 2200)
      openRoninModal()
      return
    }
  }

  showLiveToast('Waypoint client ID not configured', 2400)

  // 2) Injected wallet when present; else paste modal (iPhone Safari).
  const fromWallet = await tryWalletAccounts()
  if (fromWallet) {
    await applyRoninAddress(fromWallet)
    return
  }
  openRoninModal()
}

async function applyRoninAddress(
  raw: string,
  opts?: { token?: string; source?: 'waypoint' | 'paste' | 'wallet' },
): Promise<void> {
  const addr = normalizeAddressClient(raw)
  if (!addr) {
    roninModalError.hidden = false
    roninModalError.textContent = 'Enter a valid 0x… or ronin:… address'
    showLiveToast('Invalid Ronin address')
    return
  }
  saveRoninAddress(addr)
  if (opts?.token) saveWaypointToken(opts.token)
  roninAddress = addr
  ensureRememberedGuest()
  refreshIdentityChrome()
  closeRoninModal()
  if (opts?.source === 'waypoint' && opts.token) {
    await syncWaypointOwner(addr, opts.token)
  }
  await refreshCachedOwnerName(addr)
  refreshIdentityChrome()
  const shown = ownerDisplayName(addr)
  const via = opts?.source === 'waypoint' ? ' via Waypoint' : ''
  showLiveToast(`Connected ${shown}${via}`)
  await loadInventory()
  await ensureFollowsLoaded()
  void refreshNotifications()
}

async function syncWaypointOwner(address: string, token: string): Promise<void> {
  try {
    const res = await fetch('/api/owner/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, token }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      name?: string
      secondary?: string
      inventoryAddresses?: string[]
    }
    // Keep connected roninAddress for identity chrome — inventory API merges wallets.
    void data.secondary
    void data.inventoryAddresses
    const name = sanitizeOwnerNameClient(typeof data.name === 'string' ? data.name : '')
    if (name) stashOwnerName(address, name)
  } catch (err) {
    console.warn('[axie-idol] owner sync failed', err)
  }
}

/** Re-sync Waypoint profile when token still in sessionStorage (no full logout). */
async function resyncWaypointIfPossible(): Promise<void> {
  const token = loadWaypointToken()
  if (!token || !roninAddress) return
  await syncWaypointOwner(roninAddress, token)
}

async function refreshCachedOwnerName(address: string): Promise<void> {
  const addr = normalizeAddressClient(address)
  if (!addr) return
  try {
    const res = await fetch(`/api/owner?address=${encodeURIComponent(addr)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const data = (await res.json()) as { name?: string }
    if (typeof data.name === 'string' && data.name.trim()) {
      stashOwnerName(addr, data.name)
    }
  } catch {
    /* ignore */
  }
}

function disconnectRonin(): void {
  clearRoninAddress()
  roninAddress = ''
  inventoryAxies = []
  inventoryScroll.innerHTML = ''
  inventoryTray.hidden = true
  // Back to ephemeral guest display; keep deviceKey
  if (customAxieId) {
    customAxieId = null
    ownedAuthorLabel = null
    void selectCast(activeCast)
  }
  refreshIdentityChrome()
  showLiveToast('Disconnected — guest mode')
}

function renderInventory(axies: InventoryAxie[]): void {
  // CDN helper kept as <img> onerror fallback (assets.axieinfinity.com 403s)
  void axieCdnPng
  inventoryLoading.hidden = true
  if (!axies.length) {
    inventoryScroll.innerHTML = ''
    inventoryEmpty.hidden = false
    return
  }
  inventoryEmpty.hidden = true
  // Tray stays capped — full herd lives in Profile → My Axies
  const ordered = [...axies]
  if (customAxieId) {
    ordered.sort((a, b) => {
      if (a.id === customAxieId) return -1
      if (b.id === customAxieId) return 1
      return 0
    })
  }
  const tray = ordered.slice(0, INVENTORY_TRAY_CAP)
  inventoryScroll.innerHTML = tray
    .map((a) => {
      const label = escapeHtml(a.label)
      const name = escapeHtml(a.name)
      const id = escapeHtml(a.id)
      const img = escapeHtml(`/api/image/${a.id}`)
      return `<button type="button" class="inv-chip" data-axie-id="${id}" title="${label}" aria-pressed="false">
  <img class="inv-thumb" src="${img}" alt="" loading="lazy" draggable="false" crossorigin="anonymous" />
  <span class="inv-name">${name}</span>
</button>`
    })
    .join('')
  syncInventoryTrayUI()
}

async function loadInventory(): Promise<void> {
  if (!roninAddress) {
    inventoryTray.hidden = true
    return
  }
  if (inventoryLoadingFlag) return
  inventoryLoadingFlag = true
  // R1: the wardrobe owns the camera tray — the owned-Axie inventory tray stays out of it.
  inventoryTray.hidden = buddyEnabled
  inventoryEmpty.hidden = true
  inventoryLoading.hidden = false
  inventoryScroll.innerHTML = ''
  try {
    const res = await fetch(
      `/api/inventory?address=${encodeURIComponent(roninAddress)}&size=50`,
      { headers: { Accept: 'application/json' } },
    )
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      axies?: InventoryAxie[]
      total?: number
    }
    if (!res.ok) throw new Error(data.error || `inventory ${res.status}`)
    inventoryAxies = Array.isArray(data.axies) ? data.axies : []
    renderInventory(inventoryAxies)
    const total = Number(data.total) || inventoryAxies.length
    if (total > 0) {
      showLiveToast(`${total} Axie(s) loaded`, 2000)
    } else {
      showLiveToast(
        'No Axies on this Waypoint wallet — link your Ronin wallet in Waypoint if they live there.',
        3200,
      )
    }
  } catch (err) {
    console.warn('[axie-idol] inventory failed', err)
    inventoryLoading.hidden = true
    inventoryEmpty.hidden = false
    inventoryEmpty.textContent =
      err instanceof Error ? err.message : 'Could not load inventory'
    showLiveToast('Inventory failed', 2200)
  } finally {
    inventoryLoadingFlag = false
  }
}

inventoryScroll.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('.inv-chip') as HTMLButtonElement | null
  if (!btn) return
  e.preventDefault()
  const id = btn.dataset.axieId
  if (!id) return
  const meta = inventoryAxies.find((a) => a.id === id)
  void loadAxieIdSticker(id, {
    skipSpine: false,
    label: meta?.label,
    toastName: meta?.label || `Axie #${id}`,
  })
})

async function ensureFollowsLoaded(): Promise<void> {
  if (!roninAddress) return
  try {
    const res = await fetch(`/api/follows?address=${encodeURIComponent(roninAddress)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const data = (await res.json()) as { follows?: string[] }
    followedAxieIds = new Set((data.follows || []).map(String))
  } catch (err) {
    console.warn('[axie-idol] follows load failed', err)
  }
}

async function toggleFollowCostume(axieId: string): Promise<void> {
  const id = axieId.trim()
  if (!isCostumeIdClient(id)) return
  if (!roninAddress) {
    showLiveToast('Connect Ronin to follow', 2000)
    void connectRonin()
    return
  }
  const was = followedAxieIds.has(id)
  try {
    const path = was ? '/api/unfollow' : '/api/follow'
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey,
      },
      body: JSON.stringify({ address: roninAddress, axieId: id, deviceKey }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      following?: boolean
      follows?: string[]
      followerCount?: number
      castCrew?: CastCrewPayload
    }
    if (!res.ok) throw new Error(data.error || `follow ${res.status}`)
    applyQuestPayload(data.castCrew)
    if (Array.isArray(data.follows)) followedAxieIds = new Set(data.follows.map(String))
    else if (data.following) followedAxieIds.add(id)
    else followedAxieIds.delete(id)
    if (typeof data.followerCount === 'number') timelineFollowerCount = data.followerCount
    if (timelineAxieId === id) syncFollowButton(id, timelineFollowerCount)
    showLiveToast(followedAxieIds.has(id) ? `Following ${castOrAxieLabel(id)}` : `Unfollowed`, 1600)
  } catch (err) {
    console.warn('[axie-idol] follow failed', err)
    showLiveToast(err instanceof Error ? err.message : 'Follow failed', 2200)
  }
}

function syncBellBadge(): void {
  if (!profileBellBadge) return
  if (notifUnread > 0) {
    profileBellBadge.hidden = false
    profileBellBadge.textContent = notifUnread > 99 ? '99+' : String(notifUnread)
  } else {
    profileBellBadge.hidden = true
  }
}

async function refreshNotifications(): Promise<void> {
  if (!roninAddress) {
    notifUnread = 0
    syncBellBadge()
    return
  }
  try {
    const res = await fetch(`/api/notifications?address=${encodeURIComponent(roninAddress)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      unread?: number
      notifications?: Array<{
        id: string
        createdAt: number
        type: string
        postId: string
        axieId: string
        axieLabel: string
        fromLabel: string
        text?: string
        read: boolean
      }>
    }
    notifUnread = Number(data.unread || 0) || 0
    syncBellBadge()
    const list = data.notifications || []
    if (!list.length) {
      profileBellList.innerHTML = ''
      profileBellEmpty.hidden = false
      return
    }
    profileBellEmpty.hidden = true
    profileBellList.innerHTML = list
      .map((n) => {
        const kind = n.type === 'comment' ? 'commented on' : 'liked'
        const extra = n.type === 'comment' && n.text ? `: ${escapeHtml(n.text)}` : ''
        return `<button type="button" class="bell-item${n.read ? '' : ' is-unread'}" data-post-id="${escapeHtml(n.postId)}" data-notif-id="${escapeHtml(n.id)}">
  <div><strong>${escapeHtml(n.fromLabel)}</strong> ${kind} your <em>${escapeHtml(n.axieLabel || n.axieId)}</em> post${extra}</div>
  <div class="bell-item-meta">${new Date(n.createdAt).toLocaleString()}</div>
</button>`
      })
      .join('')
  } catch (err) {
    console.warn('[axie-idol] notifications failed', err)
  }
}

async function markNotificationsRead(ids?: string[]): Promise<void> {
  if (!roninAddress) return
  try {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: roninAddress, ids }),
    })
    const data = (await res.json().catch(() => ({}))) as { unread?: number }
    if (res.ok && typeof data.unread === 'number') {
      notifUnread = data.unread
      syncBellBadge()
    }
  } catch {
    /* ignore */
  }
}

function setProfileTab(tab: 'axies' | 'posts' | 'board'): void {
  profileTab = tab
  document.querySelectorAll<HTMLButtonElement>('.profile-tab').forEach((btn) => {
    const on = btn.dataset.tab === tab
    btn.classList.toggle('is-active', on)
    btn.setAttribute('aria-selected', on ? 'true' : 'false')
  })
  document.querySelectorAll<HTMLElement>('.profile-panel').forEach((panel) => {
    const on = panel.dataset.panel === tab
    panel.hidden = !on
  })
  if (tab === 'axies') void loadProfileAxies(true)
  if (tab === 'posts') void loadProfilePosts()
  if (tab === 'board') void loadProfileBoard()
}

function manilaDayKeyClient(d = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (y && m && day) return `${y}-${m}-${day}`
  } catch {
    /* fall through */
  }
  const ms = d.getTime() + 8 * 60 * 60 * 1000
  const u = new Date(ms)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`
}

async function hydratePostedIdSets(): Promise<void> {
  if (!roninAddress) return
  try {
    const res = await fetch(
      `/api/feed?authorAddress=${encodeURIComponent(roninAddress)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return
    const data = (await res.json()) as { posts?: FeedPost[] }
    const today = manilaDayKeyClient()
    profilePostedIdsAll = new Set()
    profilePostedIdsToday = new Set()
    for (const p of data.posts || []) {
      profilePostedIdsAll.add(String(p.axieId))
      const day = manilaDayKeyClient(new Date(p.createdAt))
      if (day === today) profilePostedIdsToday.add(String(p.axieId))
    }
  } catch {
    /* ignore */
  }
}

function filteredProfileAxies(): InventoryAxie[] {
  const q = (profileAxieSearch?.value || '').trim().toLowerCase()
  return profileInventory.filter((a) => {
    if (profileAxieFilter === 'used' && !profilePostedIdsToday.has(a.id)) return false
    if (profileAxieFilter === 'never' && profilePostedIdsAll.has(a.id)) return false
    if (!q) return true
    return (
      a.name.toLowerCase().includes(q) ||
      a.label.toLowerCase().includes(q) ||
      a.id.includes(q)
    )
  })
}

function renderProfileAxieGrid(): void {
  const list = filteredProfileAxies()
  if (!list.length) {
    profileAxieGrid.innerHTML = ''
    profileAxieEmpty.hidden = false
    return
  }
  profileAxieEmpty.hidden = true
  profileAxieGrid.innerHTML = list
    .map((a) => {
      const active = customAxieId === a.id ? ' is-active' : ''
      return `<div class="profile-axie-card${active}" data-axie-id="${escapeHtml(a.id)}">
  <button type="button" class="profile-axie-pick" data-axie-id="${escapeHtml(a.id)}" title="Use as costume">
    <img src="/api/image/${escapeHtml(a.id)}" alt="" loading="lazy" />
    <span class="name">${escapeHtml(a.name)}</span>
    <span class="id">#${escapeHtml(a.id)}</span>
  </button>
  <button type="button" class="profile-axie-timeline" data-axie-id="${escapeHtml(a.id)}" title="Open timeline">Timeline</button>
</div>`
    })
    .join('')
}

async function loadProfileAxies(reset: boolean): Promise<void> {
  if (!roninAddress || profileInventoryLoading) return
  if (reset) {
    profileInventory = []
    profileInventoryFrom = 0
    profileInventoryTotal = 0
    await hydratePostedIdSets()
  }
  profileInventoryLoading = true
  btnProfileAxieMore.hidden = true
  try {
    const res = await fetch(
      `/api/inventory?address=${encodeURIComponent(roninAddress)}&from=${profileInventoryFrom}&size=48`,
      { headers: { Accept: 'application/json' } },
    )
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      axies?: InventoryAxie[]
      total?: number
    }
    if (!res.ok) throw new Error(data.error || `inventory ${res.status}`)
    const batch = Array.isArray(data.axies) ? data.axies : []
    profileInventory = reset ? batch : [...profileInventory, ...batch]
    profileInventoryTotal = Number(data.total) || profileInventory.length
    profileInventoryFrom = profileInventory.length
    // Keep tray cache warm with first page
    if (reset && batch.length) {
      inventoryAxies = batch
      renderInventory(inventoryAxies)
    }
    renderProfileAxieGrid()
    btnProfileAxieMore.hidden = profileInventory.length >= profileInventoryTotal
  } catch (err) {
    console.warn('[axie-idol] profile inventory failed', err)
    profileAxieEmpty.hidden = false
    profileAxieEmpty.textContent =
      err instanceof Error ? err.message : 'Could not load Axies'
  } finally {
    profileInventoryLoading = false
  }
}

/** Guest moments: latest global posts by this guest id (R1 limit: last 50 posts). */
async function loadGuestMoments(): Promise<void> {
  try {
    const res = await fetch(
      `/api/feed?guestId=${encodeURIComponent(guestId)}&deviceKey=${encodeURIComponent(deviceKey)}`,
      { headers: { Accept: 'application/json' } },
    )
    const data = (await res.json()) as { posts?: FeedPost[] }
    const mine = (data.posts || []).filter((p) => p.authorGuestId === guestId)
    profilePostsList.classList.add('moments-grid')
    profilePostsEmpty.hidden = mine.length > 0
    profilePostsEmpty.textContent = 'No moments yet. Snap one with Kotaro.'
    profilePostsList.innerHTML = mine
      .map(
        (p) =>
          `<button type="button" class="moment-tile" data-post-id="${escapeHtml(p.id)}" title="${escapeHtml(p.caption || '')}"><img src="${escapeHtml(p.imagePath)}" alt="" loading="lazy" /></button>`,
      )
      .join('')
  } catch {
    profilePostsEmpty.hidden = false
  }
}

async function loadProfilePosts(): Promise<void> {
  if (!roninAddress) {
    await loadGuestMoments()
    return
  }
  profilePostsList.classList.remove('moments-grid')
  try {
    const res = await fetch(
      `/api/feed?authorAddress=${encodeURIComponent(roninAddress)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error(`feed ${res.status}`)
    const data = (await res.json()) as { posts?: FeedPost[] }
    const posts = data.posts || []
    if (!posts.length) {
      profilePostsList.innerHTML = ''
      profilePostsEmpty.hidden = false
      return
    }
    profilePostsEmpty.hidden = true
    // Reuse feed card markup via temporary render into profile list
    const prev = feedList.innerHTML
    const prevEmpty = feedEmpty.hidden
    const prevMode = feedMode
    feedMode = 'global'
    renderFeed(posts)
    profilePostsList.innerHTML = feedList.innerHTML
    feedList.innerHTML = prev
    feedEmpty.hidden = prevEmpty
    feedMode = prevMode
  } catch (err) {
    console.warn('[axie-idol] profile posts failed', err)
    profilePostsEmpty.hidden = false
    profilePostsEmpty.textContent = 'Could not load your posts'
  }
}

async function loadProfileBoard(): Promise<void> {
  if (!roninAddress) return
  try {
    const res = await fetch(`/api/profile?address=${encodeURIComponent(roninAddress)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`profile ${res.status}`)
    const data = (await res.json()) as {
      todayPoints?: number
      level?: number
      myBoard?: Array<{
        axieId: string
        label: string
        points: number
        level?: number
        rank: number | null
        preview?: string
        followerCount?: number
        nextQuest?: { level: number; description: string } | null
      }>
      unread?: number
      burns?: BurnsToday
      castCrew?: CastCrewPayload
    }
    applyBurnsPayload(data.burns)
    const lvl =
      typeof data.level === 'number'
        ? data.level
        : typeof data.castCrew?.level === 'number'
          ? data.castCrew.level
          : null
    if (lvl != null) {
      profileTodayPoints.textContent = `Quest Lv ${lvl}`
    } else if (typeof data.todayPoints === 'number') {
      profileTodayPoints.textContent = `Quest Lv —`
    }
    if (typeof data.unread === 'number') {
      notifUnread = data.unread
      syncBellBadge()
    }
    const rows = data.myBoard || []
    if (!rows.length) {
      profileBoardList.innerHTML = ''
      profileBoardEmpty.hidden = false
      profileBoardEmpty.textContent = 'Post & play quests to climb the Quest Ladder!'
      return
    }
    profileBoardEmpty.hidden = true
    profileBoardList.innerHTML = rows
      .map((r) => {
        const img = escapeHtml(r.preview || `/api/image/${r.axieId}`)
        const level = typeof r.level === 'number' ? r.level : r.points
        const rankBit = r.rank != null ? `#${r.rank}` : '—'
        const next =
          r.nextQuest?.description
            ? `<span class="board-row-follows">Next: ${escapeHtml(r.nextQuest.description)}</span>`
            : ''
        return `<button type="button" class="board-row" role="listitem" data-axie-id="${escapeHtml(r.axieId)}" title="${escapeHtml(r.label)}">
  <span class="board-rank">${rankBit}</span>
  <img class="board-row-avatar" src="${img}" alt="" loading="lazy" />
  <span class="board-row-name">${escapeHtml(r.label)}</span>
  ${next}
  <strong class="board-row-points">Lv ${level} <span class="board-pts-label">quest</span></strong>
</button>`
      })
      .join('')
  } catch (err) {
    console.warn('[axie-idol] profile board failed', err)
    profileBoardEmpty.hidden = false
    profileBoardEmpty.textContent = 'Could not load My board'
  }
}

function handleOwnerByClick(e: Event): boolean {
  const btn = (e.target as HTMLElement | null)?.closest?.(
    '.feed-owner-by, .id-chip[data-owner-address]',
  ) as HTMLElement | null
  const addr = btn?.dataset?.ownerAddress || ''
  if (!addr) return false
  e.preventDefault()
  void openOwnerHouse(addr)
  return true
}

function setOwnerTab(tab: 'axies' | 'posts' | 'board'): void {
  ownerTab = tab
  document.querySelectorAll<HTMLButtonElement>('.owner-tab').forEach((btn) => {
    const on = btn.dataset.tab === tab
    btn.classList.toggle('is-active', on)
    btn.setAttribute('aria-selected', on ? 'true' : 'false')
  })
  document.querySelectorAll<HTMLElement>('#owner .profile-panel').forEach((panel) => {
    const on = panel.dataset.panel === tab
    panel.hidden = !on
  })
  if (tab === 'posts') void loadOwnerPosts()
}

async function openOwnerHouse(address: string): Promise<void> {
  if (legacyScreensBlocked()) return
  setActiveTab('feed')
  const addr = normalizeAddressClient(address)
  if (!addr) return
  viewingOwnerAddress = addr
  hideAllScreens()
  ownerScreen.hidden = false
  ownerScreen.classList.add('active')
  const shown = ownerDisplayName(addr)
  ownerTitle.textContent = 'House'
  ownerNameEl.textContent = shown
  ownerAddressEl.textContent = shortAddress(addr)
  ownerAddressEl.title = addr
  ownerTodayPoints.textContent = 'Quest Lv …'
  setOwnerTab(ownerTab || 'axies')
  await loadOwnerHouse(addr)
}

async function loadOwnerHouse(addr: string): Promise<void> {
  try {
    const res = await fetch(`/api/owner?address=${encodeURIComponent(addr)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`owner ${res.status}`)
    const data = (await res.json()) as {
      address?: string
      name?: string
      displayName?: string
      todayPoints?: number
      level?: number
      axies?: Array<{
        id: string
        label: string
        followerCount?: number
        todayPoints?: number
        preview?: string
      }>
      houseBoard?: Array<{
        axieId: string
        label: string
        points: number
        level?: number
        rank: number | null
        preview?: string
        followerCount?: number
        nextQuest?: { level: number; description: string } | null
      }>
    }
    if (typeof data.name === 'string' && data.name.trim()) {
      stashOwnerName(addr, data.name)
    }
    const shown = data.displayName || ownerDisplayName(addr, data.name)
    ownerNameEl.textContent = shown
    ownerAddressEl.textContent = shortAddress(addr)
    ownerAddressEl.title = addr
    if (typeof data.level === 'number') {
      ownerTodayPoints.textContent = `Quest Lv ${data.level}`
    } else if (typeof data.todayPoints === 'number') {
      ownerTodayPoints.textContent = `Quest Lv —`
    }
    renderOwnerAxies(data.axies || [])
    renderOwnerBoard(data.houseBoard || [])
    if (ownerTab === 'posts') void loadOwnerPosts()
  } catch (err) {
    console.warn('[axie-idol] owner house failed', err)
    ownerAxieEmpty.hidden = false
    ownerAxieEmpty.textContent = 'Could not load this house'
    ownerBoardEmpty.hidden = false
    ownerBoardEmpty.textContent = 'Could not load house board'
  }
}

function renderOwnerAxies(
  axies: Array<{
    id: string
    label: string
    followerCount?: number
    todayPoints?: number
    preview?: string
  }>,
): void {
  if (!axies.length) {
    ownerAxieGrid.innerHTML = ''
    ownerAxieEmpty.hidden = false
    return
  }
  ownerAxieEmpty.hidden = true
  ownerAxieGrid.innerHTML = axies
    .map((a) => {
      const id = escapeHtml(a.id)
      const label = escapeHtml(a.label || `Axie #${a.id}`)
      const img = escapeHtml(a.preview || `/api/image/${a.id}`)
      const pts = typeof a.todayPoints === 'number' ? a.todayPoints : 0
      const fc = typeof a.followerCount === 'number' ? a.followerCount : 0
      return `<button type="button" class="profile-axie-card" data-axie-id="${id}" title="${label} timeline">
  <img src="${img}" alt="" loading="lazy" />
  <span class="name">${label}</span>
  <span class="id">${pts} pts · ${fc} foll</span>
</button>`
    })
    .join('')
}

function renderOwnerBoard(
  rows: Array<{
    axieId: string
    label: string
    points: number
    level?: number
    rank: number | null
    preview?: string
    followerCount?: number
    nextQuest?: { level: number; description: string } | null
  }>,
): void {
  if (!rows.length) {
    ownerBoardList.innerHTML = ''
    ownerBoardEmpty.hidden = false
    ownerBoardEmpty.textContent = 'No quest progress on the ladder yet.'
    return
  }
  ownerBoardEmpty.hidden = true
  ownerBoardList.innerHTML = rows
    .map((r) => {
      const img = escapeHtml(r.preview || `/api/image/${r.axieId}`)
      const level = typeof r.level === 'number' ? r.level : r.points
      const rankBit = r.rank != null ? `#${r.rank}` : '—'
      const next =
        r.nextQuest?.description
          ? `<span class="board-row-follows">Next: ${escapeHtml(r.nextQuest.description)}</span>`
          : ''
      return `<button type="button" class="board-row" role="listitem" data-axie-id="${escapeHtml(r.axieId)}" title="${escapeHtml(r.label)}">
  <span class="board-rank">${rankBit}</span>
  <img class="board-row-avatar" src="${img}" alt="" loading="lazy" />
  <span class="board-row-name">${escapeHtml(r.label)}</span>
  ${next}
  <strong class="board-row-points">Lv ${level} <span class="board-pts-label">quest</span></strong>
</button>`
    })
    .join('')
}

async function loadOwnerPosts(): Promise<void> {
  if (!viewingOwnerAddress) return
  try {
    const res = await fetch(
      `/api/feed?authorAddress=${encodeURIComponent(viewingOwnerAddress)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error(`feed ${res.status}`)
    const data = (await res.json()) as { posts?: FeedPost[] }
    const posts = data.posts || []
    if (!posts.length) {
      ownerPostsList.innerHTML = ''
      ownerPostsEmpty.hidden = false
      return
    }
    ownerPostsEmpty.hidden = true
    const prev = feedList.innerHTML
    const prevEmpty = feedEmpty.hidden
    const prevMode = feedMode
    feedMode = 'global'
    renderFeed(posts)
    ownerPostsList.innerHTML = feedList.innerHTML
    feedList.innerHTML = prev
    feedEmpty.hidden = prevEmpty
    feedMode = prevMode
  } catch (err) {
    console.warn('[axie-idol] house feed failed', err)
    ownerPostsEmpty.hidden = false
    ownerPostsEmpty.textContent = 'Could not load house feed'
  }
}

async function showProfile(): Promise<void> {
  if (legacyScreensBlocked()) return
  hideAllScreens()
  setActiveTab('crew')
  profileScreen.hidden = false
  profileScreen.classList.add('active')
  const connected = Boolean(roninAddress)
  const connectCard = document.querySelector<HTMLElement>('#crew-connect-card')
  const walletRow = document.querySelector<HTMLElement>('#crew-wallet-row')
  const axiesTab = document.querySelector<HTMLElement>('.profile-tab[data-tab="axies"]')
  if (connectCard) connectCard.hidden = connected
  if (walletRow) walletRow.hidden = !connected
  if (axiesTab) axiesTab.hidden = !connected
  const crewLvl = (myCastCrew || loadCachedCastCrew())?.level ?? 0
  profileTodayPoints.textContent = `Lv ${crewLvl}`
  renderCastCrewStrip(myCastCrew)
  if (!connected) {
    profileAddressEl.textContent = authorLabel
    profileAddressEl.title = ''
    setProfileTab('posts')
    return
  }
  profileAddressEl.textContent = ownerDisplayName(roninAddress)
  profileAddressEl.title = roninAddress
  void refreshCachedOwnerName(roninAddress).then(() => {
    if (profileAddressEl) profileAddressEl.textContent = ownerDisplayName(roninAddress)
  })
  // Re-sync Waypoint so secondary wallet lands in owners.json without logout
  await resyncWaypointIfPossible()
  setProfileTab(profileTab || 'axies')
  void loadInventory()
  void refreshNotifications().then(() => maybeCelebrateUnread())
  try {
    const res = await fetch(`/api/profile?address=${encodeURIComponent(roninAddress)}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = (await res.json()) as {
        todayPoints?: number
        level?: number
        unread?: number
        follows?: string[]
        castCrew?: CastCrewPayload
        crewFollowerCount?: number
      }
      {
        const lvl =
          typeof (data as { level?: number }).level === 'number'
            ? (data as { level?: number }).level
            : data.castCrew?.level
        const crewN =
          typeof data.crewFollowerCount === 'number'
            ? data.crewFollowerCount
            : data.castCrew?.crewFollowerCount
        const crewBit =
          typeof crewN === 'number' && crewN > 0 ? ` · ${crewN} cast following` : ''
        if (typeof lvl === 'number') {
          profileTodayPoints.textContent = `Lv ${lvl}${crewBit}`
        }
      }
      if (typeof data.unread === 'number') {
        notifUnread = data.unread
        syncBellBadge()
      }
      if (Array.isArray(data.follows)) followedAxieIds = new Set(data.follows.map(String))
      if (data.castCrew) {
        cacheCastCrew(data.castCrew)
        renderCastCrewStrip(data.castCrew)
      } else {
        void refreshMyCastCrew()
      }
    }
  } catch {
    /* ignore */
  }
}

btnConnectRonin.addEventListener('click', () => {
  void connectRonin()
})
btnDisconnectRonin.addEventListener('click', () => {
  disconnectRonin()
})
btnRoninCancel.addEventListener('click', () => {
  closeRoninModal()
})
btnRoninSave.addEventListener('click', () => {
  void applyRoninAddress(roninAddressInput.value)
})
roninAddressInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    void applyRoninAddress(roninAddressInput.value)
  }
  if (e.key === 'Escape') closeRoninModal()
})

document.querySelector<HTMLButtonElement>('#btn-vf-back')?.addEventListener('click', () => {
  // R1 has no tab bar and no legacy feed: closing the camera goes back to the buddy screens.
  if (buddyEnabled) {
    void buddyUi?.show('auto')
    return
  }
  void showFeed('global')
})
document.querySelector<HTMLButtonElement>('#btn-crew-connect')?.addEventListener('click', () => {
  void connectRonin()
})
document.querySelector<HTMLButtonElement>('#btn-tray-connect')?.addEventListener('click', () => {
  void connectRonin()
})

const onboardScreen = document.querySelector<HTMLElement>('#onboard')!
const ONBOARDED_LS = 'axieIdol.onboarded'

function shouldOnboard(): boolean {
  try {
    if (localStorage.getItem(ONBOARDED_LS) === '1') return false
  } catch {
    return false
  }
  if (roninAddress) return false
  const lvl = (myCastCrew || loadCachedCastCrew())?.level ?? 0
  return lvl === 0
}

function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_LS, '1')
  } catch {
    /* ignore */
  }
}

function showOnboard(): void {
  if (legacyScreensBlocked()) return
  hideAllScreens()
  setActiveTab(null)
  onboardScreen.hidden = false
  onboardScreen.classList.add('active')
}

document.querySelector('#btn-onboard-snap')?.addEventListener('click', () => {
  markOnboarded()
  showViewfinderFromFeed()
})
document.querySelector('#btn-onboard-feed')?.addEventListener('click', () => {
  markOnboarded()
  void showFeed('global')
})

const feedQuestHud = document.querySelector<HTMLElement>('#feed-quest-hud')
const boardYouRow = document.querySelector<HTMLElement>('#board-you-row')
const vfQuestText = document.querySelector<HTMLElement>('#vf-quest-text')
const vfQuestChip = document.querySelector<HTMLElement>('#vf-quest-chip')

function questHudInput(): QuestHudInput | null {
  const d = myCastCrew || loadCachedCastCrew()
  if (!d) return null
  return {
    level: d.level ?? 0,
    nextQuest: d.nextQuest || null,
    nextUnlock: d.nextUnlock || null,
    previewSrc: castPreviewSrc,
  }
}

/** Re-render the pinned quest card (Feed), the You row (Ladder) and the Snap chip. */
function syncQuestHud(): void {
  // One-Axie loop owns the camera HUD: the buddy chip and today's wish replace the quest chip.
  // Gated on the flag alone — with no active buddy (a failed loadBuddy() at boot) the chip goes
  // empty rather than falling back to the legacy quest chip, which R1 has no screens for.
  if (buddyEnabled) {
    const b = buddyState.active
    if (vfQuestChip) vfQuestChip.hidden = true
    if (vfQuestText) vfQuestText.hidden = true
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
    // The wardrobe tray follows `buddyState`, and syncQuestHud() runs after every load and snap.
    syncCameraTrays()
    return
  }
  // Flag off (or no buddy yet): the legacy quest chip owns the HUD again.
  if (bdChip) bdChip.hidden = true
  if (bdWishPill) bdWishPill.hidden = true
  if (vfQuestChip) vfQuestChip.hidden = false
  if (vfQuestText) vfQuestText.hidden = false
  const p = questHudInput()
  if (!p) return
  const html = questHudHtml(p)
  if (feedQuestHud) feedQuestHud.innerHTML = html
  if (boardYouRow) boardYouRow.innerHTML = `<div class="you-row"><span class="you-rank">You</span>${html}</div>`
  if (vfQuestText) vfQuestText.textContent = questChipText(p)
}

feedQuestHud?.addEventListener('click', () => showViewfinderFromFeed())
boardYouRow?.addEventListener('click', () => showViewfinderFromFeed())

tabbar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab')
  if (!b) return
  const t = b.dataset.tab as TabName
  if (t === 'feed') void showFeed('global')
  else if (t === 'snap') showViewfinderFromFeed()
  else if (t === 'ladder') void showBoard()
  else if (t === 'crew') void showProfile()
})

async function boot(): Promise<void> {
  if (isWaypointConfigured()) preloadWaypointSdk()
  deviceKey = ensureDeviceKey()

  // One-Axie loop (VITE_BUDDY=1): the buddy screens replace the feed as the app.
  if (buddyEnabled) {
    bindDeviceKey(() => deviceKey)
    preloadWardrobe()
    buddyUi = mountBuddyScreens({
      goSnap: () => showViewfinderFromFeed(),
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
    setActiveTab(null) // no tab bar in R1
    // index.html ships #feed as `class="screen active"` for the flag-off boot; under the flag it
    // must never paint, not even for the rest of boot before the first buddy screen mounts.
    hideAllScreens()
    syncCameraTrays() // legacy trays out, wardrobe in — before anything can paint the camera
  }

  likedPosts = loadLikedSet()
  ownerNameByAddress = loadOwnerNames()
  roninAddress = loadSavedRoninAddress()

  // Waypoint redirect return (iOS Safari popup-block fallback)
  try {
    const redirected = await tryConsumeWaypointRedirect()
    if (redirected?.address) {
      await applyRoninAddress(redirected.address, {
        token: redirected.token,
        source: 'waypoint',
      })
    }
  } catch (err) {
    console.warn('[axie-idol] Waypoint redirect consume failed', err)
  }

  refreshIdentityChrome()
  syncBurnsUiClass()
  myCastCrew = loadCachedCastCrew()
  if (myCastCrew) renderCastCrewStrip(myCastCrew)
  syncQuestHud()
  void refreshMyCastCrew()

  const dev = isDevMode()
  if (axieIdForm) {
    axieIdForm.hidden = !dev
  }

  scheduleStickerCenter()
  setupGyro()
  syncCastTrayUI()
  syncPropTrayUI()
  btnFlip.disabled = true

  if (roninAddress) {
    void (async () => {
      await resyncWaypointIfPossible()
      await refreshCachedOwnerName(roninAddress).then(() => refreshIdentityChrome())
      await loadInventory()
      await ensureFollowsLoaded()
      void refreshNotifications()
    })()
  }

  // Pure-B: kit cast + owned inventory when connected. Axie ID / ?id= behind ?dev=1
  void (async () => {
    const params = new URLSearchParams(window.location.search)
    const qid = params.get('id')?.trim()
    if (dev && qid && /^\d+$/.test(qid)) {
      if (axieIdInput) axieIdInput.value = qid
      await loadAxieIdSticker(qid)
      return
    }
    myCastCrew = loadCachedCastCrew() || {
      level: 0,
      unlockedCast: ['kotaro'],
      unlocked: ['kotaro'],
      unlockedProps: [],
    }
    renderCreateTrays()
    await initSticker3D()
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
    const bootProp = defaultPropForCast(activeCast)
    if (bootProp && isPropUnlocked(bootProp)) void equipProp(bootProp)
    else void clearEquippedProp()
    void refreshMyCastCrew()
  })()

  window.setTimeout(warmAxieMixer, 2500)
  console.info('[axie-idol] boot', {
    mobile: isMobileLike(),
    isSecureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices),
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
  })

  // R1: the one-Axie loop owns the first screen — egg, hatch or home. If that first request cannot
  // reach the server (loadBuddy above already failed quietly, or startEgg fails here), show the
  // retry card: every screen is hidden by now, so anything else leaves a blank document.
  if (buddyEnabled) {
    try {
      await buddyUi!.show('auto')
    } catch (err) {
      console.warn('[buddy] boot failed', err)
      buddyUi!.showBootError()
    }
    return
  }

  // Land on Idol Feed (early Facebook pattern) — camera only via Create
  if (shouldOnboard()) {
    showOnboard()
  } else {
    await showFeed('global')
  }
}

void boot()
