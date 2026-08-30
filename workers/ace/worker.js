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
const ALLOWED_PATHS = new Set(['/api/chat', '/api/tags', '/api/tts'])

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

function json(payload, request, env, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  })
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Heartbeat ingest from machine agents; authenticated by the shared key. */
async function systemReport(request, env) {
  if (request.method !== 'POST') return deny(405, 'POST only', request, env)
  if (!env.REPORT_KEY || request.headers.get('X-Report-Key') !== env.REPORT_KEY) {
    return deny(403, 'Bad report key', request, env)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return deny(400, 'Invalid JSON', request, env)
  }

  const machine = String(body.machine ?? '').slice(0, 64)
  if (!machine) return deny(400, 'machine is required', request, env)

  const at = Math.floor(Date.now() / 1000)
  await env.SYSTEM_DB.prepare(
    `INSERT OR REPLACE INTO samples
       (machine, at, cpu, ram_used_gb, ram_total_gb, disk_used_gb, disk_total_gb, gpu, uptime_s, services, mc_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      machine,
      at,
      num(body.cpu),
      num(body.ram_used_gb),
      num(body.ram_total_gb),
      num(body.disk_used_gb),
      num(body.disk_total_gb),
      body.gpu ? String(body.gpu).slice(0, 200) : null,
      num(body.uptime_s),
      JSON.stringify(body.services ?? {}).slice(0, 2000),
      body.mc_state ? String(body.mc_state).slice(0, 40) : null,
    )
    .run()

  // Keep two weeks of samples so the tab has history without unbounded growth.
  await env.SYSTEM_DB.prepare('DELETE FROM samples WHERE at < ?').bind(at - 14 * 86400).run()

  return json({ ok: true }, request, env)
}

/** Latest sample per machine (even long-offline ones) plus 24h history. Admin only. */
async function systemMachines(request, env) {
  const auth = await verifyAdmin(request, env)
  if (!auth.ok) return deny(403, auth.reason, request, env)

  const latest = await env.SYSTEM_DB.prepare(
    `SELECT s.* FROM samples s
       JOIN (SELECT machine, MAX(at) AS mat FROM samples GROUP BY machine) m
         ON s.machine = m.machine AND s.at = m.mat`,
  ).all()

  const since = Math.floor(Date.now() / 1000) - 24 * 3600
  const history = await env.SYSTEM_DB.prepare(
    'SELECT machine, at, cpu, ram_used_gb FROM samples WHERE at >= ? ORDER BY at ASC',
  )
    .bind(since)
    .all()

  const machines = {}
  for (const row of latest.results ?? []) {
    machines[row.machine] = { ...row, services: safeParse(row.services), history: [] }
  }
  for (const row of history.results ?? []) {
    machines[row.machine]?.history.push({ at: row.at, cpu: row.cpu, ram_used_gb: row.ram_used_gb })
  }

  return json({ now: Math.floor(Date.now() / 1000), machines: Object.values(machines) }, request, env)
}

function safeParse(text) {
  try {
    return JSON.parse(text ?? '{}')
  } catch {
    return {}
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    }

    const url = new URL(request.url)

    if (url.pathname === '/system/report') {
      return systemReport(request, env)
    }

    if (url.pathname === '/system/machines') {
      return systemMachines(request, env)
    }

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
