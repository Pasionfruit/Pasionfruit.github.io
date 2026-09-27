/**
 * The single-user auth boundary, shared by every Worker on this account.
 *
 * There is exactly one real user here, so there is exactly one check: verify
 * the browser's Google ID token, match it against the one admin email. This
 * lived copy-pasted in `workers/ace` and `workers/db`, which was survivable at
 * two and would not have been at four — Wardrobe, Markets and Photos each want
 * the same gate, and copies drift.
 *
 * There is a third implementation that cannot share this code:
 * `requireAuthorizedUser_` in `updated_code.gs`, because Apps Script is a
 * separate runtime. If the rules here change, change that one by hand too.
 *
 * Every Worker importing this needs the same three secrets, and SESSION_SECRET
 * must be byte-identical everywhere or a session minted by one Worker will be
 * rejected by the next:
 *   npx wrangler secret put ADMIN_EMAIL       # the one authorised account
 *   npx wrangler secret put GOOGLE_CLIENT_ID  # the web client id the site signs in with
 *   npx wrangler secret put SESSION_SECRET    # same value on every Worker
 */

import { isSessionToken, mintSession, verifySession } from './session.js'

const TOKEN_INFO = 'https://oauth2.googleapis.com/tokeninfo?id_token='

/**
 * CORS + response helpers bound to one Worker's method list.
 *
 * The methods differ per Worker — the Ace gateway reads and posts, the data API
 * also puts and deletes — and it is the only thing that does, so it is bound
 * once here rather than threaded through every call site.
 */
export function createHttp({ methods = 'GET, POST, OPTIONS' } = {}) {
  function corsHeaders(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const allowed = (env.ALLOWED_ORIGINS ?? 'https://abepasion.com')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    return {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
  }

  function json(payload, request, env, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
    })
  }

  function deny(status, message, request, env) {
    return json({ error: message }, request, env, status)
  }

  /** The CORS preflight every browser sends before a cross-origin call. */
  function preflight(request, env) {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) })
  }

  return { corsHeaders, json, deny, preflight }
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function isTheAdmin(email, env) {
  return email === (env.ADMIN_EMAIL ?? '').toLowerCase().trim()
}

/**
 * Accept either credential the browser might be holding: one of our own
 * long-lived sessions, or a fresh Google ID token.
 *
 * The Google path verifies with Google rather than decoding locally, because
 * signature, expiry, audience and issuer all need checking and a
 * decoded-but-unverified JWT is trivially forged. The session path is a local
 * HMAC check — no network call, which is also why the common request is now
 * faster than it was.
 *
 * Returns `{ ok: true, email }` or `{ ok: false, reason }`. The reason is safe
 * to hand back to the caller, since the caller is the admin or nobody.
 */
export async function verifyAdmin(request, env) {
  const token = bearerToken(request)

  if (!token) {
    return { ok: false, reason: 'Missing bearer token' }
  }

  if (isSessionToken(token)) {
    const session = await verifySession(token, env.SESSION_SECRET)
    if (!session.ok) {
      return session
    }
    if (!isTheAdmin(session.email, env)) {
      return { ok: false, reason: 'Not an authorised account' }
    }
    return { ok: true, email: session.email }
  }

  const response = await fetch(TOKEN_INFO + encodeURIComponent(token))
  if (!response.ok) {
    return { ok: false, reason: 'Invalid token' }
  }

  const info = await response.json()

  if (env.GOOGLE_CLIENT_ID && info.aud !== env.GOOGLE_CLIENT_ID) {
    return { ok: false, reason: 'Token was issued for a different client' }
  }

  if (info.email_verified !== 'true' && info.email_verified !== true) {
    return { ok: false, reason: 'Email not verified' }
  }

  const email = (info.email ?? '').toLowerCase().trim()
  if (!isTheAdmin(email, env)) {
    return { ok: false, reason: 'Not an authorised account' }
  }

  return { ok: true, email }
}

/**
 * POST /auth/session — trade a credential for a fresh long-lived session.
 *
 * Takes a Google ID token on first sign-in, and thereafter takes the current
 * session, which is what makes the window sliding: the app re-exchanges on
 * launch, so opening it once a month keeps you signed in indefinitely without
 * Google ever prompting again.
 */
export async function mintSessionRoute(request, env, { json, deny }) {
  if (request.method !== 'POST') {
    return deny(405, 'POST only', request, env)
  }
  if (!env.SESSION_SECRET) {
    return deny(500, 'SESSION_SECRET is not configured on this worker', request, env)
  }

  const auth = await verifyAdmin(request, env)
  if (!auth.ok) {
    return deny(403, auth.reason, request, env)
  }

  const token = await mintSession(auth.email, env.SESSION_SECRET)
  return json({ token }, request, env)
}

/**
 * GET /auth/verify — is this bearer good, and whose is it?
 *
 * Exists for Apps Script, which cannot share this module and would otherwise
 * need its own copy of the HMAC check and the secret. It calls here the same way
 * it already calls Google's tokeninfo, so the secret stays on Cloudflare.
 */
export async function verifyRoute(request, env, { json, deny }) {
  const auth = await verifyAdmin(request, env)
  if (!auth.ok) {
    return deny(403, auth.reason, request, env)
  }
  return json({ ok: true, email: auth.email }, request, env)
}
