# Pasionfruit.github.io

Personal website built with React + TypeScript + Vite.

## Local Setup

1. Install dependencies:

```bash
npm ci
```

2. Create `.env` at the project root and set your Sheets variables:

```env
VITE_SHEETS_SPREADSHEET_ID=REPLACE_WITH_YOUR_SPREADSHEET_ID
VITE_SHEETS_API_KEY=REPLACE_WITH_YOUR_GOOGLE_SHEETS_API_KEY
VITE_SHEETS_API_BASE_URL=https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT/exec
VITE_GOOGLE_CLIENT_ID=REPLACE_WITH_YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_TODOIST_API_TOKEN=REPLACE_WITH_YOUR_TODOIST_API_TOKEN
```

3. Start development server:

```bash
npm run dev
```

4. Production build check:

```bash
npm run build
```

## PWA (iPhone + Desktop Install)

This app is now configured as a Progressive Web App with:

- A web app manifest at `/manifest.webmanifest`
- Service worker generated from `src/sw.ts` via `vite-plugin-pwa`
- iOS home screen support via Apple meta tags in `index.html`

### Cache behavior

- Static app assets: cached for fast startup and offline shell access.
- Google Sheets read requests (`https://sheets.googleapis.com`): stale-while-revalidate cache.
- Public CDN world atlas file (`https://cdn.jsdelivr.net`): cached.
- Todoist API and auth-sensitive write flows: network-only.

When offline, the app displays a banner and users should expect read-only cached experiences for supported routes.

### iPhone install steps

1. Deploy the latest `main` to GitHub Pages and open `https://pasionfruit.github.io` in Safari.
2. Tap Share -> Add to Home Screen.
3. Confirm the app icon/title, then launch it from the home screen.
4. Turn on Airplane Mode and re-open to confirm cached shell pages still load.
5. Turn network back on and refresh to sync live data.

### Validation checklist

1. Run `npm run build` and verify `dist/sw.js` and `dist/manifest.webmanifest` exist.
2. In browser DevTools (Application tab), verify Service Worker is activated.
3. Verify no installability warnings for manifest icons and start URL.

## Google Sheets API Setup (Apps Script)

This app expects REST-style read endpoints for these tables:

- `polls`
- `bucket_list`
- `countries`

Expected URL shape:

- `{VITE_SHEETS_API_BASE_URL}/polls`
- `{VITE_SHEETS_API_BASE_URL}/bucket_list`
- `{VITE_SHEETS_API_BASE_URL}/countries`

Accepted response shapes:

1. Array response:

```json
[
  { "poll_id": "1", "question": "..." }
]
```

2. Wrapped response:

```json
{
  "data": [
    { "poll_id": "1", "question": "..." }
  ]
}
```

### Minimum Apps Script Steps

1. Create a Google Sheet with tabs named exactly:
   - `polls`
   - `bucket_list`
   - `countries`
2. Add header row matching schema fields.
3. Create Apps Script project linked to that Sheet.
4. Implement `doGet(e)` routing by path/table name.
5. Deploy as Web App and copy the deployed URL.
6. Put that URL in `VITE_SHEETS_API_BASE_URL`.

### Apps Script Authorization

If your web app returns an error like `You do not have permission to call UrlFetchApp.fetch`, the script has not been authorized for external HTTP requests yet.

1. In Apps Script, save your `Code.gs`.
2. Run a helper that directly calls `UrlFetchApp.fetch` so Apps Script requests the missing scope immediately:

```javascript
function authorizeExternalRequest() {
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=invalid-token',
    { muteHttpExceptions: true }
  )
  Logger.log(response.getResponseCode())
}
```

3. Accept the Google authorization prompt for external requests.
4. Remove the helper if you do not want to keep it.
5. Deploy a new Web App version after authorization.

If you use a manifest file, the required scope is:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
```

### Apps Script Performance

Apps Script writes can feel slow if every admin action re-validates the Google ID token against `tokeninfo`. Cache successful token verification results for a short window to remove that extra roundtrip from repeated actions.

Example replacement for `verifyGoogleIdToken(idToken)`:

```javascript

```

## Environment Files

- `.env.example` contains the template variable.
- `.env` is for local development.
- For production (GitHub Actions), provide the same variable during build.

## GitHub Pages + Actions

If deploying via GitHub Actions, ensure the build step receives `VITE_SHEETS_API_BASE_URL`.

Example build step snippet:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_SHEETS_API_BASE_URL: ${{ vars.VITE_SHEETS_API_BASE_URL }}
```

Then set repository variable:

- Settings -> Secrets and variables -> Actions -> Variables
- Name: `VITE_SHEETS_API_BASE_URL`
- Value: your Apps Script Web App URL

## Troubleshooting

1. Blank cards but no app crash:
   - Check browser network tab for failing `/polls`, `/bucket_list`, `/countries` calls.
   - Verify `VITE_SHEETS_API_BASE_URL` is set and correct.
2. Write actions feel slow:
  - Add `CacheService` token verification caching in Apps Script.
  - The frontend already applies optimistic updates and then refreshes in the background.
3. Old data after deploy:
   - Confirm Actions build used the variable.
   - Hard refresh browser cache.
