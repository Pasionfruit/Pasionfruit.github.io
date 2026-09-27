/**
 * The site's own sign-in session, so the installed PWA stops logging itself out.
 *
 * Google ID tokens last an hour. Holding one as the session meant reopening the
 * home-screen app after lunch landed on a signed-out site, and the One Tap
 * `auto_select` fallback cannot save it: a standalone PWA gets its own storage
 * partition, so there is usually no Google session inside it to select from.
 * Silent renewal works in a browser tab and fails on the home screen — exactly
 * where it was needed.
 *
 * So Google proves who you are once, and the db Worker issues a 30-day session
 * in exchange. The session is a JWT carrying the same `email` and `exp` claims a
 * Google ID token does, which is why everything downstream — the admin check,
 * the expiry check, every `Authorization: Bearer` call — treats the two
 * identically and needed no special case.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

/**
 * Deliberately the same key the Google ID token already used. An existing
 * sign-in therefore survives this change and is upgraded to a session on the
 * next launch, rather than everyone being logged out once by the fix for being
 * logged out.
 */
const STORAGE_KEY = 'google-id-token'

/** Our own tokens say this; Google's say accounts.google.com. */
const ISSUER = 'abepasion.com'

/** Renew with a week to spare, so a month between launches still carries over. */
const RENEW_WHEN_REMAINING_SECONDS = 7 * 86400

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) {
      return null
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(window.atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getTokenEmail(token: string) {
  const email = decodeJwtPayload(token)?.email
  return typeof email === 'string' ? email.toLowerCase().trim() : ''
}

function expirySeconds(token: string) {
  const exp = decodeJwtPayload(token)?.exp
  return typeof exp === 'number' ? exp : undefined
}

export function isExpiredToken(token: string) {
  const exp = expirySeconds(token)
  if (!exp) {
    // No expiry claim means we cannot prove it is stale, so keep it: the Worker
    // is the real boundary and will reject it if it is no good.
    return false
  }
  return exp <= Math.floor(Date.now() / 1000)
}

/** One of ours, as opposed to a Google ID token. */
export function isSessionToken(token: string) {
  return decodeJwtPayload(token)?.iss === ISSUER
}

/**
 * Whether to call the Worker for a fresh session.
 *
 * A Google token is upgraded on sight. One of ours is left alone until its last
 * week, so a launch normally costs no extra request.
 */
export function needsSession(token: string) {
  if (!token) {
    return false
  }
  if (!isSessionToken(token)) {
    return true
  }

  const exp = expirySeconds(token)
  if (!exp) {
    return true
  }
  return exp - Math.floor(Date.now() / 1000) < RENEW_WHEN_REMAINING_SECONDS
}

export function readStoredToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  let token: string
  try {
    token = window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // Private mode or blocked site data. Sign-in still works for this visit.
    return ''
  }

  if (!token) {
    return ''
  }

  if (isExpiredToken(token)) {
    clearStoredToken()
    return ''
  }

  return token
}

export function writeStoredToken(token: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Nothing to do — the session lives in memory for this visit instead.
  }
}

export function clearStoredToken() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Already gone as far as anyone can tell.
  }
}

/**
 * Trade the current credential for a fresh 30-day session.
 *
 * Accepts either a Google ID token or an existing session, because the Worker
 * does; that is what makes the window sliding rather than fixed. Returns '' on
 * any failure, so a flaky network leaves the caller on the token it already has
 * instead of signing them out.
 */
export async function exchangeForSession(bearer: string): Promise<string> {
  if (!bearer) {
    return ''
  }

  try {
    const response = await fetch(`${DB_BASE_URL}/auth/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
    })
    if (!response.ok) {
      return ''
    }

    const body = (await response.json()) as { token?: string }
    const token = String(body.token ?? '')
    return token && isSessionToken(token) ? token : ''
  } catch {
    return ''
  }
}
