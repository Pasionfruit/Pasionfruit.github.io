/**
 * Assistant Ace gateway.
 *
 * Ollama has no authentication whatsoever — anything that can reach it can use
 * the GPU and prompt a model loaded with Abe's mail. So the tunnel hostname is
 * never given to the browser. This Worker sits in front of it and does one job:
 * prove the caller is the admin, then proxy.
 *
 * Auth reuses the site's existing model — the Google ID token the browser
 * already holds — so there is no second credential to distribute, and nothing
 * secret ends up in the public bundle. It is the same check Apps Script does in
 * `requireAuthorizedUser_`.
 *
 * Deploy:
 *   cd workers/ace
 *   npx wrangler secret put OLLAMA_URL      # https://ace-tunnel.example.com
 *   npx wrangler secret put ADMIN_EMAIL     # pasionabe@gmail.com
 *   npx wrangler secret put TUNNEL_CLIENT_ID       # optional, CF Access
 *   npx wrangler secret put TUNNEL_CLIENT_SECRET   # optional, CF Access
 *   npx wrangler deploy
 */

/** Only these reach Ollama; everything else is refused. */
const ALLOWED_PATHS = new Set(['/api/chat', '/api/tags'])

const TOKEN_INFO = 'https://oauth2.googleapis.com/tokeninfo?id_token='

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? 'https://abepasion.com')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function deny(status, message, request, env) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  })
}

/**
 * Verify the ID token with Google rather than decoding it locally: signature,
 * expiry, audience and issuer all get checked, and a decoded-but-unverified JWT
 * is trivially forged.
 */
async function verifyAdmin(request, env) {
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    }

    const url = new URL(request.url)

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return deny(404, 'No such route', request, env)
    }

    if (!env.OLLAMA_URL) {
      return deny(500, 'OLLAMA_URL is not configured on the worker', request, env)
    }

    const auth = await verifyAdmin(request, env)
    if (!auth.ok) {
      return deny(403, auth.reason, request, env)
    }

    const upstream = new Request(new URL(url.pathname, env.OLLAMA_URL), {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        // Present only when the tunnel is behind Cloudflare Access.
        ...(env.TUNNEL_CLIENT_ID
          ? {
              'CF-Access-Client-Id': env.TUNNEL_CLIENT_ID,
              'CF-Access-Client-Secret': env.TUNNEL_CLIENT_SECRET,
            }
          : {}),
      },
      body: request.method === 'POST' ? request.body : undefined,
    })

    let response
    try {
      response = await fetch(upstream)
    } catch {
      return deny(502, 'Ace is not reachable — is Ollama running and the tunnel up?', request, env)
    }

    // Streamed straight through: Ollama emits NDJSON token by token, and
    // buffering it here would cost the responsiveness the local model buys.
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
        ...corsHeaders(request, env),
      },
    })
  },
}
