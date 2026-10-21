#!/usr/bin/env python3
"""Validate the content staff edit in Pages CMS before it is trusted on the EEG101 site.

Events (_events/*.md), other calendar dates (_dates/*.md) and Spotlights
(_spotlights/*.md) are one file each. An item's id is its filename, because the
booking form, its registration-workbook tab and shared links all depend on it.

Pages CMS writes every field it knows about into every file, with empty values
for the ones left blank. So a field counts as "filled in" only when it has a
value: an empty booking_status or a capacity of 0 is the same as leaving it out.
"""

from __future__ import annotations

import datetime as dt
import argparse
import sys
from pathlib import Path

import re

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVENTS_DIR = ROOT / "_events"
DATES_DIR = ROOT / "_dates"
SPOTLIGHTS_DIR = ROOT / "_spotlights"
SITE_PATH = ROOT / "_data" / "site.yml"

# An id is the filename: lowercase words joined by hyphens. It must not start with a
# date, because Jekyll reads a leading YYYY-MM-DD- as a date and drops it from the id.
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_PREFIX = re.compile(r"^\d{2,4}-\d{1,2}-\d{1,2}-")
CLOCK = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d$")

# Names Jekyll reserves on a collection item (Jekyll::Drops::DocumentDrop.invokable_methods
# in 3.10, the version GitHub Pages runs). A front-matter field with one of these names is
# silently shadowed: `url` gives the item's own address, `next` the next item, `id` its path.
RESERVED_FIELDS = {"collection", "content", "count", "excerpt", "fetch", "first", "keys", "max",
                   "merge", "min", "next", "output", "path", "previous", "relative_path", "sort", "url"}


def filled(value: object) -> bool:
    """True for a value someone actually entered; False for the editor's blank defaults."""
    if value is None or value is False:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value != 0
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


def clock(value: object) -> object:
    """A time Jekyll read as a number (09:00 is 540 minutes, 09:00:00 is 32400 seconds) as HH:MM.

    YAML 1.1 reads an unquoted 09:00 as base-60, and Jekyll and PyYAML both read 1.1.
    The content check rewrites saved files so this should not happen, but a file
    pushed before that ran still means the time that was typed. Anything else is
    returned unchanged.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        return value
    minutes = int(value)
    if minutes >= 1440:
        minutes //= 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def read_front_matter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"---\s*\n(.*?)\n---\s*(?:\n|$)", text, re.S)
    if not match:
        raise ValueError(f"{path.name}: the file must start with a --- front-matter block.")
    data = yaml.safe_load(match.group(1)) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path.name}: the front matter must be a set of fields.")
    return data


def load_items(directory: Path) -> tuple[list[dict], list[str]]:
    """Every *.md in a collection, with its id taken from the filename."""
    items, errors = [], []
    for path in sorted(directory.glob("*.md")):
        try:
            data = read_front_matter(path)
        except (ValueError, yaml.YAMLError) as error:
            errors.append(f"{directory.name}/{path.name}: could not be read ({error}).")
            continue
        item_id = path.stem
        if not ID_PATTERN.match(item_id):
            errors.append(f"{directory.name}/{path.name}: the filename must be lowercase words joined by hyphens.")
        elif DATE_PREFIX.match(item_id):
            errors.append(f"{directory.name}/{path.name}: the filename must not start with a date.")
        if "id" in data and str(data["id"]) != item_id:
            errors.append(f"{directory.name}/{path.name}: has id {data['id']!r}, but an item's id is its filename ({item_id!r}). Remove the id field.")
        for key in sorted(set(data) & RESERVED_FIELDS):
            errors.append(f"{directory.name}/{path.name}: the field name {key!r} is reserved by Jekyll and would be silently ignored. Rename it.")
        for key in ("time", "end_time"):
            if key in data:
                data[key] = clock(data[key])
        items.append({**data, "id": item_id})
    return items, errors

# A one-day event has no end date (it defaults to the start) and a blank capacity
# means no limit, so neither is required: the editor tells staff to leave them empty.
REQUIRED_BOOKING_FIELDS = {
    "id", "title", "start_date", "time", "end_time", "timezone",
    "location", "format", "category", "summary", "booking_enabled", "booking_status",
}
URL_FIELDS = ("registration_url", "programme_url", "recording_url", "slides_url")
# A web address, or a page on this site ("/grants/" but not "//elsewhere.org").
SAFE_URL = re.compile(r"^(https?://|/(?!/))[^\s\"'<>`]*$", re.I)
SCRIPT_URL = re.compile(r"javascript:|vbscript:|data:text/html", re.I)


def url_problem(value: object) -> str:
    """Why a link field cannot be used, or "" if it is fine (or empty)."""
    url = str(value or "").strip()
    if url and not SAFE_URL.match(url):
        return "must be a web address (https://...) or a page on this site (/...), with no spaces"
    return ""



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
        label = f"event {event.get('id') or '#' + str(index)!r} ({event.get('title', 'untitled')!r})"
        event_id = str(event.get("id", "")).strip()
        if not event_id:
            errors.append(f"{label}: id is required.")
        elif event_id in seen_ids:
            errors.append(f"{label}: id {event_id!r} is duplicated.")
        else:
            seen_ids.add(event_id)

        if event.get("audience") not in (None, "", "open", "members"):
            errors.append(f"{label}: audience must be 'open' or 'members'.")
        if event.get("audience") == "members":
            if event.get("booking_enabled") is True:
                errors.append(f"{label}: members-only events are booked through e-COST invitations, so booking_enabled must not be true.")
            if str(event.get("joining_link") or "").strip():
                errors.append(f"{label}: members-only events must not have a public joining_link; details are shared through e-COST.")
        booking_enabled = event.get("booking_enabled") is True
        booking_status = event.get("booking_status")
        # Time zone and end time are not booking-only: the Calendar uses them to show any
        # event's time in the reader's own zone, so only these three count here.
        # Turning bookings off in the editor leaves the status and places filled in;
        # the site ignores them, so that is not an error (see advisories).
        try:
            start_date = dt.date.fromisoformat(string_date(event.get("start_date")))
            if filled(event.get("end_date")) and dt.date.fromisoformat(string_date(event.get("end_date"))) < start_date:
                errors.append(f"{label}: the last day is before the first day.")
        except ValueError:
            errors.append(f"{label}: start_date and end_date must be valid dates (YYYY-MM-DD).")
        for key in ("time", "end_time"):
            if filled(event.get(key)) and not CLOCK.match(str(event[key]).strip()):
                errors.append(f"{label}: {key} must be a time like 14:00.")
        for key in URL_FIELDS:
            problem = url_problem(event.get(key))
            if problem:
                errors.append(f"{label}: {key} {problem}.")

        if not booking_enabled:
            continue

        has_bookable_event = True
        missing = sorted(key for key in REQUIRED_BOOKING_FIELDS if not filled(event.get(key)) and event.get(key) is not False)
        if missing:
            errors.append(f"{label}: bookable events require {', '.join(missing)}.")
        if booking_status not in {"open", "closed"}:
            errors.append(f"{label}: booking_status must be 'open' or 'closed'.")
        if event.get("category") != "Events":
            errors.append(f"{label}: bookable entries must use category 'Events'.")
        link = str(event.get("joining_link") or "").strip()
        if link and not (link.startswith("https://") and " " not in link):
            errors.append(f"{label}: joining_link must be a single web address starting with https://.")
        for key in ("online_link", "meeting_link", "zoom_link", "join_link"):
            if event.get(key):
                errors.append(f"{label}: use joining_link rather than {key}.")
        if len(str(event.get("short_name") or "")) > 60:
            errors.append(f"{label}: short_name must be 60 characters or fewer.")
        if event.get("registration_url"):
            errors.append(f"{label}: registration_url must be empty because booking is handled directly from the event entry.")
        try:
            if int(event.get("capacity") or 0) < 0:
                errors.append(f"{label}: capacity cannot be negative.")
        except (TypeError, ValueError):
            errors.append(f"{label}: capacity must be a whole number, with 0 or empty meaning no limit.")

    if has_bookable_event and not str(site.get("event_booking_endpoint", "")).strip():
        errors.append("_data/site.yml: event_booking_endpoint is required whenever an event has booking_enabled: true.")

    return errors


def advisories(events: list[dict], today: dt.date | None = None) -> list[str]:
    """Worth fixing, but not wrong enough to fail on. The site already hides Register
    once an event has passed, so a booking left open afterwards does no harm."""
    today = today or dt.date.today()
    notes = []
    for event in events:
        if event.get("booking_enabled") is True and event.get("booking_status") == "open":
            try:
                if dt.date.fromisoformat(string_date(event.get("end_date") or event.get("start_date"))) < today:
                    notes.append(f"{event.get('id')}: the event has passed but booking is still 'open'; set it to 'closed'.")
            except ValueError:
                pass
        if event.get("booking_enabled") is not True and any(filled(event.get(k)) for k in ("booking_status", "capacity")):
            notes.append(f"{event.get('id')}: bookings are off, so its booking status and places are ignored.")
    return notes


def validate_dates(dates: list[dict]) -> list[str]:
    """Other calendar dates: deadlines, calls and so on. They only appear on the Calendar."""
    errors = []
    for item in dates:
        label = f"date {item['id']!r}"
        if not filled(item.get("title")):
            errors.append(f"{label}: a title is required.")
        try:
            start = dt.date.fromisoformat(string_date(item.get("start_date")))
            if filled(item.get("end_date")) and dt.date.fromisoformat(string_date(item.get("end_date"))) < start:
                errors.append(f"{label}: the end date is before the start date.")
        except ValueError:
            errors.append(f"{label}: start_date and end_date must be valid dates.")
        for key in ("time", "end_time"):
            if filled(item.get(key)) and not CLOCK.match(str(item[key]).strip()):
                errors.append(f"{label}: {key} must be a time like 14:00.")
        if filled(item.get("end_time")) and not filled(item.get("time")):
            errors.append(f"{label}: an end time needs a start time.")
        problem = url_problem(item.get("link"))
        if problem:
            errors.append(f"{label}: the link {problem}.")
    return errors


def validate_spotlights(spotlights: list[dict]) -> list[str]:
    errors = []
    for item in spotlights:
        label = f"Spotlight {item['id']!r}"
        for key, name in (("title", "a title"), ("type", "a type"), ("summary", "a summary"),
                          ("image", "an image"), ("image_alt", "an image description")):
            if not filled(item.get(key)):
                errors.append(f"{label}: needs {name}.")
        try:
            dt.date.fromisoformat(string_date(item.get("date")))
        except ValueError:
            errors.append(f"{label}: needs a valid finish date (it orders the Spotlight list).")
        for link in item.get("links") or []:
            if not isinstance(link, dict) or not filled(link.get("label")) or not filled(link.get("url")):
                errors.append(f"{label}: every link needs both a label and a web address.")
            elif url_problem(link.get("url")):
                errors.append(f"{label}: the link {link.get('label')!r} {url_problem(link.get('url'))}.")
        for figure in item.get("figures") or []:
            if isinstance(figure, dict) and not filled(figure.get("image")):
                errors.append(f"{label}: every extra picture needs a picture (remove the empty one).")
        for section in ("why", "enabled", "whats_next"):
            text = (item.get(section) or {}).get("text") if isinstance(item.get(section), dict) else None
            if text and SCRIPT_URL.search(str(text)):
                errors.append(f"{label}: a link in the {section} text is not a web address.")
    return errors


def is_published(item: dict) -> bool:
    """Only `published: true` is live: _config.yml makes every other item a draft."""
    return item.get("published") is True


def split_drafts(items: list[dict]) -> tuple[list[dict], list[dict]]:
    return [i for i in items if is_published(i)], [i for i in items if not is_published(i)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root (for tests)")
    args = parser.parse_args()
    site = yaml.safe_load((args.root / "_data" / "site.yml").read_text()) or {}
    events, errors = load_items(args.root / "_events")
    dates, date_errors = load_items(args.root / "_dates")
    spotlights, spot_errors = load_items(args.root / "_spotlights")
    errors += date_errors + spot_errors
    # Drafts are not on the site, so a problem in one is a note for whoever is
    # writing it, not a failure. Ids must still be unique across drafts and live
    # items (a draft becomes live under its id), so events are checked together.
    live_events, draft_events = split_drafts(events)
    live_dates, draft_dates = split_drafts(dates)
    live_spotlights, draft_spotlights = split_drafts(spotlights)
    draft_ids = {e["id"] for e in draft_events}
    for error in validate(events, site):
        if any(f"event {i!r}" in error for i in draft_ids):
            print(f"::warning::Draft (not live yet): {error}")
        else:
            errors.append(error)
    errors += validate_dates(live_dates)
    errors += validate_spotlights(live_spotlights)
    for error in validate_dates(draft_dates) + validate_spotlights(draft_spotlights):
        print(f"::warning::Draft (not live yet): {error}")
    for note in advisories(live_events):
        print(f"::warning::{note}")
    if errors:
        print("Content validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    drafts = len(draft_events) + len(draft_dates) + len(draft_spotlights)
    print(f"Content validation passed: {len(live_events)} events, {len(live_dates)} other dates, "
          f"{len(live_spotlights)} Spotlights live; {drafts} draft{'s' if drafts != 1 else ''}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
