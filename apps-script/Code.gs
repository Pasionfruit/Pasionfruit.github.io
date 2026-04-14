const SHEET_NAME = 'Profiles';

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Missing sheet: ' + SHEET_NAME);
  return sheet;
}

function readProfiles() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i += 1) {
    const rowIndex = i + 2;
    const row = values[i];
    const name = String(row[0] || '').trim();
    const email = String(row[1] || '').trim();
    const balance = Number(row[2] || 0);

    if (!name && !email && !Number.isFinite(balance)) continue;

    rows.push({ rowIndex: rowIndex, name: name, email: email, balance: Number.isFinite(balance) ? balance : 0 });
  }

  return rows;
}

function appendProfile(payload) {
  const sheet = getSheet();
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const balance = Number(payload.balance || 0);

  sheet.appendRow([name, email, Number.isFinite(balance) ? balance : 0]);
  const rowIndex = sheet.getLastRow();

  return { rowIndex: rowIndex, updatedRange: 'Profiles!A' + rowIndex + ':C' + rowIndex };
}

function updateProfile(rowIndex, payload) {
  const sheet = getSheet();
  const target = Number(rowIndex);
  if (!Number.isFinite(target) || target < 2) throw new Error('Invalid row index');

  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const balance = Number(payload.balance || 0);

  sheet.getRange(target, 1, 1, 3).setValues([[name, email, Number.isFinite(balance) ? balance : 0]]);

  return { rowIndex: target, updatedRange: 'Profiles!A' + target + ':C' + target };
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function sendJson(payload) {
  const out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function doGet(e) {
  try {
    const pathInfo = String((e && e.pathInfo) || '').replace(/^\/+/, '');

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
    const pathInfo = String((e && e.pathInfo) || '').replace(/^\/+/, '');
    const body = parseRequestBody(e);
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
