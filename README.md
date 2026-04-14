# Pasionfruit Casino

React + Vite casino app with user bankrolls and leaderboard support.

## Data Modes

- Local fallback mode: if no API is configured or the API is unavailable.
- Remote mode (recommended for production): reads/writes player profiles through a Google Sheets-backed API.

When `VITE_API_BASE_URL` is set, bankroll data is treated as remote-first and local user storage is disabled.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run frontend:

```bash
npm run dev
```

3. Optional: run the local Sheets proxy server (see [server/README.md](server/README.md)):

```bash
npm run server:start
```

The Vite dev server proxies `/profiles` and `/auth` to `http://localhost:4000`.

## Production Hosting On pasionfruit.github.io

GitHub Pages can host only static files, so do not rely on the local Node server in production.

1. Host your backend API separately (for example: Render, Railway, Fly.io, Cloud Run, or a Google Apps Script web app wrapper) with the same endpoints:
- `GET /profiles`
- `POST /profiles`
- `PUT /profiles/:rowIndex`
- `POST /auth/google` (optional, only needed for token verification)

2. Set production env vars before building:

```bash
VITE_API_BASE_URL=https://your-api-host.example.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

3. Build:

```bash
npm run build
```

4. Deploy the generated `dist/` contents to GitHub Pages for this repository.

If this repo is your user site (`Pasionfruit.github.io`), Pages will serve it at:
`https://pasionfruit.github.io/`

## Fully Free Deployment (Recommended)

Use:
- GitHub Pages for frontend (free)
- Google Sheets for data (free)
- Google Apps Script as API layer (free)

1. Create a Google Sheet with a tab named `Profiles` and row 1 headers:
- `Name | Email | Balance`

2. Open Extensions -> Apps Script on that sheet.

3. Paste the script from [apps-script/Code.gs](apps-script/Code.gs).

4. Deploy Apps Script as a web app:
- Execute as: Me
- Who has access: Anyone
- Copy the Web App URL (it ends with `/exec`)

5. In GitHub repository Settings -> Secrets and variables -> Actions -> Variables, set:
- `VITE_API_BASE_URL` = your Apps Script web app URL
- `VITE_API_MODE` = `apps-script`
- `VITE_API_USE_POST_FOR_UPDATES` = `true`
- `VITE_GOOGLE_CLIENT_ID` = your OAuth client id (optional)

6. Push to `main`.
- The workflow at [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) will build and deploy to Pages.

### Important Notes For Free Mode

- Apps Script is used as a Sheets bridge and avoids needing paid server hosting.
- In `apps-script` mode, profile updates are sent as POST with method override for compatibility.
- Google sign-in can still work; if `/auth/google` is not hosted, the app falls back to decoding the Google token payload client-side.

## Notes

- The frontend now syncs profile creation and balance updates back to the remote API.
- If the remote API is unreachable, the app remains usable in-memory for the current session.
