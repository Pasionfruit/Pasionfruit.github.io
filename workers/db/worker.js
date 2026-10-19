/**
 * Data API for abepasion.com, backed by Cloudflare D1 — the migration target
 * off Google Sheets.
 *
 * Per-table access: `read: 'public'` mirrors the old public Sheets key;
 * `read: 'admin'` (finance data) requires the admin's Google ID token, which
 * every write requires regardless.
 *
 * Routes: GET/POST/PUT/DELETE /db/<table>. Only tables declared below exist.
 * Also GET/POST/DELETE /photos/<id>, the timeline's image bytes in R2 (photos.js).
 * Also POST /auth/session and GET /auth/verify — this Worker is where the
 * browser trades a Google ID token for a long-lived session, and where Apps
 * Script checks one. Both live here rather than in the Ace gateway because the
 * site already calls this Worker for data on every page.
 * Secrets: ADMIN_EMAIL, GOOGLE_CLIENT_ID, SESSION_SECRET (same values as
 * workers/ace), and MINITE_INGEST_KEY, the desktop's write-only key for
 * `youtube_videos` (the same value as ingest_key in MiniteThoughts'
 * config/site.toml).
 */

import { bearerToken, createHttp, mintSessionRoute, verifyAdmin, verifyRoute } from '../shared/admin.js'
import { photoRoute } from './photos.js'

const { json, deny, preflight, corsHeaders } = createHttp({ methods: 'GET, POST, PUT, DELETE, OPTIONS' })

/**
 * key: primary key column, or an array for composite keys.
 * auto: key is INTEGER AUTOINCREMENT — POST omits it, PUT/DELETE require it.
 * ints: stored as 0/1; reals: stored as numbers.
 */
const TABLES = {
  meal_plan: {
    key: 'day_of_the_week',
    columns: ['day_of_the_week', 'breakfast', 'lunch', 'dinner', 'snack'],
    read: 'public',
  },
  grocery_list: {
    key: 'item',
    columns: ['item', 'type', 'completed', 'include'],
    ints: ['completed', 'include'],
    read: 'public',
  },
  current_study: {
    key: 'study_id',
    columns: ['study_id', 'related_exam', 'topic', 'date', 'completed'],
    ints: ['completed'],
    read: 'public',
  },
  training_records: {
    key: 'training_id',
    columns: ['training_id', 'date', 'morning_workout', 'evening_workout', 'completed_morning', 'completed_evening'],
    ints: ['completed_morning', 'completed_evening'],
    read: 'public',
  },
  journal_entries: {
    key: 'journal_id',
    columns: ['journal_id', 'entry_date', 'mood', 'title', 'body', 'gratitude', 'prompt', 'reflection', 'tags', 'created_at'],
    read: 'admin',
  },
  // The countdown's events, moved off the deleted `events` sheet tab. Title and
  // date only; public because the guest home page shows the countdown too.
  events: {
    key: 'event_id',
    columns: ['event_id', 'event_name', 'event_date'],
    read: 'public',
  },
  // One row per published Minite Thoughts video: the latest analytics
  // snapshot as JSON, for the YouTube dashboard. Written from the desktop by
  // `minite results` with MINITE_INGEST_KEY, which can write this table and
  // nothing else; read by the admin only.
  youtube_videos: {
    key: 'video_id',
    columns: ['video_id', 'title', 'published_at', 'fetched_at', 'snapshot'],
    read: 'admin',
    ingestKey: 'MINITE_INGEST_KEY',
  },
  // The Ciara page's timeline: one row per photo, with the image itself in R2
  // (see photos.js). Admin-only, both ways.
  timeline_photos: {
    key: 'photo_id',
    columns: ['photo_id', 'taken_at', 'caption', 'created_at'],
    read: 'admin',
  },
  // The Ciara page's sticky notes: one row per colour (yellow, blue, pink).
  // Admin-only, both ways.
  sticky_notes: {
    key: 'note_id',
    columns: ['note_id', 'color', 'body', 'updated_at'],
    read: 'admin',
  },
  // No finance tables: the Finance dashboard was removed, and that data never
  // belonged on Cloudflare.
}

/**
 * Does this request carry the table's ingest key? Only for creating or
 * replacing rows: an ingest key never reads, deletes, or touches another table.
 */
function isIngest(request, env, table) {
  const secret = table.ingestKey ? env[table.ingestKey] : ''
  if (!secret || (request.method !== 'POST' && request.method !== 'PUT')) return false
  return sameSecret(bearerToken(request), secret)
}

/** Constant-time string comparison, so the key cannot be guessed a byte at a time. */
function sameSecret(given, expected) {
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

function keyColumns(table) {
  return Array.isArray(table.key) ? table.key : [table.key]
}

/** Coerce a value for storage according to the table's column types. */
function storageValue(table, column, value) {
  if ((table.ints ?? []).includes(column)) {
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0
  }
  if ((table.reals ?? []).includes(column)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return String(value ?? '')
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return preflight(request, env)
    }

    const url = new URL(request.url)

    // Sign-in plumbing, before the table router: these are not tables.
    if (url.pathname === '/auth/session') {
      return mintSessionRoute(request, env, { json, deny })
    }
    if (url.pathname === '/auth/verify') {
      return verifyRoute(request, env, { json, deny })
    }

    if (url.pathname.startsWith('/photos/')) {
      return photoRoute(request, env, { json, deny, corsHeaders })
    }

    const match = /^\/db\/([a-z_]+)$/.exec(url.pathname)
    if (!match || !TABLES[match[1]]) {
      return deny(404, 'No such route', request, env)
    }

    const name = match[1]
    const table = TABLES[name]
    const keys = keyColumns(table)

    if (request.method === 'GET') {
      if (table.read !== 'public') {
        const auth = await verifyAdmin(request, env)
        if (!auth.ok) return deny(403, auth.reason, request, env)
      }
      const { results } = await env.DB.prepare(`SELECT * FROM ${name}`).all()
      return json({ rows: results ?? [] }, request, env)
    }

    const auth = isIngest(request, env, table) ? { ok: true } : await verifyAdmin(request, env)
    if (!auth.ok) return deny(403, auth.reason, request, env)

    let body = {}
    try {
      body = await request.json()
    } catch {
      if (request.method !== 'DELETE') return deny(400, 'Invalid JSON', request, env)
    }

    const whereClause = keys.map((k) => `${k} = ?`).join(' AND ')

    if (request.method === 'POST' && table.auto) {
      // Auto-key create: the database assigns the id.
      const cols = table.columns.filter((c) => c !== table.key)
      const values = cols.map((c) => storageValue(table, c, body[c]))
      const result = await env.DB.prepare(
        `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      )
        .bind(...values)
        .run()
      return json({ ok: true, id: result.meta?.last_row_id ?? null }, request, env)
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      const keyValues = keys.map((k) => String(body[k] ?? '').trim())
      if (keyValues.some((v) => !v)) {
        return deny(400, `${keys.join(', ')} required`, request, env)
      }

      // Single-key tables may rename via original_<key>.
      if (request.method === 'PUT' && keys.length === 1 && !table.auto) {
        const original = String(body[`original_${keys[0]}`] ?? keyValues[0]).trim()
        if (original !== keyValues[0]) {
          await env.DB.prepare(`DELETE FROM ${name} WHERE ${whereClause}`).bind(original).run()
        }
      }

      const values = table.columns.map((column) => {
        const keyIndex = keys.indexOf(column)
        if (keyIndex >= 0) {
          return table.auto ? Number(keyValues[keyIndex]) : keyValues[keyIndex]
        }
        return storageValue(table, column, body[column])
      })
      await env.DB.prepare(
        `INSERT OR REPLACE INTO ${name} (${table.columns.join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`,
      )
        .bind(...values)
        .run()

      return json({ ok: true }, request, env)
    }

    if (request.method === 'DELETE') {
      const keyValues = keys.map((k) => String(body[k] ?? url.searchParams.get(k) ?? '').trim())
      if (keyValues.some((v) => !v)) {
        return deny(400, `${keys.join(', ')} required`, request, env)
      }
      await env.DB.prepare(`DELETE FROM ${name} WHERE ${whereClause}`)
        .bind(...(table.auto ? keyValues.map(Number) : keyValues))
        .run()
      return json({ ok: true }, request, env)
    }

    return deny(405, 'Method not allowed', request, env)
  },
}
