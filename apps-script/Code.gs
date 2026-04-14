const SHEET_NAME = 'Profiles';
const HEADERS = ['Name', 'Email', 'Balance', 'PasswordHash', 'AuthProvider', 'GoogleId'];

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Missing sheet: ' + SHEET_NAME);
  return sheet;
}

function ensureSchema() {
  const sheet = getSheet();
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const existing = headerRange.getValues()[0];

  let needsUpdate = false;
  for (let i = 0; i < HEADERS.length; i += 1) {
    if (String(existing[i] || '').trim() !== HEADERS[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    headerRange.setValues([HEADERS]);
  }
}

function readProfiles() {
  ensureSchema();
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i += 1) {
    const rowIndex = i + 2;
    const row = values[i];
    const name = String(row[0] || '').trim();
    const email = String(row[1] || '').trim();
    const balance = Number(row[2] || 0);
    const passwordHash = String(row[3] || '').trim();
    const authProvider = String(row[4] || '').trim() || 'local';
    const googleId = String(row[5] || '').trim();

    if (!name && !email && !passwordHash && !googleId && !Number.isFinite(balance)) continue;

    rows.push({
      rowIndex: rowIndex,
      name: name,
      email: email,
      balance: Number.isFinite(balance) ? balance : 0,
      passwordHash: passwordHash,
      authProvider: authProvider,
      googleId: googleId,
    });
  }

  return rows;
}

function appendProfile(payload) {
  ensureSchema();
  const sheet = getSheet();
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const balance = Number(payload.balance || 0);
  const passwordHash = String(payload.passwordHash || '').trim();
  const authProvider = String(payload.authProvider || '').trim() || 'local';
  const googleId = String(payload.googleId || '').trim();

  sheet.appendRow([
    name,
    email,
    Number.isFinite(balance) ? balance : 0,
    passwordHash,
    authProvider,
    googleId,
  ]);
  const rowIndex = sheet.getLastRow();

  return { rowIndex: rowIndex, updatedRange: 'Profiles!A' + rowIndex + ':F' + rowIndex };
}

function updateProfile(rowIndex, payload) {
  ensureSchema();
  const sheet = getSheet();
  const target = Number(rowIndex);
  if (!Number.isFinite(target) || target < 2) throw new Error('Invalid row index');

  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const balance = Number(payload.balance || 0);
  const passwordHash = String(payload.passwordHash || '').trim();
  const authProvider = String(payload.authProvider || '').trim() || 'local';
  const googleId = String(payload.googleId || '').trim();

  sheet.getRange(target, 1, 1, HEADERS.length).setValues([[
    name,
    email,
    Number.isFinite(balance) ? balance : 0,
    passwordHash,
    authProvider,
    googleId,
  ]]);

  return { rowIndex: target, updatedRange: 'Profiles!A' + target + ':F' + target };
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function getRequestPayload(e) {
  const fromBody = parseRequestBody(e);
  if (Object.keys(fromBody).length > 0) return fromBody;

  const p = (e && e.parameter) || {};
  return {
    _method: p._method || '',
    name: p.name || '',
    email: p.email || '',
    balance: p.balance || 0,
    passwordHash: p.passwordHash || '',
    authProvider: p.authProvider || '',
    googleId: p.googleId || '',
  };
}

function sendJson(payload) {
  const out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getRoutePath(e) {
  const byQuery = String((e && e.parameter && e.parameter.path) || '').trim();
  if (byQuery) return byQuery.replace(/^\/+/, '').replace(/\/+$/, '');

  const byPathInfo = String((e && e.pathInfo) || '').trim();
  return byPathInfo.replace(/^\/+/, '').replace(/\/+$/, '');
}

function doGet(e) {
  try {
    const pathInfo = getRoutePath(e);
    const body = getRequestPayload(e);
    const parts = pathInfo.split('/').filter(Boolean);

    // Query-based mutation fallback for Apps Script web app compatibility.
    if (parts.length === 1 && parts[0] === 'profiles' && String(body._method || '').toUpperCase() === 'POST') {
      return sendJson(appendProfile(body));
    }

    if (parts.length === 2 && parts[0] === 'profiles' && String(body._method || '').toUpperCase() === 'PUT') {
      return sendJson(updateProfile(parts[1], body));
    }

    if (!pathInfo || pathInfo === 'profiles') {
      return sendJson(readProfiles());
    }

    return sendJson({ error: 'Not found' });
  } catch (err) {
    return sendJson({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const pathInfo = getRoutePath(e);
    const body = getRequestPayload(e);
    const parts = pathInfo.split('/').filter(Boolean);

    // Create profile: POST /profiles
    if (parts.length === 1 && parts[0] === 'profiles') {
      return sendJson(appendProfile(body));
    }

    // Update profile: POST /profiles/:rowIndex with { _method: 'PUT', ... }
    if (parts.length === 2 && parts[0] === 'profiles') {
      if (String(body._method || '').toUpperCase() !== 'PUT') {
        return sendJson({ error: 'Method not allowed' });
      }
      return sendJson(updateProfile(parts[1], body));
    }

    return sendJson({ error: 'Not found' });
  } catch (err) {
    return sendJson({ error: String(err) });
  }
}
