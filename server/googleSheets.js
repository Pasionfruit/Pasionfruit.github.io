import { readFileSync } from 'fs'
import { google } from 'googleapis'

const CREDENTIALS_PATH = './server/credentials.json'
const SHEET_RANGE = 'Profiles!A2:F1000'

function getSheetId() {
  return process.env.SHEET_ID
}

function getAuthClient() {
  const content = readFileSync(CREDENTIALS_PATH, 'utf8')
  const creds = JSON.parse(content)
  const jwt = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets'],
  )
  return jwt
}

async function loadProfiles() {
  const auth = getAuthClient()
  await auth.authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  const sheetId = getSheetId()
  if (!sheetId) throw new Error('Missing required parameters: spreadsheetId')
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
  })

  const rows = resp.data.values || []
  // Debugging: log how many rows we found from the sheet
  // eslint-disable-next-line no-console
  console.log(`googleSheets: loadProfiles returned ${rows.length} row(s) from range ${SHEET_RANGE}`)
  return rows.map((r, idx) => ({
    rowIndex: idx + 2,
    name: r[0] || '',
    email: r[1] || '',
    balance: Number(r[2] || 0),
    passwordHash: r[3] || '',
    authProvider: r[4] || 'local',
    googleId: r[5] || '',
  }))
}

// Return the raw API response for debugging (values, etc.)
async function loadProfilesRaw() {
  const auth = getAuthClient()
  await auth.authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  const sheetId = getSheetId()
  if (!sheetId) throw new Error('Missing required parameters: spreadsheetId')
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
  })

  return resp.data
}

async function appendProfile({ name, email, balance, passwordHash, authProvider, googleId }) {
  const auth = getAuthClient()
  await auth.authorize()
  const sheets = google.sheets({ version: 'v4', auth })

  const values = [[
    name || '',
    email || '',
    typeof balance === 'number' ? balance : Number(balance || 0),
    passwordHash || '',
    authProvider || 'local',
    googleId || '',
  ]]
  const sheetId = getSheetId()
  if (!sheetId) throw new Error('Missing required parameters: spreadsheetId')
  const resp = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })

  const updatedRange = resp.data?.updates?.updatedRange || ''
  const match = updatedRange.match(/![A-Z]+(\d+):/)
  const rowIndex = match ? Number(match[1]) : null

  return { updatedRange, rowIndex }
}

async function updateProfile(rowIndex, { name, email, balance, passwordHash, authProvider, googleId }) {
  const auth = getAuthClient()
  await auth.authorize()
  const sheets = google.sheets({ version: 'v4', auth })

  const range = `Profiles!A${rowIndex}:F${rowIndex}`
  const values = [[
    name || '',
    email || '',
    typeof balance === 'number' ? balance : Number(balance || 0),
    passwordHash || '',
    authProvider || 'local',
    googleId || '',
  ]]
  const sheetId = getSheetId()
  if (!sheetId) throw new Error('Missing required parameters: spreadsheetId')
  const resp = await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })

  return { updatedRange: resp.data.updatedRange }
}

export { loadProfiles, appendProfile, updateProfile, loadProfilesRaw }
