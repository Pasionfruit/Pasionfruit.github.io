"""
Ingest Garmin Connect activity CSV export into Google Sheets.

Export steps:
  1. Go to connect.garmin.com → Activities
  2. Click the arrow next to any activity → Export to CSV  (or use the bulk export)
  3. Run: python ingest_garmin.py --file ~/Downloads/activities.csv

Sheet target: garmin_health
Headers: date, activity_type, title, distance_km, duration_min, avg_hr, max_hr, calories, tss
"""

import argparse
import csv
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv  # type: ignore[import]

# Allow running from any directory
sys.path.insert(0, str(Path(__file__).parent))
from shared.sheets_client import get_spreadsheet, upsert_rows


# Garmin CSV column names vary slightly by locale/version — list common variants
_COL_MAP = {
    "date":          ["Date"],
    "activity_type": ["Activity Type"],
    "title":         ["Title", "Name"],
    "distance_km":   ["Distance"],
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
    """Remove trailing unit labels like ' km', ' bpm', ','-thousands separators."""
    value = value.strip()
    value = re.sub(r"[,\s]", "", value)  # remove thousands commas and spaces
    value = re.sub(r"[^\d.\-].*$", "", value)  # strip trailing non-numeric text
    return value


def parse_garmin_csv(filepath: str) -> list[dict]:
    rows = []
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        col = {key: _find_col(headers, candidates) for key, candidates in _COL_MAP.items()}
        missing = [k for k, v in col.items() if v is None and k in ("date",)]
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
                "distance_km":   _strip_units(raw.get(col["distance_km"] or "", "")),
                "duration_min":  _parse_duration_to_min(raw.get(col["duration_min"] or "", "")),
                "avg_hr":        _strip_units(raw.get(col["avg_hr"] or "", "")),
                "max_hr":        _strip_units(raw.get(col["max_hr"] or "", "")),
                "calories":      _strip_units(raw.get(col["calories"] or "", "")),
                "tss":           _strip_units(raw.get(col["tss"] or "", "")),
            })

    return rows


def main() -> None:
    load_dotenv(Path(__file__).parent / "config.env")

    parser = argparse.ArgumentParser(description="Sync Garmin CSV export to Google Sheets.")
    parser.add_argument("--file", required=True, help="Path to Garmin activities.csv")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to Sheets")
    args = parser.parse_args()

    print(f"Parsing {args.file} …")
    rows = parse_garmin_csv(args.file)
    print(f"  Parsed {len(rows)} activities.")

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
