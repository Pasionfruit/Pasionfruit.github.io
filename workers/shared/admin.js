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
 * Every Worker importing this needs the same two secrets:
 *   npx wrangler secret put ADMIN_EMAIL       # the one authorised account
 *   npx wrangler secret put GOOGLE_CLIENT_ID  # the web client id the site signs in with
 */

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

/**
 * Verify the ID token with Google rather than decoding it locally: signature,
 * expiry, audience and issuer all get checked, and a decoded-but-unverified JWT
 * is trivially forged.
 *
 * Returns `{ ok: true }` or `{ ok: false, reason }` — the reason is safe to
 * return to the caller, since it is the admin or nobody.
 */
export async function verifyAdmin(request, env) {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

  if (!token) {
    return { ok: false, reason: 'Missing bearer token' }
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

  if ((info.email ?? '').toLowerCase() !== (env.ADMIN_EMAIL ?? '').toLowerCase()) {
    return { ok: false, reason: 'Not an authorised account' }
  }

  return { ok: true }
}
