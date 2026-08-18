#!/usr/bin/env python3
"""Validate the single-source event and booking data before publishing the EEG101 site."""

from __future__ import annotations

import datetime as dt
import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVENTS_PATH = ROOT / "_data" / "events.yml"
SITE_PATH = ROOT / "_data" / "site.yml"
REQUIRED_BOOKING_FIELDS = {
    "id", "title", "start_date", "end_date", "time", "end_time", "timezone",
    "location", "format", "category", "summary", "capacity", "booking_enabled", "booking_status",
}


def string_date(value: object) -> str:
    if isinstance(value, dt.date):
        return value.isoformat()
    return str(value or "")


def validate(events: list[dict], site: dict, today: dt.date | None = None) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    has_bookable_event = False
    today = today or dt.date.today()

    for index, event in enumerate(events, start=1):
        label = f"event #{index} ({event.get('title', 'untitled')!r})"
        event_id = str(event.get("id", "")).strip()
        if not event_id:
            errors.append(f"{label}: id is required.")
        elif event_id in seen_ids:
            errors.append(f"{label}: id {event_id!r} is duplicated.")
        else:
            seen_ids.add(event_id)

        booking_enabled = event.get("booking_enabled") is True
        booking_status = event.get("booking_status")
        booking_fields_present = any(key in event for key in ("booking_enabled", "booking_status", "capacity", "end_time", "timezone"))

        if booking_fields_present and not booking_enabled:
            errors.append(f"{label}: booking fields are present but booking_enabled is not true. Remove them or enable booking explicitly.")
        if not booking_enabled:
            continue

        has_bookable_event = True
        missing = sorted(key for key in REQUIRED_BOOKING_FIELDS if event.get(key) in (None, ""))
        if missing:
            errors.append(f"{label}: bookable events require {', '.join(missing)}.")
        if booking_status not in {"open", "closed"}:
            errors.append(f"{label}: booking_status must be 'open' or 'closed'.")
        if event.get("category") != "Events":
            errors.append(f"{label}: bookable entries must use category 'Events'.")
        if event.get("registration_url"):
            errors.append(f"{label}: registration_url must be empty because booking is handled directly from the event entry.")
        try:
            if int(event.get("capacity", 0)) < 0:
                errors.append(f"{label}: capacity cannot be negative.")
        except (TypeError, ValueError):
            errors.append(f"{label}: capacity must be a whole number, with 0 meaning open attendance.")
        try:
            start_date = dt.date.fromisoformat(string_date(event.get("start_date")))
            end_date = dt.date.fromisoformat(string_date(event.get("end_date")))
            if end_date < start_date:
                errors.append(f"{label}: end_date must not be earlier than start_date.")
            if booking_status == "open" and start_date < today:
                errors.append(f"{label}: a past event cannot have booking_status 'open'.")
        except ValueError:
            errors.append(f"{label}: start_date and end_date must use valid ISO dates.")

    if has_bookable_event and not str(site.get("event_booking_endpoint", "")).strip():
        errors.append("_data/site.yml: event_booking_endpoint is required whenever an event has booking_enabled: true.")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events", type=Path, default=EVENTS_PATH)
    parser.add_argument("--site", type=Path, default=SITE_PATH)
    args = parser.parse_args()
    events = yaml.safe_load(args.events.read_text()) or []
    site = yaml.safe_load(args.site.read_text()) or {}
    errors = validate(events, site)
    if errors:
        print("Event booking validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Event booking validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
