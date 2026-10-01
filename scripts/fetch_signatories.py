#!/usr/bin/env python3
"""Refresh _data/signatories.yml from the Community Framework signature store.

Signatures are collected in a Supabase table (`public.signatories`) that predates
this website integration. Nothing here migrates or rewrites that table: the store
stays exactly where it is, keeping every signature already gathered through
sign-cf.eeg101.eu, and this script only *reads* the subset that signatories
agreed to publish.

Privacy
-------
The table holds personal data that is not for publication -- email address, age,
gender, country of origin, ORCID and free-text comments. This script therefore:

  * filters `show_name = true` **server-side**, so private signatures are never
    transmitted at all;
  * selects only the three fields that appear on the public page (first name,
    last name, affiliation), so no email address ever reaches the CI runner,
    the repository, or the built site;
  * asks for the overall total as a bare count, never as rows.

The service-role key bypasses row-level security, so it must only ever come from
an Actions secret -- never a committed file, and never the browser.

Usage
-----
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/fetch_signatories.py
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

TABLE = "signatories"
PUBLIC_FIELDS = "first_name,last_name,affiliation"
PAGE_SIZE = 1000


def request(url: str, key: str, extra_headers: dict[str, str] | None = None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": "eeg101.eu signatory sync",
    }
    headers.update(extra_headers or {})
    req = urllib.request.Request(url, headers=headers)
    try:
        return urllib.request.urlopen(req, timeout=60)  # noqa: S310
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")[:400]
        sys.exit(f"Supabase returned HTTP {error.code} for {url.split('?')[0]}: {body}")
    except urllib.error.URLError as error:
        sys.exit(f"Could not reach Supabase: {error.reason}")


def total_signature_count(base: str, key: str) -> int:
    """Total signatures, public and private, as a count only -- no rows."""
    url = f"{base}/rest/v1/{TABLE}?select=id&limit=1"
    with request(url, key, {"Prefer": "count=exact"}) as response:
        content_range = response.headers.get("Content-Range", "")
    match = re.search(r"/(\d+)$", content_range)
    if not match:
        sys.exit(f"Supabase did not return a usable row count (got {content_range!r})")
    return int(match.group(1))


def public_signatories(base: str, key: str) -> list[dict[str, str]]:
    """Every signature whose owner opted into being listed publicly."""
    rows: list[dict[str, str]] = []
    offset = 0
    while True:
        query = urllib.parse.urlencode(
            {
                "select": PUBLIC_FIELDS,
                "show_name": "eq.true",
                "order": "last_name.asc,first_name.asc",
                "limit": PAGE_SIZE,
                "offset": offset,
            }
        )
        with request(f"{base}/rest/v1/{TABLE}?{query}", key) as response:
            page = json.load(response)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def tidy(value: object) -> str:
    text = "" if value is None else str(value)
    return re.sub(r"\s+", " ", text).strip()


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=pathlib.Path(__file__).resolve().parent.parent / "_data" / "signatories.yml",
    )
    args = parser.parse_args()

    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        sys.exit(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.\n"
            "In CI they come from repository secrets; see "
            "docs/community-framework-operations.md."
        )

    total = total_signature_count(base, key)
    rows = public_signatories(base, key)

    people = []
    for row in rows:
        name = tidy(f"{tidy(row.get('first_name'))} {tidy(row.get('last_name'))}")
        if not name:
            continue
        people.append({"name": name, "affiliation": tidy(row.get("affiliation"))})

    # De-duplicate repeat signatures by name + affiliation, keeping first order.
    seen: set[tuple[str, str]] = set()
    unique = []
    for person in people:
        marker = (person["name"].lower(), person["affiliation"].lower())
        if marker in seen:
            continue
        seen.add(marker)
        unique.append(person)

    lines = [
        "# Generated by scripts/fetch_signatories.py -- do not edit by hand.",
        "#",
        "# Public signatories of the EEG101 Community Framework. Only people who",
        "# ticked 'I'm happy for my name to be displayed publicly' appear here, and",
        "# only their name and affiliation are ever written to this file.",
        "",
        f"generated: {yaml_quote(dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'))}",
        f"total: {total}",
        f"public_count: {len(unique)}",
        "",
        "people:",
    ]
    for person in unique:
        lines.append(f"  - name: {yaml_quote(person['name'])}")
        lines.append(f"    affiliation: {yaml_quote(person['affiliation'])}")
    if not unique:
        lines[-1] = "people: []"

    args.out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"wrote {args.out.name}: {len(unique)} public signatories "
        f"of {total} signatures in total"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
