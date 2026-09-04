/**
 * Data API for abepasion.com, backed by Cloudflare D1 — the migration target
 * off Google Sheets.
 *
 * Per-table access: `read: 'public'` mirrors the old public Sheets key;
 * `read: 'admin'` (finance data) requires the admin's Google ID token, which
 * every write requires regardless.
 *
 * Routes: GET/POST/PUT/DELETE /db/<table>. Only tables declared below exist.
 * Secrets: ADMIN_EMAIL, GOOGLE_CLIENT_ID (same values as workers/ace).
 */

import { createHttp, verifyAdmin } from '../shared/admin.js'

const { json, deny, preflight } = createHttp({ methods: 'GET, POST, PUT, DELETE, OPTIONS' })

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
  // Finances deliberately stay in Google Sheets — Abe's call: that data does
  // not live on Cloudflare. Do not add transaction or budget tables here.
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

    const auth = await verifyAdmin(request, env)
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
