import { describe, expect, it } from 'vitest'

import { isSessionToken, mintSession, verifySession, SESSION_TTL_SECONDS } from './session.js'

const SECRET = 'test-secret-not-the-real-one'
const EMAIL = 'pasionabe@gmail.com'

function claims(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4)))
}

describe('mintSession', () => {
  it('issues a token that verifies and carries the email', async () => {
    const token = await mintSession(EMAIL, SECRET)

    const result = await verifySession(token, SECRET)
    expect(result.ok).toBe(true)
    expect(result.email).toBe(EMAIL)
  })

  it('lasts thirty days, which is the point of it', async () => {
    const token = await mintSession(EMAIL, SECRET)
    const { iat, exp } = claims(token)

    expect(exp - iat).toBe(SESSION_TTL_SECONDS)
    expect(SESSION_TTL_SECONDS).toBe(30 * 86400)
  })

  it('mirrors the Google claims the browser already decodes', async () => {
    // The browser reads `email` and `exp` and cannot tell the two kinds of token
    // apart. That is what let this ship without a second code path downstream.
    const payload = claims(await mintSession(EMAIL, SECRET))

    expect(payload.email).toBe(EMAIL)
    expect(payload.email_verified).toBe(true)
    expect(typeof payload.exp).toBe('number')
    expect(payload.iss).toBe('abepasion.com')
  })
})

describe('isSessionToken', () => {
  it('recognises one of ours', async () => {
    expect(isSessionToken(await mintSession(EMAIL, SECRET))).toBe(true)
  })

  it('does not claim an RS256 token from Google', () => {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({ iss: 'accounts.google.com', email: EMAIL }))
    expect(isSessionToken(`${header}.${payload}.sig`)).toBe(false)
  })

  it('does not claim a symmetric token issued by someone else', async () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({ iss: 'evil.example', email: EMAIL }))
    expect(isSessionToken(`${header}.${payload}.sig`)).toBe(false)
  })

  it('shrugs off junk', () => {
    expect(isSessionToken('')).toBe(false)
    expect(isSessionToken('a.b')).toBe(false)
    expect(isSessionToken('not-a-jwt-at-all')).toBe(false)
  })
})

describe('verifySession', () => {
  it('rejects a token signed with a different secret', async () => {
    const token = await mintSession(EMAIL, 'some-other-secret')

    const result = await verifySession(token, SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/signature/i)
  })

  it('rejects a tampered payload', async () => {
    // Swapping the email for someone else's must not survive the signature.
    const token = await mintSession(EMAIL, SECRET)
    const [header, , signature] = token.split('.')
    const forged = btoa(JSON.stringify({ iss: 'abepasion.com', email: 'someone@else.com', exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const result = await verifySession(`${header}.${forged}.${signature}`, SECRET)
    expect(result.ok).toBe(false)
  })

  it('rejects an expired session', async () => {
    const token = await mintSession(EMAIL, SECRET, -60)

    const result = await verifySession(token, SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/expired/i)
  })

  it('says so when the secret is not configured, rather than passing anything', async () => {
    const token = await mintSession(EMAIL, SECRET)

    const result = await verifySession(token, '')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/SESSION_SECRET/)
  })

  it('rejects a malformed token', async () => {
    expect((await verifySession('nonsense', SECRET)).ok).toBe(false)
    expect((await verifySession('a.b', SECRET)).ok).toBe(false)
  })

  it('rotating the secret invalidates every outstanding session', async () => {
    // This is the revocation story — there is no deny-list, so it has to hold.
    const token = await mintSession(EMAIL, SECRET)
    expect((await verifySession(token, SECRET)).ok).toBe(true)
    expect((await verifySession(token, `${SECRET}-rotated`)).ok).toBe(false)
  })
})
