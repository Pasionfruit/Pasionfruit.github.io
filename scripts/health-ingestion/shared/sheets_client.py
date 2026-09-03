"""
Shared Google Sheets client for health data ingestion scripts.
Uses a service account for write access (separate from the web app's public API key).
"""

import os
import gspread
from google.oauth2.service_account import Credentials

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
]


def get_spreadsheet() -> gspread.Spreadsheet:
    """Return the configured spreadsheet using service account credentials."""
    json_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    spreadsheet_id = os.environ.get("SPREADSHEET_ID")
    spreadsheet_name = os.environ.get("SPREADSHEET_NAME")

    if not json_path:
        raise EnvironmentError(
            "GOOGLE_SERVICE_ACCOUNT_JSON env var not set. "
            "Copy config.env.example to config.env and fill it in."
        )
    if not spreadsheet_id and not spreadsheet_name:
        raise EnvironmentError(
            "Set SPREADSHEET_ID (recommended) or SPREADSHEET_NAME env var. "
            "SPREADSHEET_ID is the long ID from your Google Sheets URL."
        )

    creds = Credentials.from_service_account_file(json_path, scopes=_SCOPES)
    client = gspread.authorize(creds)
    if spreadsheet_id:
        return client.open_by_key(spreadsheet_id)
    return client.open(spreadsheet_name)  # requires Google Drive API to be enabled


def ensure_worksheet(
    spreadsheet: gspread.Spreadsheet,
    title: str,
    headers: list[str],
) -> gspread.Worksheet:
    """
    Return the worksheet, creating it with a header row if it does not exist.

    `upsert_rows` maps dict keys onto columns by reading row 1, so a tab without
    headers silently writes blank rows rather than failing. Creating the tab and
    its header row together is the only safe way to do this, and it means a
    deleted tab costs a re-run rather than hand-rebuilding a header by hand.
    """
    try:
        worksheet = spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        print(f"  Sheet '{title}' not found — creating it.")
        worksheet = spreadsheet.add_worksheet(title=title, rows=1000, cols=max(len(headers), 26))
        worksheet.update(range_name="A1", values=[headers])
        worksheet.freeze(rows=1)
        return worksheet

    # An existing but empty tab is the other way this goes wrong: the tab is
    # there, so no error, but every write lands in nothing.
    if not worksheet.row_values(1):
        print(f"  Sheet '{title}' has no header row — writing it.")
        worksheet.update(range_name="A1", values=[headers])
        worksheet.freeze(rows=1)

    return worksheet


def upsert_rows(
    worksheet: gspread.Worksheet,
    rows: list[dict],
    key_col: str = "date",
) -> tuple[int, int]:
    """
    Upsert rows into a worksheet keyed on key_col.

    - Rows whose key already exists are updated in-place.
    - Rows with a new key are appended.

    Returns (updated_count, inserted_count).
    """
    if not rows:
        return 0, 0

    existing = worksheet.get_all_records()
    headers = worksheet.row_values(1)

    # Build a map from key value → 1-based row index (row 1 = header, data starts at 2)
    key_to_row: dict[str, int] = {}
    for i, record in enumerate(existing):
        key_val = str(record.get(key_col, "")).strip()
        if key_val:
            key_to_row[key_val] = i + 2  # +2 because enumerate starts at 0 and row 1 is header

    to_update: list[dict] = []
    to_insert: list[list] = []

    for row in rows:
        key_val = str(row.get(key_col, "")).strip()
        if key_val in key_to_row:
            to_update.append({"row_index": key_to_row[key_val], "data": row})
        else:
            to_insert.append([row.get(h, "") for h in headers])

    # Batch-update existing rows
    if to_update:
        cell_updates = []
        for item in to_update:
            row_idx = item["row_index"]
            data = item["data"]
            for col_idx, header in enumerate(headers, start=1):
                if header in data:
                    cell_updates.append(
                        gspread.Cell(row=row_idx, col=col_idx, value=data[header])
                    )
        if cell_updates:
            worksheet.update_cells(cell_updates)

    # Append new rows
    if to_insert:
        worksheet.append_rows(to_insert, value_input_option="USER_ENTERED")

    return len(to_update), len(to_insert)
