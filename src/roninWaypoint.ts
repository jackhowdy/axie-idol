/**
 * Ronin Waypoint Web SDK helpers (dynamic import).
 * Client ID from VITE_WAYPOINT_CLIENT_ID — never hardcode.
 */

export type WaypointConnectResult = {
  address: string
  token?: string
}

type Scope = 'openid' | 'profile' | 'email' | 'wallet'

const TOKEN_SS = 'axieIdol.waypointToken'

let waypointModPromise: Promise<typeof import('@sky-mavis/waypoint')> | null = null

/** Warm the SDK so Connect click is not stuck behind a network import (popup killers). */
export function preloadWaypointSdk(): void {
  if (waypointModPromise) return
  waypointModPromise = import('@sky-mavis/waypoint').catch((err) => {
    waypointModPromise = null
    throw err
  })
}

async function loadWaypointSdk() {
  preloadWaypointSdk()
  return waypointModPromise!
}

export function getWaypointClientId(): string {
  const id = (import.meta.env.VITE_WAYPOINT_CLIENT_ID || '').trim()
  return id
}

/** Ronin mainnet 2020; Saigon testnet 2021 (docs also mention 202601). */
export function getWaypointChainId(): number {
  const raw = (import.meta.env.VITE_WAYPOINT_CHAIN_ID || '2020').trim()
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 2020
}

export function isWaypointConfigured(): boolean {
  return Boolean(getWaypointClientId())
}

export function saveWaypointToken(token: string | undefined): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_SS, token)
    else sessionStorage.removeItem(TOKEN_SS)
  } catch {
    /* ignore */
  }
}

export function clearWaypointToken(): void {
  saveWaypointToken(undefined)
}

export function loadWaypointToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_SS) || ''
  } catch {
    return ''
  }
}

function isPopupBlockedError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.message} ${(err as Error & { shortMessage?: string }).shortMessage || ''}`
      : String(err ?? '')
  return /BLOCKED|popup was blocked|Popup window is BLOCKED/i.test(msg)
}

function isUserCancel(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message} ${(err as Error & { shortMessage?: string }).shortMessage || ''}`
      : String(err ?? '')
  return /UserRejected|user rejected|cancelled|canceled|closed/i.test(msg)
}

/** Phones / iOS Safari block popups after any await — use redirect first. */
export function shouldPreferWaypointRedirect(): boolean {
  try {
    const ua = navigator.userAgent || ''
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return true
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      return true
    }
    // Desktop Safari also aggressive about popups after async
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua)
    if (isSafari) return true
  } catch {
    /* ignore */
  }
  return false
}

async function authorizeRedirect(
  authorize: (typeof import('@sky-mavis/waypoint'))['authorize'],
  base: { clientId: string; scopes: Scope[] },
): Promise<WaypointConnectResult> {
  await authorize({
    ...base,
    mode: 'redirect',
    // Must match console Redirect URI exactly. SDK default is origin with NO trailing slash.
    redirectUrl: window.location.origin,
  })
  // Page navigates away; never resolve so callers do not open paste modal
  return new Promise(() => {})
}

/**
 * Mobile/Safari: redirect immediately (no popup toast / retry).
 * Desktop Chromium: popup first; if blocked, seamless redirect (no extra UI step).
 */
export async function connectWithWaypoint(): Promise<WaypointConnectResult> {
  const clientId = getWaypointClientId()
  if (!clientId) {
    throw new Error('Waypoint client ID not configured')
  }

  const { authorize } = await loadWaypointSdk()

  const scopes: Scope[] = ['openid', 'profile', 'wallet']
  const base = {
    clientId,
    scopes,
  }

  if (shouldPreferWaypointRedirect()) {
    return authorizeRedirect(authorize, base)
  }

  try {
    const result = await authorize({
      ...base,
      mode: 'popup',
    })
    const address = result?.address
    if (!address) {
      throw new Error('Waypoint returned no wallet address')
    }
    return { address, token: result.token }
  } catch (err) {
    if (isUserCancel(err) && !isPopupBlockedError(err)) {
      throw err
    }
    console.warn('[axie-idol] Waypoint popup failed; redirecting', err)
    return authorizeRedirect(authorize, base)
  }
}

/**
 * If the URL is a Waypoint redirect callback (`method=auth`), parse it.
 * Returns null when this is not a redirect return (or parse fails).
 * Clears auth query params from the address bar on success.
 */
export async function tryConsumeWaypointRedirect(): Promise<WaypointConnectResult | null> {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('method') !== 'auth') return null

    const { parseRedirectUrl } = await loadWaypointSdk()
    const parsed = parseRedirectUrl()
    const address = parsed.address
    if (!address) {
      console.warn('[axie-idol] Waypoint redirect had no address')
      return null
    }

    // Clean OAuth params from the URL without reload
    ;['method', 'type', 'state', 'data', 'address', 'secondary_address', 'authorization_code'].forEach(
      (k) => url.searchParams.delete(k),
    )
    const clean = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, '', clean || '/')

    return { address, token: parsed.token || undefined }
  } catch (err) {
    // Not a success redirect (or invalid) — leave URL alone for debugging
    console.warn('[axie-idol] Waypoint redirect parse skipped', err)
    return null
  }
}
