# Health Data Ingestion Scripts

Sync Garmin, Ringconn, and Apple Health data into Google Sheets so the Training Data Analysis page can read and display it.

## One-time setup

### 1. Python environment
```bash
cd scripts/health-ingestion
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Google service account
The scripts write to Sheets using a **service account** (separate from the web app's public API key).

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Click **Create Credentials** → **Service Account** → fill in a name → Done
3. Click the new service account → **Keys** tab → **Add Key** → JSON → download the file
4. In Google Cloud Console, enable the **Google Sheets API** for your project
5. **Share your spreadsheet** with the service account email (looks like `name@project.iam.gserviceaccount.com`) — give it **Editor** access

### 3. Config file
```bash
cp config.env.example config.env
# Edit config.env with your paths and credentials
```

### 4. Sheet tabs

**The Garmin tabs create themselves.** `ingest_garmin.py` and
`ingest_garmin_wellness.py` call `ensure_worksheet`, which adds the tab with its
header row if it is missing — so deleting a Garmin tab costs a re-run, not a
hand-rebuilt header. They also backfill the header row on a tab that exists but
is empty, which otherwise writes blank rows silently.

The Ringconn and Apple tabs still have to be made by hand.

Headers, for reference or manual creation:

**`garmin_health`** (row 1) — one row per activity:
```
date  activity_type  title  distance_mi  duration_min  avg_hr  max_hr  calories  tss  activity_id
```
`activity_id` is Garmin's id for the activity and the key the API sync upserts
on, so two workouts on one day keep a row each. The sync adds the column itself
if it is missing and keeps it formatted as plain text.

**`garmin_prs`** (row 1) — one row per personal record, written by
`ingest_garmin.py --api` in the same login as the activities:
```
type_id  value  activity_type  activity_id  activity_name  date  pool_unit
```
`type_id` is Garmin's PR type and the upsert key, so each record updates in
place when it is beaten. `value` is raw: seconds for a time (1K, mile, 5K, 10K,
half, marathon, fastest swim), meters for a distance or climb, a count for
steps. The site maps ids to labels in `src/admin/garmin/prs.ts`. A failed PR
fetch is logged as a warning and never fails the activity sync.

**`garmin_wellness`** (row 1) — one row per day, the passive metrics:
```
date  sleep_score  sleep_duration_h  deep_sleep_h  rem_sleep_h  light_sleep_h  awake_h  resting_hr  hrv  body_battery_high  stress_avg  respiration_avg  steps  intensity_minutes  calories  vo2_max  training_readiness  training_status  endurance_score
```

**`ringconn_health`** (row 1):
```
date  sleep_score  sleep_duration_h  deep_sleep_h  rem_sleep_h  light_sleep_h  resting_hr  hrv  skin_temp_c  steps  calories
```

**`apple_health`** (row 1):
```
date  steps  resting_hr  hrv_sdnn  active_calories  basal_calories  sleep_h  weight_kg
```

---

## Usage

### Garmin — CSV mode (manual refresh)

1. In Garmin Connect account settings, set units to **Statute (Imperial)** so Distance exports in miles
2. Go to [connect.garmin.com](https://connect.garmin.com) → Activities → export icon → **Export to CSV**
3. Run:
```bash
python ingest_garmin.py --file ~/Downloads/activities.csv
# Preview without writing:
python ingest_garmin.py --file ~/Downloads/activities.csv --dry-run
```

### Garmin — API mode (ongoing automation)

Pulls directly from Garmin Connect — no manual CSV export needed.

```bash
# Last 30 days (default)
python ingest_garmin.py --api

# Specific date range
python ingest_garmin.py --api --since 2025-01-01

# Preview without writing
python ingest_garmin.py --api --since 2025-06-01 --dry-run
```

Requires `GARMIN_EMAIL` and `GARMIN_PASSWORD` in `config.env`.

**To automate daily:** add a cron job (Mac/Linux) or Task Scheduler entry (Windows):
```
# cron: run every day at 6 AM
0 6 * * * cd /path/to/scripts/health-ingestion && .venv/bin/python ingest_garmin.py --api
```

### Ringconn
1. Open the Ringconn app → Profile → Export Data → CSV
2. Transfer the file to your computer
3. Run:
```bash
python ingest_ringconn.py --file ~/Downloads/ringconn_export.csv
```
> **Note:** If you see "unmapped columns" in the output, the script found columns it doesn't recognize. You can add them to `_COL_MAP` in `ingest_ringconn.py` to capture additional metrics.

### Ringconn — automatic, from Apple Health (no CSV)
RingConn writes to Apple Health; an iPhone Shortcut pushes each day to the db Worker's `ringconn_health` table, and the site merges it with the sheet's older rows (D1 wins on a shared date).

One-time server setup (from `workers/db`):
```bash
npx wrangler d1 execute pasion-db --remote --file=ringconn.sql
npx wrangler secret put RINGCONN_INGEST_KEY      # any long random string
npx wrangler deploy
```

Shortcut (Shortcuts app → Automation → Time of Day, e.g. 9:00, **Run Immediately**). For each of yesterday and today, build one request:
1. **Find Health Samples** per metric, date = that day: Resting Heart Rate, Heart Rate Variability, Steps (sum), Active Energy (sum), Sleeping Wrist Temperature, Sleep Analysis (sum hours per stage: Core → `light_sleep_h`, Deep, REM; total → `sleep_duration_h`).
2. **Get Contents of URL**
   - URL `https://db.abepasion.workers.dev/db/ringconn_health`, Method `POST`
   - Header `Authorization: Bearer <RINGCONN_INGEST_KEY>`
   - Request Body JSON with the keys `date` (`yyyy-MM-dd`), `sleep_duration_h`, `deep_sleep_h`, `rem_sleep_h`, `light_sleep_h`, `resting_hr`, `hrv`, `skin_temp_c`, `steps`, `calories`. Leave `sleep_score` out.

Each POST replaces the whole day's row, so send every metric each time, or a missing one blanks the stored value. Apple Health has no RingConn sleep score, so that column stays empty for these days.

### Apple Health
1. iPhone → Health app → tap your profile picture (top-right) → **Export All Health Data**
2. The export creates a `.zip`. Unzip it — you'll find `export.xml` inside.
3. Run (large files take 5–15 minutes):
```bash
python ingest_apple_health.py --file ~/Downloads/apple_health_export/export.xml

# Import only recent data (faster for incremental updates):
python ingest_apple_health.py --file export.xml --since 2024-01-01
```

---

## How upsert works

Each script uses `date` as the primary key. Running a script twice with the same file will **update** existing rows rather than create duplicates.

For Garmin, if you have multiple activities on the same date, the last one in the source wins. The `title` column helps distinguish them visually on the web app.

---

## Verifying data

After running the scripts, open the web app → **Training** → **Training Data Analysis** → **Health Data** card. You should see record counts and a preview table for each source. If a source shows "No data found", check that:
- The sheet tab name matches exactly (`garmin_health`, `ringconn_health`, `apple_health`)
- The header row in the sheet tab matches the schema above (note: `distance_mi`, not `distance_km`)
- The spreadsheet is shared with your service account email
