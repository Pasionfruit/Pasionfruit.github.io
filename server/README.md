Setup

1. Create a Google Cloud project and a service account with "Editor" or "Sheets API" permissions.
2. Create a service account key (JSON) and place it at `server/credentials.json`.
3. Create a Google Sheet and add a sheet named `Profiles` with headers in row 1: `Name | Email | Balance`.
4. Set environment variable SHEET_ID to the sheet ID (in .env or in your environment).

Start server

You can either pass SHEET_ID on the command line or store it in a `.env` file at the repo root (the project includes a sample `.env`). Example contents:

SHEET_ID=1abcDEFghi_jKlmnoPQRstUVwxYZ
PORT=4000

Run the server:

  SHEET_ID=<your-sheet-id> npm run server:start

or using the .env file you created:

  npm run server:start

API

GET /profiles
POST /profiles { name, email, balance }
PUT /profiles/:rowIndex { name, email, balance }

Notes

- `POST /profiles` returns `{ updatedRange, rowIndex }`.
- This server is for local/dev use. For GitHub Pages production, host this API on a separate backend URL and set `VITE_API_BASE_URL` in the frontend build.
