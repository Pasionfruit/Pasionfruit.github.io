const SHEETS_WEB_APP_URL = import.meta.env.VITE_SHEETS_WEB_APP_URL || ''
const APP_NAME = 'pasionfruit-world'

function isConfigured() {
  return typeof SHEETS_WEB_APP_URL === 'string' && SHEETS_WEB_APP_URL.trim().length > 0
}

async function postToSheets(body) {
  if (!isConfigured()) return { ok: false, reason: 'missing-url' }

  try {
    // Use text/plain so browser requests remain "simple" and avoid CORS preflight.
    // Apps Script still receives the same JSON string in e.postData.contents.
    const res = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function sendLogEvent(eventName, payload = {}) {
  return postToSheets({
    type: 'log',
    app: APP_NAME,
    eventName,
    payload,
    at: Date.now(),
  })
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function loginWithSheets(username, password) {
  if (!isConfigured()) return { ok: false, reason: 'missing-url' }
  const normalizedUsername = typeof username === 'string' ? username.trim() : ''
  const normalizedPassword = typeof password === 'string' ? password : ''
  if (!normalizedUsername || !normalizedPassword) return { ok: false, reason: 'missing-credentials' }

  try {
    const passwordHash = await sha256Hex(normalizedPassword)
    const payload = {
      type: 'auth_login',
      app: APP_NAME,
      at: Date.now(),
      username: normalizedUsername,
      passwordHash,
    }

    const res = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, reason: 'request-failed' }
    const data = await res.json().catch(() => null)
    if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'invalid-response' }

    return {
      ok: true,
      user: {
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : normalizedUsername,
        role: typeof data.role === 'string' && data.role.trim() ? data.role.trim() : 'user',
      },
    }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function createProfileWithSheets(username, password) {
  if (!isConfigured()) return { ok: false, reason: 'missing-url' }
  const normalizedUsername = typeof username === 'string' ? username.trim() : ''
  const normalizedPassword = typeof password === 'string' ? password : ''
  if (!normalizedUsername || !normalizedPassword) return { ok: false, reason: 'missing-credentials' }

  try {
    const passwordHash = await sha256Hex(normalizedPassword)
    const payload = {
      type: 'auth_create',
      app: APP_NAME,
      at: Date.now(),
      username: normalizedUsername,
      passwordHash,
    }

    const res = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, reason: 'request-failed' }
    const data = await res.json().catch(() => null)
    if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'invalid-response' }

    return {
      ok: true,
      user: {
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : normalizedUsername,
        role: typeof data.role === 'string' && data.role.trim() ? data.role.trim() : 'user',
      },
    }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function fetchPlayersDirectory() {
  if (!isConfigured()) return []
  try {
    const url = `${SHEETS_WEB_APP_URL}?type=players`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    const players = Array.isArray(data?.players) ? data.players : []
    return players
      .filter(player => player && typeof player.name === 'string' && player.name.trim())
      .map(player => ({
        name: player.name.trim(),
        role: typeof player.role === 'string' && player.role.trim() ? player.role.trim() : 'user',
      }))
  } catch {
    return []
  }
}

export async function sendLapRecord(record) {
  return postToSheets({
    type: 'lap',
    app: APP_NAME,
    at: Date.now(),
    record,
  })
}

export async function fetchRemoteLeaderboard() {
  if (!isConfigured()) return []

  try {
    const url = `${SHEETS_WEB_APP_URL}?type=leaderboard`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    const rows = Array.isArray(data?.leaderboard) ? data.leaderboard : []

    return rows
      .filter(row => row && typeof row.ms === 'number' && typeof row.at === 'number')
      .map((row, idx) => ({
        id: typeof row.id === 'string' ? row.id : `remote-${row.at}-${idx}`,
        ms: row.ms,
        at: row.at,
        name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Guest',
      }))
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 8)
  } catch {
    return []
  }
}

export function isSheetsSyncEnabled() {
  return isConfigured()
}
