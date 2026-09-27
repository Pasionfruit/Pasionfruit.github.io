/**
 * Long-lived sign-in sessions, so a PWA does not log itself out.
 *
 * A Google ID token lasts an hour. Using it as the session meant reopening the
 * installed app after lunch landed on a signed-out site, and the One Tap
 * `auto_select` fallback cannot rescue it: a standalone PWA gets its own
 * storage partition, so there is usually no Google session in there to select
 * from. Silent renewal works in a browser tab and fails on the home screen,
 * which is exactly where it was needed.
 *
 * So Google proves who you are once, and this issues the session: a JWT of our
 * own, HMAC-signed with SESSION_SECRET, carrying the same `email` and `exp`
 * claims a Google ID token does. That shape is deliberate — the browser decodes
 * it with the same helper, and every Worker verifies it through the same
 * `verifyAdmin` call, so nothing downstream had to learn a second format.
 *
 * Revocation is by rotation: change SESSION_SECRET and every outstanding
 * session dies at once. There is no deny-list, because for one user a kill
 * switch beats a table.
 *
 * Trade-off worth naming: a 30-day bearer token in localStorage is a longer
 * window than a 1-hour one. XSS on this origin was already game over — it could
 * read the old token too — but it now yields a month instead of an hour. The
 * mitigation is rotation, not expiry.
 */

const ISSUER = 'abepasion.com'

/** Long enough to stop the logouts; short enough that rotation matters. */
export const SESSION_TTL_SECONDS = 30 * 86400

const encoder = new TextEncoder()

function base64UrlFromBytes(bytes) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64Url(text) {
  return base64UrlFromBytes(encoder.encode(text))
}

function bytesFromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const full = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  return Uint8Array.from(atob(full), (char) => char.charCodeAt(0))
}

function textFromBase64Url(value) {
  return new TextDecoder().decode(bytesFromBase64Url(value))
}

function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )
}

/** Header and payload, or null if this is not a readable JWT. */
function readClaims(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    return {
      header: JSON.parse(textFromBase64Url(parts[0])),
      payload: JSON.parse(textFromBase64Url(parts[1])),
      signed: `${parts[0]}.${parts[1]}`,
      signature: parts[2],
    }
  } catch {
    return null
  }
}

/**
 * Whether this token is one of ours rather than Google's.
 *
 * Google signs ID tokens with RS256, so the algorithm alone separates them; the
 * issuer check is belt and braces against a token from somewhere else that also
 * happens to be symmetric.
 */
export function isSessionToken(token) {
  const claims = readClaims(token)
  return Boolean(claims && claims.header.alg === 'HS256' && claims.payload.iss === ISSUER)
}

export async function mintSession(email, secret, ttlSeconds = SESSION_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iss: ISSUER,
      sub: email,
      email,
      // Mirrors the Google claim so the browser's existing decode path, which
      // reads `email` and `exp`, needs no special case for our tokens.
      email_verified: true,
      iat: now,
      exp: now + ttlSeconds,
    }),
  )

  const signed = `${header}.${payload}`
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), encoder.encode(signed))

  return `${signed}.${base64UrlFromBytes(new Uint8Array(signature))}`
}

/**
 * Verify signature and expiry. Returns the email it carries; the caller decides
 * whether that email is allowed, so this stays a pure token check.
 */
export async function verifySession(token, secret) {
  const claims = readClaims(token)
  if (!claims) {
    return { ok: false, reason: 'Malformed session token' }
  }
  if (claims.header.alg !== 'HS256' || claims.payload.iss !== ISSUER) {
    return { ok: false, reason: 'Not a session token' }
  }
  if (!secret) {
    return { ok: false, reason: 'SESSION_SECRET is not configured on this worker' }
  }

  // crypto.subtle.verify compares in constant time; never hand-roll this.
  const matches = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, ['verify']),
    bytesFromBase64Url(claims.signature),
    encoder.encode(claims.signed),
  )
  if (!matches) {
    return { ok: false, reason: 'Session signature does not match' }
  }

  const exp = claims.payload.exp
  if (typeof exp !== 'number' || exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'Session expired' }
  }

  return { ok: true, email: String(claims.payload.email ?? '').toLowerCase().trim() }
}
