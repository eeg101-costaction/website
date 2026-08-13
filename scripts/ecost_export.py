#!/usr/bin/env python3
"""Download the current eCOST Working Group export for an Action.

Credentials are supplied only through environment variables. This script never
prints, stores, or commits credentials.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


LOGIN_URL = "https://e-services.cost.eu/user/login"
ACTION_URL = "https://e-services.cost.eu/action/{action_id}/working-groups"


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def download_export(action_id: str, output: Path, headed: bool) -> None:
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright is not installed. Run `python -m playwright install --with-deps chromium`."
        ) from exc

    email = required_env("ECOST_EMAIL")
    password = required_env("ECOST_PASSWORD")
    output.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not headed)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(30_000)

        try:
            page.goto(LOGIN_URL, wait_until="domcontentloaded")
            page.locator("#login__email").fill(email)
            page.locator("#login__password").fill(password)
            page.get_by_role("button", name="Login to your account").click()
            page.wait_for_url(lambda url: "/user/login" not in url, timeout=30_000)

            page.goto(ACTION_URL.format(action_id=action_id), wait_until="networkidle")

            export_candidates = [
                page.get_by_text("Export (.xlsx)", exact=False),
                page.get_by_role("button", name="Export", exact=False),
                page.get_by_role("link", name="Export", exact=False),
            ]
            download = None
            last_error: Exception | None = None
            for candidate in export_candidates:
                try:
                    if candidate.count() == 0:
                        continue
                    with page.expect_download(timeout=20_000) as download_info:
                        candidate.first.click()
                    download = download_info.value
                    break
                except PlaywrightTimeoutError as exc:
                    last_error = exc

            if download is None:
                raise RuntimeError(
                    "Could not find an eCOST Working Group export control. "
                    "The platform interface may have changed."
                ) from last_error

            suggested = download.suggested_filename or f"{action_id}-WG-members.xlsx"
            if not suggested.lower().endswith((".xlsx", ".csv")):
                raise RuntimeError(f"Unexpected export file type: {suggested}")
            download.save_as(str(output))
            if not output.exists() or output.stat().st_size < 1_000:
                raise RuntimeError("Downloaded eCOST export is empty or unexpectedly small.")
            print(f"Downloaded {suggested} to {output}")
        finally:
            context.close()
            browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Download eCOST WG member export")
    parser.add_argument("--action-id", default="CA24148", help="COST Action identifier")
    parser.add_argument(
        "--output",
        default=".tmp/ecost-sync/CA24148-WG-members.xlsx",
        type=Path,
        help="Destination .xlsx or .csv path",
    )
    parser.add_argument("--headed", action="store_true", help="Run browser visibly for local troubleshooting")
    args = parser.parse_args()

    try:
        download_export(args.action_id, args.output, args.headed)
    except Exception as exc:
        print(f"eCOST export failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
