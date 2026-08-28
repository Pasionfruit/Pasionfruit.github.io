# Pasionfruit.github.io

Personal website built with React + TypeScript + Vite.

## Site structure

The site has two faces, decided by which Google account is signed in.

### Public

Everything public lives on the home page as three collapsible sections — there
are no separate section routes any more.

| Section | Anchor | Contents |
| --- | --- | --- |
| Experiences | `/#experiences` | Education, technical skills, professional history, resume downloads |
| Personal Sites | `/#personal-sites` | Deployed side projects, linked out for anyone to try |
| Gaming | `/#gaming` | Minecraft connection guide and live server status with a link to the control dashboard |

Sections start collapsed. The side menu links to each anchor, which expands the
target section and scrolls to it. Collapsed panels keep their content in the DOM
(hidden via the `hidden` attribute) rather than unmounting it, so `/` still ships
the full page to crawlers — it is the only indexed URL on the site.

### Private (admin Google account only)

Signing in as admin replaces the public site entirely — no sections, no
hamburger menu. The top bar becomes an icon nav and `/` becomes the daily
dashboard.

| Nav item | Route | Contents |
| --- | --- | --- |
| Home | `/` | Tasks of the day, yesterday's recap, inbox, and the week's calendar |
| Journal | `/admin/journal` | Daily entries with mood and tags |
| Finance | `/admin/finance` | Budget, spending by category, money calendar |
| Training | `/admin/training` | Garmin, RingConn, and Apple Health plus the session log |
| Work | `/admin/work` | Projects, deadlines, morning links |

The Calendar dashboard was merged into Home rather than getting its own tab, so
`/admin`, `/admin/tasks`, and `/admin/calendar` all redirect to `/`. The full
Todoist manager (`/tasks`) and `/weekly-reset` are linked from the bottom of the
Home dashboard.

Dashboards use `AdminPage` rather than the public `PageFrame` — no hero card and
no back link, since the icon bar is always on screen. Below ~640px the nav labels
drop and the icons carry it.

Access is gated by `AdminGate` in [src/App.tsx](src/App.tsx); guests are
redirected to `/`. The dashboards are `noindex` and never load ads.

### Retired

Removed along the way, with old URLs redirecting rather than 404ing:

- **Cooking** — superseded by the standalone POV Cooking site, linked from Personal Sites.
- **About Me** — the public cats, bucket list, countries, and backpack pages.
- **Studying** — the actuarial exam table, study plan, and pomodoro timer.
- **Games lists and player leaderboards** — along with `scripts/gaming/sync_player_stats.py`,
  the `mc_player_stats` sheet reads, and the `updateMcPlayerStats` Apps Script action.

Because the three sections collapsed into the home page, `/` is now the only
indexed URL and the only one that loads AdSense. Previously the section pages
carried the ads; see `ROUTE_META` in [src/routeMeta.ts](src/routeMeta.ts) to change that.

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
| `journal_entries` | `journal_id`, `entry_date`, `title`, `mood`, `body`, `gratitude`, `prompt`, `reflection`, `tags`, `created_at` |
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

## Journal

Beyond the entry list, the Journal dashboard has:

- **Verse of the day (KJV)** — from a local list in
  [src/admin/journal/verses.ts](src/admin/journal/verses.ts), picked by local
  calendar day. Kept offline rather than fetched: the KJV is public domain, the
  site is a PWA that has to work without a network, and a free Bible API is one
  more thing that can go down. It repeats once past the list length; add verses
  to lengthen the cycle.
- **Mood tracker** — the last 30 days as one bar per day, coloured and sized by
  mood, with a breakdown and average. Gaps are days with no entry.
- **Gratitude prompts** — three "grateful for" lines plus a reflection question
  that rotates daily
  ([src/admin/journal/prompts.ts](src/admin/journal/prompts.ts)). The question
  text is saved with the entry, so an old entry keeps the prompt it was written
  against rather than being re-labelled by whatever falls on that date later.
- **Breathing timer** — box 4-4-4-4, relaxing 4-7-8, or coherent 5-5, over 1 to
  10 minutes, with an expanding ring and a live phase announcement for screen
  readers. The ring animation respects `prefers-reduced-motion`.

The gratitude fields need three new columns on the `journal_entries` sheet
(`gratitude`, `prompt`, `reflection`) and a redeployed Apps Script. Existing
entries without them still load; the fields simply render empty.

## Mobile layout

Every route is checked at 360, 390, 412, and 768px wide, for both the guest and
admin shells, with editors and collapsed sections opened so hidden layout gets
measured too. The check fails on horizontal page overflow or touch targets under
24x24 CSS px.

```bash
npm install --no-save playwright-core   # not a project dependency
npm run dev                             # in another terminal
BASE=http://localhost:5173 node scripts/mobile-audit.mjs
```

It drives the locally installed Chrome, so no browser download is needed; set
`CHROME_PATH` if Chrome lives somewhere unusual.

Notes on the responsive behaviour:

- The admin icon nav drops its labels below 768px and scrolls horizontally
  rather than widening the top bar. The brand wordmark hides too, leaving the
  mark.
- The calendar week is a 7-column grid on desktop and a day list below 960px,
  so the week never has to be scrolled sideways.
- Journal and Work editors stack their paired fields below 512px, and Work rows
  move their controls under the item below 640px.

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
