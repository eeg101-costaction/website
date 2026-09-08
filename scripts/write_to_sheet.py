#!/usr/bin/env python3
"""Write a raw eCOST XLSX export into the 'Raw eCOST export' tab of the
EEG101 Members Google Sheet, ready for the Apps Script trigger to pick up.

Usage (called by the GitHub Action):
    python scripts/write_to_sheet.py \
        --input ".tmp/ecost-sync/CA24148-WG-members.xlsx" \
        --sheet-id "$MEMBERS_SHEET_ID"

Credentials are read from the GOOGLE_SERVICE_ACCOUNT_JSON environment variable
(the full JSON of a Google service account that has been shared on the sheet
with Editor access). They are never printed, stored, or committed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def load_xlsx_rows(path: Path) -> list[list[str]]:
    """Return all rows from the first worksheet as lists of strings."""
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise RuntimeError("openpyxl is required. Add it to requirements-ecost-sync.txt.") from exc

    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook.active
    rows = []
    for row in worksheet.iter_rows(values_only=True):
        rows.append(["" if value is None else str(value) for value in row])
    workbook.close()
    return rows


def write_rows_to_sheet(rows: list[list[str]], sheet_id: str, credentials_json: str) -> None:
    """Clear the 'Raw eCOST export' tab and write fresh rows."""
    try:
        import google.oauth2.service_account as sa
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError as exc:
        raise RuntimeError(
            "google-api-python-client and google-auth are required. "
            "Add them to requirements-ecost-sync.txt."
        ) from exc

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds_info = json.loads(credentials_json)
    credentials = sa.Credentials.from_service_account_info(creds_info, scopes=scopes)
    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    sheets = service.spreadsheets()

    tab = "Raw eCOST export"

    try:
        # Clear the existing tab content.
        sheets.values().clear(
            spreadsheetId=sheet_id,
            range=tab,
        ).execute()

        # Pad all rows to the same width so the Sheets API accepts them.
        max_cols = max(len(row) for row in rows) if rows else 0
        padded = [row + [""] * (max_cols - len(row)) for row in rows]

        # Write fresh data starting at A1.
        result = sheets.values().update(
            spreadsheetId=sheet_id,
            range=f"{tab}!A1",
            valueInputOption="RAW",
            body={"values": padded},
        ).execute()

        updated = result.get("updatedRows", len(rows))
        print(
            f"Wrote {updated} rows ({max_cols} columns) to "
            f"'{tab}' in sheet {sheet_id}.",
            flush=True,
        )

    except HttpError as exc:
        raise RuntimeError(
            f"Google Sheets API error ({exc.resp.status}): {exc.error_details}"
        ) from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to the eCOST XLSX export downloaded by ecost_export.py",
    )
    parser.add_argument(
        "--sheet-id",
        required=True,
        help="Google Sheet ID (the long string in the sheet URL)",
    )
    args = parser.parse_args()

    credentials_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not credentials_json:
        print(
            "GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set. "
            "Skipping sheet update.",
            file=sys.stderr,
        )
        return 0  # Non-fatal: the manual paste fallback still works.

    if not args.input.exists():
        print(
            f"XLSX export not found at {args.input}. "
            "Skipping sheet update.",
            file=sys.stderr,
        )
        return 0  # Non-fatal.

    try:
        rows = load_xlsx_rows(args.input)
        if len(rows) < 2:
            print("XLSX has no data rows — skipping sheet update.", file=sys.stderr)
            return 0
        write_rows_to_sheet(rows, args.sheet_id, credentials_json)
    except Exception as exc:
        print(f"Sheet update failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
