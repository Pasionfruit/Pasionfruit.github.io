const SHEETS_WEB_APP_URL = import.meta.env.VITE_SHEETS_WEB_APP_URL || ''
const APP_NAME = 'pasionfruit-world'

function isConfigured() {
  return typeof SHEETS_WEB_APP_URL === 'string' && SHEETS_WEB_APP_URL.trim().length > 0
}

async function postToSheets(body) {
  if (!isConfigured()) return { ok: false, reason: 'missing-url' }

  try {
    const res = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
