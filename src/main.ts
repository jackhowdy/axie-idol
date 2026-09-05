/**
 * Axie Idol LIVE viewfinder composer (Round 1 demo)
 * 7 kit mascots (no Sapidae) — on-demand GLB stickers + PNG fallback (see RIGHTS.md)
 */

import type { Sticker3D } from './sticker3d'
import type { PropOverlay } from './propOverlay'
import type { SpineSticker } from './spineSticker'
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
] as const

type CastId = (typeof CAST_MASCOTS)[number]['id']

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

function mascotGlbUrl(id: CastId): string {
  const meta = castMeta(id)
  if (!meta?.glb) return ''
  return `./models/mascots/${meta.glb}`
}

function mascotStickerUrl(id: string): string {
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
let spineSticker: SpineSticker | null = null
let propOverlay: PropOverlay | null = null
let equippedProp: PropId | null = null
let equipRequest = 0
/** Active kit mascot — default Kotaro */
let activeCast: CastId = 'kotaro'
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
      '.chrome, .toolbar, .cast-tray, .prop-tray, .inventory-tray, .ronin-modal, .spark-victory, .cast-unlock, .camera-gate, #feed, #board, #profile, button, a, input, label, form',
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
  return Boolean(target.closest('#sticker, #sticker3d, #sticker-layer canvas'))
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

  const useSpine = Boolean(spineSticker?.ready && spineSticker.canvas)
  const use3d = Boolean(sticker3d?.ready)
  if (useSpine && spineSticker) {
    spineSticker.renderNow()
    const spCanvas = spineSticker.canvas
    const baseW = spCanvas.clientWidth * scaleX
    const baseH = spCanvas.clientHeight * scaleX
    ctx.save()
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
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((state.rotation * Math.PI) / 180)
    ctx.scale(state.scale, state.scale)
    ctx.drawImage(stickerImg, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()
  }

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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 0.95),
  )
  if (!blob) return

  if (captureUrl) URL.revokeObjectURL(captureUrl)
  captureBlob = blob
  captureUrl = URL.createObjectURL(blob)
  previewImg.src = captureUrl
  btnDownload.href = captureUrl
  if (captionInput) captionInput.value = ''

  disposeSpineSticker()
  disposeSticker3D()
  disposePropOverlay()
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
}

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
  sticker3d.dispose()
  sticker3d = null
  stickerImg.hidden = false
  stickerImg.style.pointerEvents = "auto"
  bindStickerPointers(stickerImg)
  applyStickerTransform()
}

function applyPngFallback(cast: CastId): void {
  const meta = castMeta(cast)
  stickerImg.src = mascotStickerUrl(cast)
  stickerImg.alt = `${meta?.label || cast} Axie sticker`
  stickerImg.hidden = false
  stickerImg.style.pointerEvents = "auto"
  bindStickerPointers(stickerImg)
  applyStickerTransform()
}

async function initSticker3D(): Promise<void> {
  disposeSpineSticker()
  const cast = activeCast
  const req = ++castRequest
  const url = mascotGlbUrl(cast)
  const meta = castMeta(cast)
  const heavy = cast === 'tripp'
  const label = meta?.label || cast
  setMascotLoading(true, heavy ? `Loading ${label}… (~7MB)` : `Loading ${label}…`)
  applyPngFallback(cast)

  // No GLB for starters / numeric / Agonia Echo — PNG/CDN only
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

async function selectCast(id: CastId): Promise<void> {
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
  void selectCast(id)
})


function axieCdnPng(id: string): string {
  return `https://axiecdn.axieinfinity.com/axies/${id}/axie/axie-full-transparent.png`
}


async function upgradeAxieIdToSpine(id: string, req: number): Promise<void> {
  if (req !== castRequest || customAxieId !== id) return
  setMascotLoading(true, `Animating #${id}…`)
  try {
    const metaRes = await fetch(`/api/metadata/${id}`)
    if (req !== castRequest || customAxieId !== id) {
      setMascotLoading(false)
      return
    }
    if (!metaRes.ok) {
      throw new Error(`metadata ${metaRes.status}`)
    }
    const meta = (await metaRes.json()) as { genes?: string }
    const genes = meta?.genes
    if (!genes || genes === '0x0' || genes === '0x') {
      throw new Error('No genes available')
    }

    // Ensure Three mascot WebGL is gone before Pixi
    disposeSticker3D()
    if (req !== castRequest || customAxieId !== id) {
      setMascotLoading(false)
      return
    }

    const { createSpineSticker } = await import('./spineSticker')
    if (req !== castRequest || customAxieId !== id) {
      setMascotLoading(false)
      return
    }

    disposeSpineSticker()
    const handle = await createSpineSticker(stickerLayer)
    if (req !== castRequest || customAxieId !== id) {
      handle?.dispose()
      setMascotLoading(false)
      return
    }
    if (!handle) {
      throw new Error('Spine sticker init failed')
    }

    await handle.renderFromGenes(genes)
    if (req !== castRequest || customAxieId !== id) {
      handle.dispose()
      setMascotLoading(false)
      return
    }

    spineSticker = handle
    stickerImg.hidden = true
    stickerImg.style.pointerEvents = 'none'
    bindStickerPointers(handle.canvas)
    applyStickerTransform()
    setMascotLoading(false)
    showLiveToast(`Axie #${id} alive`)
  } catch (err) {
    console.warn('[axie-idol] Spine skipped', err)
    if (req !== castRequest) return
    setMascotLoading(false)
    // Keep PNG path
    if (customAxieId === id && !spineSticker) {
      stickerImg.hidden = false
      stickerImg.style.pointerEvents = 'auto'
      bindStickerPointers(stickerImg)
      applyStickerTransform()
      showLiveToast('Spine skipped')
    }
  }
}

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
      // Spine optional — skip for inventory speed
      if (!opts?.skipSpine) {
        void upgradeAxieIdToSpine(trimmed, req)
      }
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

function showViewfinderFromFeed(): void {
  hideAllScreens()
  viewfinder.hidden = false
  viewfinder.classList.add('active')
  // Guest dopamine: default Kotaro on camera if none selected
  if (!customAxieId) {
    if (activeCast !== 'kotaro') {
      void selectCast('kotaro')
    } else {
      syncCastTrayUI()
    }
  }
  scheduleStickerCenter()
  if (isMobileLike() || !stream) {
    showCameraGate(true)
  }
  if (!isMobileLike() && !stream) {
    void (async () => {
      const ok = await startCamera('environment')
      if (!ok) showCameraGate(true)
      else showCameraGate(false)
    })()
  }
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
    feedTitle.textContent = 'Idol Feed'
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
  const id = axieId.trim()
  if (!isCostumeIdClient(id)) return
  feedMode = 'axie'
  timelineAxieId = id
  updateFeedChrome()
  if (feedScreen.hidden) {
    hideAllScreens()
    feedScreen.hidden = false
    feedScreen.classList.add('active')
    feedGuest.textContent = authorLabel
  }
  stopFeedAutoRefresh()
  await refreshFeed()
}

async function showFeed(mode: 'global' | 'following' = 'global'): Promise<void> {
  feedMode = mode
  timelineAxieId = null
  timelineFollowerCount = 0
  updateFeedChrome()
  hideAllScreens()
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
  if (btnSparkVictoryOk) btnSparkVictoryOk.textContent = 'Keep chatting'
  stopSparkConfetti()
  const dismissedId = activeCelebrationNotifId
  activeCelebrationNotifId = null
  if (sparkVictory) {
    sparkVictory.hidden = true
    sparkVictory.classList.remove('is-cast-follow', 'is-social')
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
    if (/^\d+$/.test(castId)) return `/api/image/${castId}`
    return ''
  }
  if (meta.kind === 'axie' || /^\d+$/.test(castId)) return `/api/image/${castId}`
  if (meta.preview) return `/previews/${meta.preview}`
  return `/api/image/${castId}`
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
  if (/^\d+$/.test(axieId)) return `/api/image/${axieId}`
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
  const badge = opts.kind === 'cast' ? '<span class="id-chip-badge">Cast</span>' : ''
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
  const rangeLabel = range === 'all' ? 'All-time Quest Ladder' : 'Daily Climbers'
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
    ctx.fillText('👑', cx, cy - rad - 20)
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
  const casts = (ids || []).filter((id) => CAST_MASCOTS.some((c) => c.id === id))
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
  const level = data.level ?? 0
  profileCastCrew.hidden = false
  if (profileCastCrewCount) {
    profileCastCrewCount.textContent = `Level ${level} · ${unlocked.size} cast`
  }
  // Show unlocked cast faces (hide locked for R1 kid clarity)
  const faces = CAST_MASCOTS.filter((c) => unlocked.has(c.id))
  profileCastCrewGrid.innerHTML = faces
    .map((c) => {
      const src = castPreviewSrc(c.id)
      const name = escapeHtml(c.label)
      return `<div class="cast-crew-slot is-unlocked" role="listitem" title="${name} following you">
  <img src="${escapeHtml(src)}" alt="${name}" loading="lazy" onerror="this.src='/previews/kotaro.png'" />
  <span class="cast-crew-slot-name">${name}</span>
</div>`
    })
    .join('')
  if (unlockedProps.size) {
    profileCastCrewGrid.innerHTML += [...unlockedProps]
      .map((pid) => {
        const name = escapeHtml(propLabelName(pid))
        return `<div class="cast-crew-slot is-unlocked is-prop" role="listitem" title="${name}">
  <span class="cast-crew-prop-ico" aria-hidden="true">🎁</span>
  <span class="cast-crew-slot-name">${name}</span>
</div>`
      })
      .join('')
  }
  if (profileCastCrewHint) {
    const next = data.nextQuest || null
    const nextUnlock = data.nextUnlock
    if (next) {
      profileCastCrewHint.hidden = false
      profileCastCrewHint.textContent = `L${next.level}: ${next.description} (${next.progress}/${next.target}) → ${next.unlockLabel || nextUnlock?.label || ''}`
    } else if (level >= 24) {
      profileCastCrewHint.hidden = false
      profileCastCrewHint.textContent = 'Quest complete — Villain unlocked!'
    } else {
      profileCastCrewHint.hidden = true
      profileCastCrewHint.textContent = ''
    }
  }
}

/** Rebuild Create trays from unlocked cast/props (hide locked). */
function renderCreateTrays(): void {
  const unlockedCast = new Set(
    myCastCrew?.unlockedCast || myCastCrew?.unlocked || ['kotaro'],
  )
  if (!unlockedCast.has('kotaro')) unlockedCast.add('kotaro')
  const unlockedProps = new Set(myCastCrew?.unlockedProps || [])

  // Cast tray: only unlocked faces
  const castHtml = CAST_MASCOTS.filter((c) => unlockedCast.has(c.id))
    .map((c) => {
      const src = castPreviewSrc(c.id)
      const pressed = !customAxieId && activeCast === c.id
      return `<button type="button" class="cast-chip" data-cast="${c.id}" aria-pressed="${pressed ? 'true' : 'false'}" title="${escapeHtml(c.label)}">
  <img class="cast-thumb" src="${escapeHtml(src)}" alt="" draggable="false" onerror="this.src='/previews/kotaro.png'" />
  <span class="cast-name">${escapeHtml(c.label)}</span>
</button>`
    })
    .join('')
  castTray.innerHTML = castHtml || ''

  // Prop tray: only unlocked props (none free at launch)
  const propIcons: Record<string, string> = {
    'kotaro-sword': '⚔',
    'bing-cannon': '💣',
    'kibo-hammer': '🔨',
    'paladill-axe': '🪓',
    'pomodoro-staff': '🪄',
    'tripp-sword': '🗡',
    'xia-axe': '⛏',
  }
  const propHtml = (EQUIPMENT_PROPS as readonly { id: PropId; file: string; label: string; short?: string }[]).filter((p) => unlockedProps.has(p.id))
    .map((p) => {
      const on = equippedProp === p.id
      return `<button type="button" class="prop-chip" data-prop="${p.id}" aria-pressed="${on ? 'true' : 'false'}" title="${escapeHtml(p.label)}">
  <span class="prop-ico" aria-hidden="true">${propIcons[p.id] || '🎁'}</span>
  <span class="prop-name">${escapeHtml(p.short || p.label)}</span>
</button>`
    })
    .join('')
  propTray.innerHTML = propHtml
  propTray.hidden = unlockedProps.size === 0
  syncCastTrayUI()
  syncPropTrayUI()
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
    if (sparkVictorySub) {
      sparkVictorySub.textContent = 'Equip it from the prop tray on Create.'
    }
    if (btnSparkVictoryOk) btnSparkVictoryOk.textContent = 'Awesome!'
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
    if (sparkVictoryKicker) sparkVictoryKicker.textContent = 'CAST CREW'
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
    if (sparkVictoryTitle) sparkVictoryTitle.textContent = `${label} followed you!`
    if (sparkVictoryBody) {
      const extra =
        more.length === 1
          ? ` ${castLabelName(more[0]!)} joined too.`
          : more.length > 1
            ? ` Plus ${more.length} more cast mates.`
            : ''
      if (guestNeedsSave) {
        sparkVictoryBody.innerHTML =
          `Thanks for posting — <strong>${escapeHtml(label)}</strong> just followed you.${extra} ` +
          `<strong>Connect Ronin</strong> so you don't lose your cast crew when you leave.`
      } else {
        sparkVictoryBody.innerHTML =
          `Thanks for posting — <strong>${escapeHtml(label)}</strong> just followed you.${extra} ` +
          `Keep questing to unlock more cast mates & props.`
      }
    }
    if (sparkVictorySub) {
      sparkVictorySub.textContent = guestNeedsSave
        ? 'Guests can post for fun — Connect saves who follows you.'
        : 'Your cast crew hypes your posts with likes & comments.'
    }
    if (btnSparkVictoryOk) {
      btnSparkVictoryOk.textContent = guestNeedsSave ? 'Save my crew — Connect' : 'Keep chatting'
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
      'Keep chatting — likes &amp; comments help climb the Quest Ladder.'
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
      return `<article class="feed-card" data-post-id="${p.id}"${seedMark}>
  <div class="feed-card-top">
    <div class="feed-card-meta">
      ${axieChip}
      <span class="feed-author">${authorChip}</span>
    </div>
    <p class="feed-caption">${cap}</p>
    ${burnsHtml}
  </div>
  <div class="feed-card-img-wrap">
    <img class="feed-card-img" src="${escapeHtml(p.imagePath)}" alt="${escapeHtml(p.axieLabel || p.axieId)} post" loading="lazy" />
  </div>
  <div class="feed-card-body">
    <div class="feed-like-row">
      <button type="button" class="btn like-btn${liked ? ' is-liked' : ''}" data-post-id="${p.id}" aria-pressed="${liked ? 'true' : 'false'}">
        ${liked ? '♥ Liked' : '♡ Like'}
      </button>
      <span class="like-count" data-like-count="${p.id}">${p.likes || 0}</span>
    </div>
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
    boardTitle.textContent = boardRange === 'all' ? 'All-time Quest Ladder' : 'Daily Climbers'
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
      const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'
      const img = escapeHtml(r.preview || previewFor(r.axieId))
      return `<div class="board-podium-card place-${place}${place === 1 ? ' is-crown' : ''}" data-axie-id="${escapeHtml(r.axieId)}" data-poster-key="${escapeHtml(r.posterKey || '')}"${
        r.owner?.address ? ` data-owner-address="${escapeHtml(r.owner.address)}"` : ''
      }>
  <button type="button" class="board-podium-main" data-axie-id="${escapeHtml(r.axieId)}" title="${escapeHtml(r.label)}">
    <span class="board-medal">${medal}</span>
    <img class="board-avatar" src="${img}" alt="" loading="lazy" />
    <span class="board-name">${escapeHtml(r.label)}</span>
    <strong class="board-points">${boardLevelLabel(r)}</strong>
    <span class="board-place">#${place}</span>
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
          ? `<span class="board-row-follows" title="${escapeHtml(r.nextQuest.description)}">L${r.nextQuest.level}: ${escapeHtml(
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
    <strong class="board-row-points">${boardLevelLabel(r)} <span class="board-pts-label">quest</span></strong>
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
  hideAllScreens()
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
    btn.textContent = '♡ Like'
    if (countEl) countEl.textContent = String(Math.max(0, prevCount - 1))
  } else {
    likedPosts.add(postId)
    btn.classList.add('is-liked')
    btn.setAttribute('aria-pressed', 'true')
    btn.textContent = '♥ Liked'
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
    btn.textContent = liked ? '♥ Liked' : '♡ Like'
  } catch (err) {
    console.warn('[axie-idol] like failed', err)
    // Revert optimistic
    if (wasLiked) {
      likedPosts.add(postId)
      btn.classList.add('is-liked')
      btn.setAttribute('aria-pressed', 'true')
      btn.textContent = '♥ Liked'
      if (countEl) countEl.textContent = String(prevCount)
    } else {
      likedPosts.delete(postId)
      btn.classList.remove('is-liked')
      btn.setAttribute('aria-pressed', 'false')
      btn.textContent = '♡ Like'
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
    if (postingOwned) {
      body.ownerAddress = roninAddress
    }
    if (roninAddress) {
      body.address = roninAddress
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      post?: FeedPost
      sparkBurn?: { axieId: string; amount: number; mode?: string }
      burns?: BurnsToday
      castCrew?: CastCrewPayload
    }
    if (!res.ok) {
      throw new Error(data.error || `Post failed (${res.status})`)
    }
    applyBurnsPayload(data.burns)
    if (data.castCrew) {
      cacheCastCrew(data.castCrew)
      renderCastCrewStrip(data.castCrew)
    }
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
      postToast.textContent = 'Posted! ✨'
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
  inventoryTray.hidden = false
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

async function loadProfilePosts(): Promise<void> {
  if (!roninAddress) return
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
  if (!roninAddress) {
    showLiveToast('Bring your own Axies — Connect when you\'re ready', 2200)
    void connectRonin()
    return
  }
  hideAllScreens()
  profileScreen.hidden = false
  profileScreen.classList.add('active')
  profileAddressEl.textContent = ownerDisplayName(roninAddress)
  profileAddressEl.title = roninAddress
  void refreshCachedOwnerName(roninAddress).then(() => {
    if (profileAddressEl) profileAddressEl.textContent = ownerDisplayName(roninAddress)
  })
  profileTodayPoints.textContent = 'Quest Lv …'
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
          profileTodayPoints.textContent = `Quest Lv ${lvl}${crewBit}`
        } else if (typeof data.todayPoints === 'number') {
          profileTodayPoints.textContent = `Quest Lv —${crewBit}`
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

async function boot(): Promise<void> {
  if (isWaypointConfigured()) preloadWaypointSdk()
  deviceKey = ensureDeviceKey()
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
    const bootProp = defaultPropForCast(activeCast)
    if (bootProp && isPropUnlocked(bootProp)) void equipProp(bootProp)
    else void clearEquippedProp()
    void refreshMyCastCrew()
  })()

  console.info('[axie-idol] boot', {
    mobile: isMobileLike(),
    isSecureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices),
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
  })

  // Land on Idol Feed (early Facebook pattern) — camera only via Create
  await showFeed('global')
}

void boot()
