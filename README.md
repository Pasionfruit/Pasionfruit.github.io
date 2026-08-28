# Pasionfruit.github.io

Personal website built with React + TypeScript + Vite.

## Site structure

The site has two faces, decided by which Google account is signed in.

### Public (everyone, signed out included)

| Route | What it is |
| --- | --- |
| `/` | Home — intro and the three section tiles |
| `/experiences`, `/experiences/studying` | Resume, education, skills, and actuarial exam prep |
| `/personal-sites` | Deployed side projects, linked out for anyone to try |
| `/gaming`, `/gaming/server` | Games in rotation and the Minecraft server |

### Private (`/admin`, admin Google account only)

| Route | Dashboard | Data source |
| --- | --- | --- |
| `/admin/tasks` | Tasks of the day, yesterday's recap, inbox summary | Todoist (live) + Gmail (needs scope) |
| `/admin/calendar` | Google and Apple calendars merged into one week | Google Calendar / Apple `.ics` (both need setup) |
| `/admin/journal` | Daily entries with mood and tags | Sheets `journal_entries` |
| `/admin/finance` | Budget, spending by category, money calendar | Sheets transaction + budget tabs |
| `/admin/training` | Garmin, RingConn, and Apple Health plus the session log | Sheets health tabs |
| `/admin/work` | Projects, deadlines, morning links | Sheets `work_items` |

`/tasks` (full Todoist manager) and `/weekly-reset` are also admin-only.

Everything under `/admin` is gated by `AdminGate` in [src/App.tsx](src/App.tsx); guests
are redirected to `/`. The dashboards are `noindex` and never load ads.

Removed in the guest/admin split: the Cooking section (superseded by the
standalone POV Cooking site, now linked from Personal Sites) and the public
About Me pages. Old URLs redirect rather than 404.

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
VITE_APPLE_CALENDAR_ICS_URL=
```

See `.env.example` for the full list including the Minecraft server manager.

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

Reads go through the Sheets API v4; writes go through the Apps Script Web App.
The tab names and column ranges are listed in
[src/data/sheets/client.ts](src/data/sheets/client.ts).

Two tabs are new with the admin dashboards and must be created by hand:

| Tab | Header row |
| --- | --- |
| `journal_entries` | `journal_id`, `entry_date`, `title`, `mood`, `body`, `tags`, `created_at` |
| `work_items` | `work_id`, `project`, `item`, `status`, `due_date`, `priority`, `notes`, `link` |

Their write handlers (`createJournalEntry`, `updateWorkItem`, and the rest) are in
[updated_code.gs](updated_code.gs) — redeploy the Apps Script Web App after adding
the tabs, or the dashboards will load empty and saving will report an unknown action.

Older read endpoints still expected:

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

## Viewing the admin dashboards locally

### Without any setup

`npm run dev`, then open `/login`. In development the login page shows a **Local
dev sign-in** block with a button per account — click "Abe (full admin)" and you
land on `/admin` with all six dashboards reachable.

This mints an unsigned token in your browser and nothing more. The app decides
who is admin by reading the `email` claim out of a Google ID token client-side;
the real check is server-side, where Apps Script re-verifies the token against
Google's `tokeninfo` endpoint before touching a sheet. So the shortcut unlocks
the *UI* only — saves still fail with "Invalid token" until you sign in for real.

The block is wrapped in `import.meta.env.DEV`, which Vite replaces with `false`
when building, so none of it reaches production.

With no `.env`, the dashboards render their own empty and error states: Sheets
reads fail (Journal, Work, Finance, Training), Todoist shows its missing-token
message, and Gmail and Calendar show connect panels. That is enough to work on
layout and navigation. Fill in `.env` when you need live data.

### With a real `.env`

Copy `.env.example` to `.env` and fill in the values. Every one already exists —
the deploy workflow reads them from repository settings:

| Variable | Where to find it |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Settings → Secrets and variables → Actions → Variables, or Google Cloud Console → Credentials |
| `VITE_SHEETS_SPREADSHEET_ID` | The `/d/<id>/` segment of the spreadsheet URL |
| `VITE_SHEETS_API_KEY` | Google Cloud Console → Credentials → API keys |
| `VITE_SHEETS_API_BASE_URL` | Apps Script → Deploy → Manage deployments → the `/exec` URL |
| `VITE_TODOIST_API_TOKEN` | Todoist → Settings → Integrations → Developer |

Values stored as Actions **variables** are readable in the repo settings UI;
anything stored as a **secret** cannot be read back and has to be regenerated at
the source. `.env` is gitignored.

Only `VITE_TODOIST_API_TOKEN` needs a dev-server restart to take effect — it
configures a proxy in `vite.config.ts` rather than being read in the browser.

## Gmail and calendar integrations

Both are built but not connected. The dashboards render a panel naming exactly
what is missing instead of an empty list, so a blank inbox is never mistaken for
a quiet one.

- **Gmail** ([src/admin/integrations/gmail.ts](src/admin/integrations/gmail.ts)) —
  needs the `gmail.readonly` scope on the OAuth consent screen and an OAuth flow
  that issues an *access* token. Google Sign-In currently only produces an ID
  token, which carries identity but no API scopes. Once an access token is in
  `sessionStorage` under `gmail-access-token`, mail loads. Reads are metadata-only
  (sender, subject, snippet) and nothing is ever sent or archived.
- **Google Calendar** ([src/admin/integrations/calendars.ts](src/admin/integrations/calendars.ts)) —
  same story with `calendar.readonly` and `google-calendar-access-token`.
- **Apple Calendar** — no public API. The route is a published calendar's `.ics`
  URL, but iCloud serves those without CORS headers, so it has to come through a
  proxy (the existing Cloudflare Worker is the natural place). Point
  `VITE_APPLE_CALENDAR_ICS_URL` at the proxied URL and the parser in
  `calendars.ts` handles the rest. Recurrence rules are not expanded.

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
