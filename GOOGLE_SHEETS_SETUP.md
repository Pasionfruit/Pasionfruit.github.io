# Google Sheets Integration Setup

This project can sync race logs and leaderboard records to Google Sheets.

## 1. Create a Google Sheet

Create a sheet with two tabs:
- `logs`
- `leaderboard`

Use headers:

`logs` tab headers (row 1):
- `at`
- `eventName`
- `player`
- `payload`

`leaderboard` tab headers (row 1):
- `at`
- `name`
- `ms`
- `id`

## 2. Create Apps Script Web App

Open Extensions > Apps Script and paste this script:

```javascript
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (payload.type === 'log') {
    const sh = ss.getSheetByName('logs');
    sh.appendRow([
      new Date(payload.at || Date.now()),
      payload.eventName || 'unknown',
      (payload.payload && payload.payload.playerName) || 'Guest',
      JSON.stringify(payload.payload || {}),
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (payload.type === 'lap') {
    const record = payload.record || {};
    const sh = ss.getSheetByName('leaderboard');
    sh.appendRow([
      new Date(record.at || Date.now()),
      record.name || 'Guest',
      Number(record.ms || 0),
      record.id || '',
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, reason: 'unknown-type' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const type = (e.parameter.type || '').toLowerCase();
  if (type !== 'leaderboard') {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, reason: 'unsupported' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('leaderboard');
  const values = sh.getDataRange().getValues();

  const rows = values.slice(1)
    .map((r, i) => ({
      at: r[0] instanceof Date ? r[0].getTime() : Date.now(),
      name: String(r[1] || 'Guest'),
      ms: Number(r[2] || 0),
      id: String(r[3] || `sheet-${i}`),
    }))
    .filter(r => Number.isFinite(r.ms) && r.ms > 0)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 8);

  return ContentService.createTextOutput(JSON.stringify({ leaderboard: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Deploy as Web App:
- Execute as: `Me`
- Who has access: `Anyone`

Copy the Web App URL.

## 3. Configure the app

Create `.env` from `.env.example` and set:

`VITE_SHEETS_WEB_APP_URL=<your-web-app-url>`

Restart Vite after env changes.

## 4. What syncs

- `log` events (session start + lap completed)
- `lap` records on race completion
- leaderboard fetch from sheet on app load
