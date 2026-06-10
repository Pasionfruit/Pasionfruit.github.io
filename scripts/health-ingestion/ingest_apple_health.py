"""
Ingest Apple Health XML export into Google Sheets.

Export steps:
  1. iPhone → Health app → profile picture (top-right) → Export All Health Data
  2. Share the resulting zip to your computer and unzip it
  3. Run: python ingest_apple_health.py --file ~/Downloads/apple_health_export/export.xml

The file can be 200–500 MB; this script uses iterparse() for streaming to keep
memory usage low (~50 MB peak). Expect 5–15 minutes for a multi-year export.

Sheet target: apple_health
Headers: date, steps, resting_hr, hrv_sdnn, active_calories, basal_calories,
         sleep_h, spo2_avg, weight_kg
"""

import argparse
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET
from dotenv import load_dotenv  # type: ignore[import]

sys.path.insert(0, str(Path(__file__).parent))
from shared.sheets_client import get_spreadsheet, upsert_rows


# HKQuantityType identifiers we care about → normalized field name + aggregation method
_TYPES: dict[str, tuple[str, str]] = {
    "HKQuantityTypeIdentifierStepCount":              ("steps",           "sum"),
    "HKQuantityTypeIdentifierRestingHeartRate":        ("resting_hr",      "last"),
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":("hrv_sdnn",        "avg"),
    "HKQuantityTypeIdentifierActiveEnergyBurned":      ("active_calories", "sum"),
    "HKQuantityTypeIdentifierBasalEnergyBurned":       ("basal_calories",  "sum"),
    "HKQuantityTypeIdentifierOxygenSaturation":        ("spo2_avg",        "avg"),
    "HKQuantityTypeIdentifierBodyMass":                ("weight_kg",       "last"),
    # Sleep is handled separately via HKCategoryTypeIdentifierSleepAnalysis
    "HKCategoryTypeIdentifierSleepAnalysis":           ("sleep_h",         "sleep"),
}

_SLEEP_IN_BED_VALUES = {"HKCategoryValueSleepAnalysisInBed", "HKCategoryValueSleepAnalysisAsleep"}


def _parse_date(dt_str: str) -> str:
    """Extract YYYY-MM-DD from a HealthKit datetime string."""
    return dt_str[:10]


def parse_export_xml(filepath: str) -> list[dict]:
    """
    Stream-parse export.xml and aggregate records into daily summaries.
    Returns a list of dicts with one entry per date.
    """
    # accumulator per date per field
    AccType = dict[str, dict[str, list[float]]]
    acc: AccType = defaultdict(lambda: defaultdict(list))

    print("  Streaming XML (this may take a few minutes for large exports)…")
    context = ET.iterparse(filepath, events=("start",))

    record_count = 0
    for _event, elem in context:
        tag = elem.tag
        if tag not in ("Record",):
            elem.clear()
            continue

        hk_type = elem.get("type", "")
        if hk_type not in _TYPES:
            elem.clear()
            continue

        field, method = _TYPES[hk_type]
        start_date = elem.get("startDate", "")
        end_date = elem.get("endDate", "")
        value_str = elem.get("value", "")
        date = _parse_date(start_date)

        if method == "sleep":
            # Sum hours where value indicates in-bed / asleep
            if value_str in _SLEEP_IN_BED_VALUES:
                try:
                    start_dt = datetime.fromisoformat(start_date[:19])
                    end_dt = datetime.fromisoformat(end_date[:19])
                    hours = max(0.0, (end_dt - start_dt).total_seconds() / 3600)
                    acc[date][field].append(hours)
                except ValueError:
                    pass
        else:
            try:
                acc[date][field].append(float(value_str))
            except ValueError:
                pass

        record_count += 1
        if record_count % 100_000 == 0:
            print(f"    … processed {record_count:,} records")

        elem.clear()

    print(f"  Processed {record_count:,} relevant records across {len(acc)} days.")

    rows = []
    for date in sorted(acc.keys()):
        day = acc[date]

        def _agg(field_name: str, method: str) -> str:
            vals = day.get(field_name, [])
            if not vals:
                return ""
            if method == "sum":
                return f"{sum(vals):.1f}"
            if method == "avg":
                return f"{sum(vals) / len(vals):.1f}"
            if method == "last":
                return f"{vals[-1]:.1f}"
            if method == "sleep":
                return f"{sum(vals):.2f}"
            return ""

        rows.append({
            "date":            date,
            "steps":           _agg("steps",           "sum"),
            "resting_hr":      _agg("resting_hr",      "last"),
            "hrv_sdnn":        _agg("hrv_sdnn",        "avg"),
            "active_calories": _agg("active_calories", "sum"),
            "basal_calories":  _agg("basal_calories",  "sum"),
            "sleep_h":         _agg("sleep_h",         "sleep"),
            "spo2_avg":        _agg("spo2_avg",        "avg"),
            "weight_kg":       _agg("weight_kg",       "last"),
        })

    return rows


def main() -> None:
    load_dotenv(Path(__file__).parent / "config.env")

    parser = argparse.ArgumentParser(description="Sync Apple Health XML export to Google Sheets.")
    parser.add_argument("--file", required=True, help="Path to export.xml from Apple Health")
    parser.add_argument("--since", help="Only import records on or after this date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to Sheets")
    args = parser.parse_args()

    print(f"Parsing {args.file} …")
    rows = parse_export_xml(args.file)

    if args.since:
        rows = [r for r in rows if r["date"] >= args.since]
        print(f"  Filtered to {len(rows)} days on or after {args.since}.")

    if args.dry_run:
        for r in rows[-5:]:
            print(" ", r)
        print("  (dry run — not writing to Sheets)")
        return

    print(f"  Writing {len(rows)} days to Sheets…")
    ss = get_spreadsheet()
    ws = ss.worksheet("apple_health")
    updated, inserted = upsert_rows(ws, rows, key_col="date")
    print(f"  Done: {updated} updated, {inserted} inserted.")


if __name__ == "__main__":
    main()
