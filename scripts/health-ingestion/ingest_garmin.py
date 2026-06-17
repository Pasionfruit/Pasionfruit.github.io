"""
Ingest Garmin Connect activity data into Google Sheets.

Two modes:

  CSV mode (one-time or manual refresh):
    1. Go to connect.garmin.com → Activities → export icon → Export to CSV
    2. Run: python ingest_garmin.py --file ~/Downloads/activities.csv

  API mode (ongoing automation):
    Run: python ingest_garmin.py --api --since 2025-01-01
    Requires GARMIN_EMAIL and GARMIN_PASSWORD in config.env.
    Omit --since to default to the last 30 days.

Sheet target: garmin_health
Headers: date, activity_type, title, distance_mi, duration_min, avg_hr, max_hr, calories, tss

Notes:
  - CSV mode: Distance is read as-is from the export. Make sure your Garmin Connect
    account is set to statute (imperial) units so the Distance column contains miles.
  - API mode: Garmin returns distance in meters; the script converts to miles.
  - date is the upsert key — running twice with the same data updates in-place.
    If you record multiple activities on one day, only the last one in the source wins.
"""

import argparse
import csv
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv  # type: ignore[import]

sys.path.insert(0, str(Path(__file__).parent))
from shared.sheets_client import get_spreadsheet, upsert_rows


_MI_PER_METER = 0.000621371

# Garmin CSV column names vary slightly by locale/version — list common variants
_COL_MAP = {
    "date":          ["Date"],
    "activity_type": ["Activity Type"],
    "title":         ["Title", "Name"],
    "distance_mi":   ["Distance"],
    "duration_min":  ["Time", "Duration"],
    "avg_hr":        ["Avg HR", "Average HR", "Avg Heart Rate"],
    "max_hr":        ["Max HR", "Maximum HR", "Max Heart Rate"],
    "calories":      ["Calories"],
    "tss":           ["Training Stress Score\xa2", "Training Stress Score"],
}


def _find_col(headers: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        if c in headers:
            return c
    return None


def _parse_duration_to_min(value: str) -> str:
    """Convert HH:MM:SS or MM:SS string to total minutes (rounded to 1 dp)."""
    value = value.strip()
    if not value:
        return ""
    parts = value.split(":")
    try:
        if len(parts) == 3:
            total = int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 60
        elif len(parts) == 2:
            total = int(parts[0]) + int(parts[1]) / 60
        else:
            return value
        return f"{total:.1f}"
    except ValueError:
        return value


def _normalize_date(value: str) -> str:
    """Normalize Garmin date strings to YYYY-MM-DD."""
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return value


def _strip_units(value: str) -> str:
    """Remove trailing unit labels and thousands-separator commas."""
    value = value.strip()
    value = re.sub(r",", "", value)           # remove thousands commas
    value = re.sub(r"[^\d.\-].*$", "", value) # strip trailing non-numeric text
    return value


# ── CSV mode ─────────────────────────────────────────────────────────────────

def parse_garmin_csv(filepath: str) -> list[dict]:
    rows = []
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        col = {key: _find_col(headers, candidates) for key, candidates in _COL_MAP.items()}
        missing = [k for k, v in col.items() if v is None and k == "date"]
        if missing:
            raise ValueError(
                f"Required columns not found in CSV: {missing}\n"
                f"Available columns: {headers}"
            )

        for raw in reader:
            date_raw = raw.get(col["date"] or "", "").strip()
            if not date_raw:
                continue
            rows.append({
                "date":          _normalize_date(date_raw),
                "activity_type": raw.get(col["activity_type"] or "", "").strip(),
                "title":         raw.get(col["title"] or "", "").strip(),
                "distance_mi":   _strip_units(raw.get(col["distance_mi"] or "", "")),
                "duration_min":  _parse_duration_to_min(raw.get(col["duration_min"] or "", "")),
                "avg_hr":        _strip_units(raw.get(col["avg_hr"] or "", "")),
                "max_hr":        _strip_units(raw.get(col["max_hr"] or "", "")),
                "calories":      _strip_units(raw.get(col["calories"] or "", "")),
                "tss":           _strip_units(raw.get(col["tss"] or "", "")),
            })
    return rows


# ── API mode ──────────────────────────────────────────────────────────────────

def fetch_garmin_api(since_date: str) -> list[dict]:
    """Pull activities from Garmin Connect and return sheet-ready rows."""
    try:
        from garminconnect import Garmin  # type: ignore[import]
    except ImportError:
        print("ERROR: garminconnect not installed. Run: pip install garminconnect")
        sys.exit(1)

    email    = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        raise EnvironmentError(
            "GARMIN_EMAIL and GARMIN_PASSWORD must be set in config.env for --api mode."
        )

    print(f"  Logging into Garmin Connect as {email} …")
    api = Garmin(email, password)
    api.login()

    today = datetime.now().strftime("%Y-%m-%d")
    print(f"  Fetching activities {since_date} → {today} …")
    activities = api.get_activities_by_date(startdate=since_date, enddate=today)

    rows = []
    for a in activities:
        distance_m = a.get("distance") or 0
        duration_s = a.get("duration") or 0
        tss        = a.get("trainingStressScore")
        rows.append({
            "date":          _normalize_date(a.get("startTimeLocal", "")),
            "activity_type": a.get("activityType", {}).get("typeKey", ""),
            "title":         a.get("activityName", ""),
            "distance_mi":   f"{distance_m * _MI_PER_METER:.2f}" if distance_m else "",
            "duration_min":  f"{duration_s / 60:.1f}" if duration_s else "",
            "avg_hr":        str(a.get("averageHR") or ""),
            "max_hr":        str(a.get("maxHR") or ""),
            "calories":      str(a.get("calories") or ""),
            "tss":           str(tss) if tss is not None else "",
        })
    return rows


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    load_dotenv(Path(__file__).parent / "config.env")

    parser = argparse.ArgumentParser(description="Sync Garmin data to Google Sheets.")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", help="Path to Garmin activities.csv export")
    group.add_argument("--api",  action="store_true", help="Pull from Garmin Connect API")
    parser.add_argument(
        "--since",
        help="Only import activities on or after YYYY-MM-DD. "
             "Defaults to 30 days ago for --api mode; ignored in --file mode.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to Sheets")
    args = parser.parse_args()

    if args.api:
        since = args.since or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        print(f"Fetching from Garmin Connect API (since {since}) …")
        rows = fetch_garmin_api(since)
    else:
        print(f"Parsing {args.file} …")
        rows = parse_garmin_csv(args.file)

    print(f"  Found {len(rows)} activities.")

    if args.dry_run:
        for r in rows[:5]:
            print(" ", r)
        print("  (dry run — not writing to Sheets)")
        return

    ss = get_spreadsheet()
    ws = ss.worksheet("garmin_health")
    updated, inserted = upsert_rows(ws, rows, key_col="date")
    print(f"  Done: {updated} updated, {inserted} inserted.")


if __name__ == "__main__":
    main()
