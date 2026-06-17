/**
 * Add this case inside your Apps Script doPost() action router.
 *
 * Setup (one-time):
 *  1. In Apps Script → Project Settings → Script Properties, add:
 *       GITHUB_TOKEN  →  a GitHub personal access token with "repo" scope
 *                        Profile picture → Settings → Developer settings (bottom of sidebar)
 *                        → Personal access tokens → Tokens (classic) → Generate new token (classic)
 *                        → check "repo" scope → copy the token
 *  2. In your GitHub repo → Settings → Secrets → Actions, add:
 *       ATERNOS_USERNAME  →  your Aternos login email
 *       ATERNOS_PASSWORD  →  your Aternos password
 *  3. Deploy / re-deploy this Apps Script Web App so the new case is live.
 *
 * Sheet setup:
 *  Create a tab named exactly  mc_server_log  with row 1 headers:
 *    timestamp | player_name | auto_started
 */

case 'mcServerStart': {
  const playerName = data.playerName || 'unknown';
  const timestamp  = data.timestamp  || new Date().toISOString();

  // ── 1. Log to sheet ──────────────────────────────────────────────────────
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID); // reuse your existing ID constant
  let   sheet = ss.getSheetByName('mc_server_log');
  if (!sheet) {
    sheet = ss.insertSheet('mc_server_log');
    sheet.appendRow(['timestamp', 'player_name', 'auto_started']);
  }

  // ── 2. Trigger GitHub Actions to auto-start the server ───────────────────
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  let   autoStarted = false;

  if (token) {
    try {
      const ghResponse = UrlFetchApp.fetch(
        'https://api.github.com/repos/Pasionfruit/Pasionfruit.github.io/dispatches',
        {
          method:  'post',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Accept':        'application/vnd.github+json',
            'Content-Type':  'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          payload: JSON.stringify({
            event_type:     'mc-server-start',
            client_payload: { player_name: playerName },
          }),
          muteHttpExceptions: true,
        }
      );
      // GitHub returns 204 No Content on success
      autoStarted = ghResponse.getResponseCode() === 204;
    } catch (e) {
      Logger.log('GitHub dispatch failed: ' + e.message);
    }
  }

  sheet.appendRow([timestamp, playerName, autoStarted]);

  // ── 3. Email notification ─────────────────────────────────────────────────
  const statusLine = autoStarted
    ? 'GitHub Actions has been triggered — the server should be online in ~2 minutes.'
    : 'Auto-start was NOT triggered (check GITHUB_TOKEN). Start the server manually on Aternos.';

  GmailApp.sendEmail(
    'pasionabe@gmail.com',
    '🎮 MC Server — ' + playerName + ' wants to play',
    playerName + ' clicked Start Server.\n\n' + statusLine + '\n\nServer address: pasionabe.aternos.me\nAternos panel: https://aternos.org/server/pasionabe',
    { name: 'MC Server Bot' }
  );

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, serverStarted: autoStarted }))
    .setMimeType(ContentService.MimeType.JSON);
}
