export type SheetsWriteResponse = {
  ok: boolean
  error?: string
}

// For public reads: Google Sheets API v4
function getGoogleSheetsConfig() {
  const spreadsheetId = import.meta.env.VITE_SHEETS_SPREADSHEET_ID?.trim()
  const apiKey = import.meta.env.VITE_SHEETS_API_KEY?.trim()
  
  if (!spreadsheetId || !apiKey) {
    throw new Error('Google Sheets API is not configured (missing VITE_SHEETS_SPREADSHEET_ID or VITE_SHEETS_API_KEY)')
  }
  
  return { spreadsheetId, apiKey }
}

// For admin writes: Apps Script endpoint (requires authentication)
function getAppsScriptUrl() {
  const rawUrl = import.meta.env.VITE_SHEETS_API_BASE_URL?.trim() ?? ''

  if (!rawUrl) {
    return ''
  }

  // Apps Script writes must target a deployed Web App URL ending in /exec.
  if (!rawUrl.includes('/macros/s/') || !rawUrl.endsWith('/exec')) {
    throw new Error(
      'VITE_SHEETS_API_BASE_URL must be a deployed Apps Script Web App URL ending with /exec',
    )
  }

  return rawUrl
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

// Google Sheets API response format
interface SheetsApiResponse {
  values?: (string | number | boolean)[][]
}

/**
 * Fetch data from Google Sheets using the Sheets API v4 with public API key.
 * This bypasses Apps Script and works for public read-only access.
 */
export async function fetchSheetTable<T>(tableName: string): Promise<T[]> {
  const { spreadsheetId, apiKey } = getGoogleSheetsConfig()
  
  // Map table names to sheet ranges (all columns, up to 10000 rows)
  const ranges: Record<string, string> = {
    polls: 'polls!A1:Z10000',
    bucket_list: 'bucket_list!A1:D10000',
    countries: 'countries!A1:D10000',
    current_study: 'current_study!A1:H10000',
    training_records: 'training_records!A1:F10000',
    events: 'events!A1:I10000',
    traveling: 'traveling!A1:D10000',
    meal_plan: 'meal_plan!A1:E10000',
    grocery_list: 'grocery_list!A1:D10000',
    abe_transactions: 'abe_transactions!A1:E10000',
    ciara_transactions: 'ciara_transactions!A1:E10000',
    budget_targets: 'budget_targets!A1:C10000',
    personal_training: 'personal_training!A1:D10000',
  }
  
  const range = ranges[tableName]
  if (!range) {
    throw new Error(`Unknown table: ${tableName}`)
  }
  
  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets')
  url.pathname = `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  url.searchParams.set('key', apiKey)
  
  const result = await fetchJson<SheetsApiResponse>(url.toString())
  
  if (!result.values || result.values.length === 0) {
    return []
  }
  
  // First row is headers, remaining rows are data
  const headers = result.values[0] as string[]
  const rows = result.values.slice(1)
  
  // Convert rows to objects
  return rows.map(row => {
    const obj: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null
    })
    return obj as T
  })
}

/**
 * Fire a no-op ping to the Apps Script endpoint so the runtime is warm before
 * the user's first real write. Call once on app mount; errors are silently ignored.
 */
export function warmupAppsScript() {
  let url: string
  try {
    url = getAppsScriptUrl()
  } catch {
    return
  }
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'ping' }),
  }).catch(() => {})
}

/**
 * Post data to Apps Script for authenticated admin operations.
 * This is used for write operations (votes, updates) that require token validation.
 */
export async function postSheetsAction<T>(payload: Record<string, unknown>): Promise<T> {
  const appsScriptUrl = getAppsScriptUrl()
  if (!appsScriptUrl) {
    throw new Error('Apps Script endpoint is not configured (missing VITE_SHEETS_API_BASE_URL)')
  }

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: {
      // Keep this as a simple request so the browser does not send an OPTIONS preflight,
      // which Apps Script web app endpoints do not handle consistently.
      'Content-Type': 'text/plain;charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Admin write failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}