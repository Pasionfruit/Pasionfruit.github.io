# Pasionfruit.github.io

Personal website built with React + TypeScript + Vite.

## Local Setup

1. Install dependencies:

```bash
npm ci
```

2. Create `.env` at the project root and set your Sheets API URL:

```env
VITE_SHEETS_API_BASE_URL=https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT/exec
```

3. Start development server:

```bash
npm run dev
```

4. Production build check:

```bash
npm run build
```

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
2. CORS errors:
   - Ensure Apps Script response includes appropriate CORS headers.
3. Old data after deploy:
   - Confirm Actions build used the variable.
   - Hard refresh browser cache.
