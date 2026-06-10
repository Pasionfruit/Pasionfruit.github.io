# Health Data Ingestion Scripts

Sync Garmin, Ringconn, and Apple Health data into Google Sheets so the Training Data Analysis page can read and display it.

## One-time setup

### 1. Python environment
```bash
cd scripts/health-ingestion
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install python-dotenv        # for loading config.env
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
# Edit config.env with your paths
```

`config.env`:
```
GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/to/service_account.json
SPREADSHEET_NAME=Your Spreadsheet Name
```

### 4. Create the three sheet tabs
In your Google Spreadsheet, add three new tabs with these **exact names and header rows**:

**`garmin_health`** (row 1):
```
date  activity_type  title  distance_km  duration_min  avg_hr  max_hr  calories  tss
```

**`ringconn_health`** (row 1):
```
date  sleep_score  sleep_duration_h  deep_sleep_h  rem_sleep_h  light_sleep_h  resting_hr  hrv  spo2  skin_temp_c  steps  calories
```

**`apple_health`** (row 1):
```
date  steps  resting_hr  hrv_sdnn  active_calories  basal_calories  sleep_h  spo2_avg  weight_kg
```

---

## Usage

### Garmin
1. Go to [connect.garmin.com](https://connect.garmin.com) → Activities
2. Click the export icon → **Export to CSV** (exports all activities)
3. Run:
```bash
python ingest_garmin.py --file ~/Downloads/activities.csv
# Preview without writing:
python ingest_garmin.py --file ~/Downloads/activities.csv --dry-run
```

### Ringconn
1. Open the Ringconn app → Profile → Export Data → CSV
2. Transfer the file to your computer
3. Run:
```bash
python ingest_ringconn.py --file ~/Downloads/ringconn_export.csv
```
> **Note:** If you see "unmapped columns" in the output, the script found columns it doesn't recognize. You can add them to `_COL_MAP` in `ingest_ringconn.py` to capture additional metrics.

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

Each script uses `date` as the primary key. Running a script twice with the same file will **update** existing rows rather than creating duplicates.

For Garmin, if you have multiple activities on the same date, the last one in the CSV wins. If you need per-activity granularity, the `title` column helps distinguish them visually on the web app.

---

## Verifying data

After running the scripts, open the web app → **Training** → **Training Data Analysis** → **Health Data** card. You should see record counts and a preview table for each source. If a source shows "No data found", check that:
- The sheet tab name matches exactly (`garmin_health`, `ringconn_health`, `apple_health`)
- The header row in the sheet tab matches the schema above
- The spreadsheet is shared with your service account email
