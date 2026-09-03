#!/usr/bin/env python3
"""Sync Garmin daily wellness data to the `garmin_wellness` sheet.

This is the passive side of the watch — sleep, recovery, stress, readiness —
as opposed to `ingest_garmin.py`, which handles one row per *activity*.

Sheet: garmin_wellness
Headers: date, sleep_score, sleep_duration_h, deep_sleep_h, rem_sleep_h,
         light_sleep_h, awake_h, resting_hr, hrv, body_battery_high,
         stress_avg, respiration_avg, steps, intensity_minutes, calories,
         vo2_max, training_readiness, training_status, endurance_score

Usage:
    python ingest_garmin_wellness.py --days 30
    python ingest_garmin_wellness.py --since 2026-01-01 --dry-run

Requires GARMIN_EMAIL and GARMIN_PASSWORD in config.env.

Garmin rate-limits aggressively: this makes several API calls per day of
history, so it sleeps briefly between days and defaults to a short window.
Start with --days 7 to confirm it works before backfilling.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from dotenv import load_dotenv  # type: ignore[import]

sys.path.insert(0, str(Path(__file__).parent))
from shared.sheets_client import get_spreadsheet, upsert_rows  # noqa: E402

SHEET_NAME = "garmin_wellness"

HEADERS = [
    "date",
    "sleep_score", "sleep_duration_h", "deep_sleep_h", "rem_sleep_h",
    "light_sleep_h", "awake_h", "resting_hr", "hrv",
    "body_battery_high",
    "stress_avg", "respiration_avg", "steps",
    "intensity_minutes", "calories",
    "vo2_max", "training_readiness", "training_status", "endurance_score",
]

_SECONDS_PER_HOUR = 3600.0


def _hours(seconds: Any) -> str:
    """Garmin reports sleep phases in seconds; the sheet stores hours."""
    try:
        value = float(seconds or 0)
    except (TypeError, ValueError):
        return ""
    return f"{value / _SECONDS_PER_HOUR:.2f}" if value else ""


def _num(value: Any) -> str:
    if value is None or value == "":
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    return str(int(number)) if number.is_integer() else f"{number:.1f}"


def _safe(label: str, fn) -> Any:
    """
    Every endpoint here is optional — a metric the watch does not record, or a
    day it was not worn, raises rather than returning empty. One missing metric
    should not lose the whole day, so failures degrade to None.
    """
    try:
        return fn()
    except Exception as err:  # noqa: BLE001 - third-party raises bare Exception
        print(f"      ({label} unavailable: {type(err).__name__})")
        return None


def fetch_day(api: Any, cdate: str) -> dict[str, str]:
    row: dict[str, str] = {key: "" for key in HEADERS}
    row["date"] = cdate

    # ── Sleep ────────────────────────────────────────────────────────────
    sleep = _safe("sleep", lambda: api.get_sleep_data(cdate)) or {}
    daily = sleep.get("dailySleepDTO") or {}
    row["sleep_score"] = _num((daily.get("sleepScores") or {}).get("overall", {}).get("value"))
    row["sleep_duration_h"] = _hours(daily.get("sleepTimeSeconds"))
    row["deep_sleep_h"] = _hours(daily.get("deepSleepSeconds"))
    row["rem_sleep_h"] = _hours(daily.get("remSleepSeconds"))
    row["light_sleep_h"] = _hours(daily.get("lightSleepSeconds"))
    row["awake_h"] = _hours(daily.get("awakeSleepSeconds"))

    # ── Recovery ─────────────────────────────────────────────────────────
    rhr = _safe("resting hr", lambda: api.get_rhr_day(cdate)) or {}
    metrics = (rhr.get("allMetrics") or {}).get("metricsMap") or {}
    rhr_values = metrics.get("WELLNESS_RESTING_HEART_RATE") or []
    if rhr_values:
        row["resting_hr"] = _num(rhr_values[0].get("value"))

    hrv = _safe("hrv", lambda: api.get_hrv_data(cdate)) or {}
    row["hrv"] = _num((hrv.get("hrvSummary") or {}).get("lastNightAvg"))

    battery = _safe("body battery", lambda: api.get_body_battery(cdate, cdate)) or []
    if battery:
        levels = [p[2] for p in (battery[0].get("bodyBatteryValuesArray") or []) if len(p) > 2]
        levels = [lvl for lvl in levels if isinstance(lvl, (int, float))]
        if levels:
            row["body_battery_high"] = _num(max(levels))

    # ── Daily wellness ───────────────────────────────────────────────────
    stats = _safe("daily stats", lambda: api.get_stats(cdate)) or {}
    row["stress_avg"] = _num(stats.get("averageStressLevel"))
    row["steps"] = _num(stats.get("totalSteps"))
    row["calories"] = _num(stats.get("totalKilocalories"))
    row["intensity_minutes"] = _num(
        (stats.get("moderateIntensityMinutes") or 0) + (stats.get("vigorousIntensityMinutes") or 0) * 2
    )

    respiration = _safe("respiration", lambda: api.get_respiration_data(cdate)) or {}
    row["respiration_avg"] = _num(respiration.get("avgSleepRespirationValue"))

    # ── Training & performance ───────────────────────────────────────────
    max_metrics = _safe("vo2 max", lambda: api.get_max_metrics(cdate)) or []
    if max_metrics:
        generic = (max_metrics[0] or {}).get("generic") or {}
        row["vo2_max"] = _num(generic.get("vo2MaxPreciseValue") or generic.get("vo2MaxValue"))

    readiness = _safe("training readiness", lambda: api.get_training_readiness(cdate)) or []
    if readiness:
        row["training_readiness"] = _num((readiness[0] or {}).get("score"))

    status = _safe("training status", lambda: api.get_training_status(cdate)) or {}
    latest = status.get("latestTrainingStatusData") or {}
    for device in latest.values():
        label = device.get("trainingStatusFeedbackPhrase")
        if label:
            row["training_status"] = str(label).replace("_", " ").title()
            break

    endurance = _safe("endurance score", lambda: api.get_endurance_score(cdate, cdate)) or {}
    row["endurance_score"] = _num(endurance.get("overallScore"))

    return row


def main() -> None:
    load_dotenv(Path(__file__).parent / "config.env")

    parser = argparse.ArgumentParser(description="Sync Garmin wellness data to Google Sheets.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--days", type=int, help="Number of days back from today (default 7)")
    group.add_argument("--since", help="Start date YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, do not write to Sheets")
    args = parser.parse_args()

    try:
        from garminconnect import Garmin  # type: ignore[import]
    except ImportError:
        print("ERROR: garminconnect not installed. Run: pip install garminconnect")
        sys.exit(1)

    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        raise EnvironmentError("GARMIN_EMAIL and GARMIN_PASSWORD must be set in config.env.")

    if args.since:
        start = datetime.strptime(args.since, "%Y-%m-%d")
    else:
        start = datetime.now() - timedelta(days=(args.days or 7) - 1)

    dates = []
    cursor = start
    today = datetime.now()
    while cursor.date() <= today.date():
        dates.append(cursor.strftime("%Y-%m-%d"))
        cursor += timedelta(days=1)

    print(f"Logging into Garmin Connect as {email} …")
    api = Garmin(email, password)
    api.login()

    rows = []
    for index, cdate in enumerate(dates, start=1):
        print(f"  [{index}/{len(dates)}] {cdate}")
        rows.append(fetch_day(api, cdate))
        # Garmin throttles hard; this keeps a multi-week backfill from 429ing.
        if index < len(dates):
            time.sleep(1.0)

    # Garmin returns nothing for a day that has not synced yet — today's row is
    # usually empty when this runs in the morning. Writing it anyway puts a
    # dated but metric-less row in the sheet, and the dashboard then treats that
    # date as the newest data it has, labelling older numbers with today's date.
    filled = [row for row in rows if any(v for k, v in row.items() if k != "date")]
    kept = {row["date"] for row in filled}
    skipped = [row["date"] for row in rows if row["date"] not in kept]
    if skipped:
        print(f"\nSkipping {len(skipped)} day(s) with no data: {', '.join(skipped)}")

    if args.dry_run:
        print(f"\nDry run — {len(filled)} rows with data, nothing written.")
        for row in filled[-3:]:
            print("  ", {k: v for k, v in row.items() if v})
        return

    if not filled:
        print("\nNothing to write — Garmin returned no data for any requested day.")
        return

    print(f"\nWriting {len(filled)} rows to '{SHEET_NAME}' …")
    ss = get_spreadsheet()
    try:
        ws = ss.worksheet(SHEET_NAME)
    except Exception:
        print(f"  Sheet '{SHEET_NAME}' not found. Create it with this header row:")
        print("  " + "	".join(HEADERS))
        sys.exit(1)

    updated, inserted = upsert_rows(ws, filled, key_col="date")
    print(f"  Done: {updated} updated, {inserted} inserted.")


if __name__ == "__main__":
    main()
