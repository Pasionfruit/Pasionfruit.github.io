# Google Sheets Integration Setup

This project can sync race logs and leaderboard records to Google Sheets.

## 1. Create a Google Sheet

Create a sheet with two tabs:
- `logs`
- `leaderboard`
- `profiles`

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

`profiles` tab headers (row 1):
- `username`
- `passwordHash`
- `role`
- `displayName`

`role` should be one of:
- `admin`
- `user`

## 2. Create Apps Script Web App

Open Extensions > Apps Script and paste this script:

```javascript
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (payload.type === 'auth_create') {
    const sh = ss.getSheetByName('profiles');
    const values = sh.getDataRange().getValues();
    const rows = values.slice(1);
    const username = normalizeUsername(payload.username);
    const passwordHash = String(payload.passwordHash || '').trim();

    if (!username || !passwordHash) {
      return jsonOut({ ok: false, reason: 'missing-credentials' });
    }

    const exists = rows.some(r => normalizeUsername(r[0]) === username);
    if (exists) {
      return jsonOut({ ok: false, reason: 'user-exists' });
    }

    sh.appendRow([
      username,
      passwordHash,
      'user',
      username,
    ]);

    return jsonOut({ ok: true, name: username, role: 'user' });
  }

  if (payload.type === 'auth_login') {
    const sh = ss.getSheetByName('profiles');
    const values = sh.getDataRange().getValues();
    const rows = values.slice(1);
    const username = normalizeUsername(payload.username);
    const passwordHash = String(payload.passwordHash || '').trim();

    const match = rows.find(r => normalizeUsername(r[0]) === username);
    if (!match) {
      return jsonOut({ ok: false, reason: 'unknown-user' });
    }

    const storedHash = String(match[1] || '').trim();
    if (!storedHash || storedHash !== passwordHash) {
      return jsonOut({ ok: false, reason: 'invalid-password' });
    }

    const role = String(match[2] || 'user').trim() || 'user';
    const displayName = String(match[3] || username).trim() || username;

    return jsonOut({
      ok: true,
      name: displayName,
      role,
    });
  }

  if (payload.type === 'log') {
    const sh = ss.getSheetByName('logs');
    sh.appendRow([
      new Date(payload.at || Date.now()),
      payload.eventName || 'unknown',
      (payload.payload && payload.payload.playerName) || 'Guest',
      JSON.stringify(payload.payload || {}),
    ]);
    return jsonOut({ ok: true });
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
    return jsonOut({ ok: true });
  }

  return jsonOut({ ok: false, reason: 'unknown-type' });
}

function doGet(e) {
  const type = (e.parameter.type || '').toLowerCase();
  if (type === 'players') {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheetByName('profiles');
    const values = sh.getDataRange().getValues();

    const players = values.slice(1)
      .map(r => ({
        name: String(r[3] || r[0] || '').trim(),
        role: String(r[2] || 'user').trim() || 'user',
      }))
      .filter(p => p.name);

    return jsonOut({ players });
  }

  if (type !== 'leaderboard') {
    return jsonOut({ ok: false, reason: 'unsupported' });
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

  return jsonOut({ leaderboard: rows });
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
- player login with `auth_login`
- players directory fetch with `type=players`

## 5. Create profile password hashes

Passwords are verified by SHA-256 hash. You should store hashes (not plain text) in `profiles.passwordHash`.

Example to create a hash in browser console:

```javascript
async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

sha256Hex('your-password-here').then(console.log);
```

Use the output value as `passwordHash` in your `profiles` tab.
