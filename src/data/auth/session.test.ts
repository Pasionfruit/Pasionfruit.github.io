// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearStoredToken,
  exchangeForSession,
  getTokenEmail,
  isExpiredToken,
  isSessionToken,
  needsSession,
  readStoredToken,
  writeStoredToken,
} from './session'

const STORAGE_KEY = 'google-id-token'
const EMAIL = 'pasionabe@gmail.com'

function b64url(value: object) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A JWT of the shape that matters here: only the claims are ever read. */
function token(payload: Record<string, unknown>) {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`
}

const inDays = (days: number) => Math.floor(Date.now() / 1000) + days * 86400

const session = (days = 30) => token({ iss: 'abepasion.com', email: EMAIL, exp: inDays(days) })
const googleToken = (hours = 1) =>
  token({ iss: 'accounts.google.com', email: EMAIL, exp: Math.floor(Date.now() / 1000) + hours * 3600 })

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Spies on Storage.prototype outlive unstubAllGlobals and would leak into the
  // next test's localStorage calls.
  vi.restoreAllMocks()
})

describe('token claims', () => {
  it('reads the email out of either kind of token', () => {
    expect(getTokenEmail(session())).toBe(EMAIL)
    expect(getTokenEmail(googleToken())).toBe(EMAIL)
  })

  it('tells our sessions apart from Google ID tokens', () => {
    expect(isSessionToken(session())).toBe(true)
    expect(isSessionToken(googleToken())).toBe(false)
  })

  it('survives a token it cannot parse', () => {
    expect(getTokenEmail('not-a-jwt')).toBe('')
    expect(isSessionToken('not-a-jwt')).toBe(false)
  })

  it('keeps a token with no expiry claim, leaving the verdict to the worker', () => {
    // Being unable to prove staleness is not proof of staleness, and the Worker
    // is the real boundary either way.
    expect(isExpiredToken(token({ iss: 'abepasion.com', email: EMAIL }))).toBe(false)
  })

  it('treats a past expiry as expired', () => {
    expect(isExpiredToken(session(-1))).toBe(true)
    expect(isExpiredToken(session(30))).toBe(false)
  })
})

describe('needsSession', () => {
  it('upgrades a Google ID token on sight', () => {
    // This is the exchange that stops the PWA logging itself out: Google's hour
    // becomes our thirty days.
    expect(needsSession(googleToken())).toBe(true)
  })

  it('leaves a healthy session alone, so a launch costs no extra request', () => {
    expect(needsSession(session(30))).toBe(false)
    expect(needsSession(session(8))).toBe(false)
  })

  it('renews inside the last week, so a month between launches still carries', () => {
    expect(needsSession(session(6))).toBe(true)
    expect(needsSession(session(1))).toBe(true)
  })

  it('has nothing to do without a token', () => {
    expect(needsSession('')).toBe(false)
  })
})

describe('storage', () => {
  it('round-trips a session', () => {
    writeStoredToken(session())
    expect(isSessionToken(readStoredToken())).toBe(true)
  })

  it('drops an expired token on read rather than handing it back', () => {
    localStorage.setItem(STORAGE_KEY, session(-1))
    expect(readStoredToken()).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('reuses the key the Google token used, so this change signs nobody out', () => {
    // An existing Google token in storage must still be picked up and then
    // upgraded, not discarded.
    const existing = googleToken()
    localStorage.setItem(STORAGE_KEY, existing)
    expect(readStoredToken()).toBe(existing)
    expect(needsSession(existing)).toBe(true)
  })

  it('does not throw when site data is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredToken()).toBe('')
  })

  it('clears on sign-out', () => {
    writeStoredToken(session())
    clearStoredToken()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('exchangeForSession', () => {
  it('sends the current bearer and returns the minted session', async () => {
    const minted = session()
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ token: minted }) } as Response),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await exchangeForSession(googleToken())).toBe(minted)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/auth/session')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toContain('Bearer ')
  })

  it('returns nothing when the worker refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)))
    expect(await exchangeForSession(googleToken())).toBe('')
  })

  it('returns nothing rather than throwing when the network fails', async () => {
    // The caller keeps the token it already has. Signing someone out because
    // their wifi dropped is the bug this whole module exists to fix.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    expect(await exchangeForSession(googleToken())).toBe('')
  })

  it('refuses a response that is not one of our sessions', async () => {
    const notOurs = googleToken()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ token: notOurs }) } as Response)),
    )
    expect(await exchangeForSession(googleToken())).toBe('')
  })

  it('does not call the worker without a bearer', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await exchangeForSession('')).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
