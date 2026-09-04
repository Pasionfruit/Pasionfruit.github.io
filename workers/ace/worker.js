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
 *   npx wrangler d1 execute ace-system --remote --file schema.sql
 *   npx wrangler secret put OLLAMA_URL      # https://ace-tunnel.example.com
 *   npx wrangler secret put ADMIN_EMAIL     # pasionabe@gmail.com
 *   npx wrangler secret put TUNNEL_CLIENT_ID       # optional, CF Access
 *   npx wrangler secret put TUNNEL_CLIENT_SECRET   # optional, CF Access
 *   npx wrangler deploy
 */

import { createHttp, verifyAdmin } from '../shared/admin.js'

/** Only these reach Ollama; everything else is refused. */
const ALLOWED_PATHS = new Set(['/api/chat', '/api/tags', '/api/tts'])

const { corsHeaders, json, deny, preflight } = createHttp({ methods: 'GET, POST, OPTIONS' })

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Two weeks of samples: enough history for the tab, bounded growth. */
const RETENTION_SECONDS = 14 * 86400
const HISTORY_SECONDS = 24 * 3600
/** History is averaged into buckets this wide before it leaves the worker. */
const HISTORY_BUCKET_SECONDS = 600

const SAMPLE_COLUMNS = [
  'machine', 'at', 'cpu', 'ram_used_gb', 'ram_total_gb',
  'disk_used_gb', 'disk_total_gb', 'gpu', 'uptime_s', 'services', 'mc_state',
]

const SAMPLE_PLACEHOLDERS = SAMPLE_COLUMNS.map(() => '?').join(', ')

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

  const values = [
    machine,
    Math.floor(Date.now() / 1000),
    num(body.cpu),
    num(body.ram_used_gb),
    num(body.ram_total_gb),
    num(body.disk_used_gb),
    num(body.disk_total_gb),
    body.gpu ? String(body.gpu).slice(0, 200) : null,
    num(body.uptime_s),
    JSON.stringify(body.services ?? {}).slice(0, 2000),
    body.mc_state ? String(body.mc_state).slice(0, 40) : null,
  ]

  // The same row lands in both tables: `samples` is the history, and
  // `machine_latest` holds the one row per machine the dashboard reads.
  // Denormalising the newest sample is what makes that read cost one row per
  // machine instead of a scan of the entire history.
  //
  // Retention is not swept here — it runs on the cron trigger below. Doing it
  // on every heartbeat meant a delete per machine per minute, and each one
  // walked the whole table.
  const write = (table) =>
    env.SYSTEM_DB.prepare(
      `INSERT OR REPLACE INTO ${table} (${SAMPLE_COLUMNS.join(', ')}) VALUES (${SAMPLE_PLACEHOLDERS})`,
    ).bind(...values)

  await env.SYSTEM_DB.batch([write('samples'), write('machine_latest')])

  return json({ ok: true }, request, env)
}

/** Latest sample per machine, including long-offline ones. Admin only. */
async function systemMachines(request, env) {
  const auth = await verifyAdmin(request, env)
  if (!auth.ok) return deny(403, auth.reason, request, env)

  const { results } = await env.SYSTEM_DB.prepare('SELECT * FROM machine_latest').all()
  const machines = (results ?? []).map((row) => ({ ...row, services: safeParse(row.services) }))

  return json({ now: Math.floor(Date.now() / 1000), machines }, request, env)
}

/**
 * 24h of CPU and RAM per machine, for the sparklines. Admin only.
 *
 * Split off `/system/machines` because it costs three orders of magnitude more
 * rows to read, and it moves slowly enough that the dashboard refetches it
 * every few minutes rather than every minute. Averaged into ten-minute buckets:
 * a day of once-a-minute samples is far more points than a 240px sparkline can
 * draw, so sending them all only made the response bigger.
 *
 * INDEXED BY is not decoration. Left to choose, SQLite scans the whole table
 * through idx_samples_machine_at — it must sort for the GROUP BY either way, so
 * it sees no reason to prefer the seek — and the cost then grows with retention
 * rather than staying pinned to the 24h window. Forcing the index keeps this
 * read index-only and bounded.
 */
async function systemHistory(request, env) {
  const auth = await verifyAdmin(request, env)
  if (!auth.ok) return deny(403, auth.reason, request, env)

  const since = Math.floor(Date.now() / 1000) - HISTORY_SECONDS
  const { results } = await env.SYSTEM_DB.prepare(
    `SELECT machine, MIN(at) AS at, AVG(cpu) AS cpu, AVG(ram_used_gb) AS ram_used_gb
       FROM samples INDEXED BY idx_samples_at
      WHERE at >= ?
      GROUP BY machine, at / ${HISTORY_BUCKET_SECONDS}
      ORDER BY at ASC`,
  )
    .bind(since)
    .all()

  const history = {}
  for (const row of results ?? []) {
    history[row.machine] = history[row.machine] ?? []
    history[row.machine].push({ at: row.at, cpu: row.cpu, ram_used_gb: row.ram_used_gb })
  }

  return json({ history }, request, env)
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
      return preflight(request, env)
    }

    const url = new URL(request.url)

    if (url.pathname === '/system/report') {
      return systemReport(request, env)
    }

    if (url.pathname === '/system/machines') {
      return systemMachines(request, env)
    }

    if (url.pathname === '/system/history') {
      return systemHistory(request, env)
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

  /**
   * Hourly retention sweep — see `crons` in wrangler.toml.
   *
   * `at` is indexed, so this seeks straight to the expired range instead of
   * walking the table, and on most runs finds nothing to delete.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      env.SYSTEM_DB.prepare('DELETE FROM samples WHERE at < ?')
        .bind(Math.floor(Date.now() / 1000) - RETENTION_SECONDS)
        .run(),
    )
  },
}
