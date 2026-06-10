"""
Ingest Ringconn smart ring CSV export into Google Sheets.

Export steps:
  1. Open the Ringconn app → Profile → Data Export (or similar)
  2. Export as CSV and transfer the file to your computer
  3. Run: python ingest_ringconn.py --file ~/Downloads/ringconn_export.csv

The script reads column headers dynamically and maps known Ringconn metric names
to the normalized schema. Unknown columns are silently ignored, so the script
won't break if Ringconn adds new fields in a future export.

Sheet target: ringconn_health
Headers: date, sleep_score, sleep_duration_h, deep_sleep_h, rem_sleep_h,
         light_sleep_h, resting_hr, hrv, spo2, skin_temp_c, steps, calories
"""

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv  # type: ignore[import]

sys.path.insert(0, str(Path(__file__).parent))
from shared.sheets_client import get_spreadsheet, upsert_rows


# Maps normalized field name → list of possible CSV column headers from Ringconn app.
# Add or adjust entries here when you inspect your actual export headers.
_COL_MAP: dict[str, list[str]] = {
    "date":             ["Date", "date", "Day"],
    "sleep_score":      ["Sleep Score", "sleep_score", "Sleep Quality Score"],
    "sleep_duration_h": ["Sleep Duration", "Total Sleep", "sleep_duration", "Total Sleep (h)"],
    "deep_sleep_h":     ["Deep Sleep", "Deep Sleep (h)", "deep_sleep"],
    "rem_sleep_h":      ["REM Sleep", "REM Sleep (h)", "rem_sleep"],
    "light_sleep_h":    ["Light Sleep", "Light Sleep (h)", "light_sleep"],
    "resting_hr":       ["Resting Heart Rate", "Resting HR", "resting_hr", "Min Heart Rate"],
    "hrv":              ["HRV", "Heart Rate Variability", "hrv", "RMSSD"],
    "spo2":             ["SpO2", "Blood Oxygen", "spo2", "Oxygen Saturation"],
    "skin_temp_c":      ["Skin Temperature", "skin_temp", "Temperature (°C)", "Skin Temp"],
    "steps":            ["Steps", "Step Count", "steps"],
    "calories":         ["Calories", "Active Calories", "calories"],
}


def _find_col(headers: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        if c in headers:
            return c
    # Case-insensitive fallback
    lower = {h.lower(): h for h in headers}
    for c in candidates:
        if c.lower() in lower:
            return lower[c.lower()]
    return None


def _normalize_date(value: str) -> str:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return value


def _clean(value: str) -> str:
    return value.strip().replace(",", "")


def parse_ringconn_csv(filepath: str) -> list[dict]:
    rows = []
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])

        col = {key: _find_col(headers, candidates) for key, candidates in _COL_MAP.items()}

        if col["date"] is None:
            raise ValueError(
                f"Could not find a 'date' column in the CSV.\n"
                f"Available columns: {headers}\n"
                f"Update _COL_MAP['date'] in ingest_ringconn.py to match your export."
            )

        # Report any unmapped columns so the user can extend the mapping if wanted
        mapped_src_cols = {v for v in col.values() if v is not None}
        unmapped = [h for h in headers if h not in mapped_src_cols]
        if unmapped:
            print(f"  Note: unmapped columns (ignored): {unmapped}")

        for raw in reader:
            date_raw = raw.get(col["date"] or "", "").strip()
            if not date_raw:
                continue

            rows.append({
                "date":             _normalize_date(date_raw),
                "sleep_score":      _clean(raw.get(col["sleep_score"] or "", "")),
                "sleep_duration_h": _clean(raw.get(col["sleep_duration_h"] or "", "")),
                "deep_sleep_h":     _clean(raw.get(col["deep_sleep_h"] or "", "")),
                "rem_sleep_h":      _clean(raw.get(col["rem_sleep_h"] or "", "")),
                "light_sleep_h":    _clean(raw.get(col["light_sleep_h"] or "", "")),
                "resting_hr":       _clean(raw.get(col["resting_hr"] or "", "")),
                "hrv":              _clean(raw.get(col["hrv"] or "", "")),
                "spo2":             _clean(raw.get(col["spo2"] or "", "")),
                "skin_temp_c":      _clean(raw.get(col["skin_temp_c"] or "", "")),
                "steps":            _clean(raw.get(col["steps"] or "", "")),
                "calories":         _clean(raw.get(col["calories"] or "", "")),
            })

    return rows


def main() -> None:
    load_dotenv(Path(__file__).parent / "config.env")

    parser = argparse.ArgumentParser(description="Sync Ringconn CSV export to Google Sheets.")
    parser.add_argument("--file", required=True, help="Path to Ringconn export CSV")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to Sheets")
    args = parser.parse_args()

    print(f"Parsing {args.file} …")
    rows = parse_ringconn_csv(args.file)
    print(f"  Parsed {len(rows)} days.")

    if args.dry_run:
        for r in rows[:5]:
            print(" ", r)
        print("  (dry run — not writing to Sheets)")
        return

    ss = get_spreadsheet()
    ws = ss.worksheet("ringconn_health")
    updated, inserted = upsert_rows(ws, rows, key_col="date")
    print(f"  Done: {updated} updated, {inserted} inserted.")


if __name__ == "__main__":
    main()
