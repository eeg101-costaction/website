#!/usr/bin/env python3
"""Refresh _data/signatories.yml from the Community Framework signature store.

Signatures are collected in a Supabase table (`public.signatories`) that predates
this website integration. Nothing here migrates or rewrites that table: the store
stays exactly where it is, keeping every signature already gathered, and this
script only *reads* the subset that signatories agreed to publish.

Two sources, tried in order
---------------------------
1. **Supabase directly**, when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
   set. Authoritative, and keeps working after the original site is retired.
2. **The published list** at sign-cf.eeg101.eu/signatories/, which the Framework's
   own nightly job regenerates from that same table. Needs no credentials, so
   the signatory list on this site updates every night whether or not anyone has
   added the repository secrets.

Source 2 is a real source, not a stopgap: it reads a page the Framework already
publishes. It does mean the list is a day behind the table and stops updating if
the old site is taken down, which is why source 1 wins whenever it is available.

Privacy
-------
Only people who ticked "I'm happy for my name to be displayed publicly" are ever
read, and only their name and affiliation. The table also holds email addresses,
ages, genders, countries of origin, ORCIDs and free-text comments; none of that
is requested, written to this repository, or published. Against Supabase the
`show_name` filter is applied server-side, so private signatures are never even
transmitted. `scripts/check_framework.py` fails the build if any field other
than name and affiliation reaches _data/signatories.yml.

The service-role key bypasses row-level security, so it must only ever come from
an Actions secret -- never a committed file, and never the browser.

Usage
-----
    python3 scripts/fetch_signatories.py                      # published list
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/fetch_signatories.py
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
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
PUBLISHED_LIST = "https://sign-cf.eeg101.eu/signatories/"
USER_AGENT = "eeg101.eu signatory sync"


# --------------------------------------------------------------- Supabase


def request(url: str, key: str, extra_headers: dict[str, str] | None = None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
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


def from_supabase(base: str, key: str) -> tuple[int, list[dict[str, str]]]:
    """Total signatures as a bare count, plus every public name and affiliation."""
    url = f"{base}/rest/v1/{TABLE}?select=id&limit=1"
    with request(url, key, {"Prefer": "count=exact"}) as response:
        content_range = response.headers.get("Content-Range", "")
    match = re.search(r"/(\d+)$", content_range)
    if not match:
        sys.exit(f"Supabase did not return a usable row count (got {content_range!r})")
    total = int(match.group(1))

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

    people = []
    for row in rows:
        name = tidy(f"{tidy(row.get('first_name'))} {tidy(row.get('last_name'))}")
        if name:
            people.append({"name": name, "affiliation": tidy(row.get("affiliation"))})
    return total, people


# ------------------------------------------------------- published list


def from_published_list(url: str) -> tuple[int, list[dict[str, str]]]:
    """Read the list the Framework's own nightly job publishes.

    generate_data.py in the sign-cf repository renders the public signatories as
    `<li><strong>First Last</strong> - Affiliation</li>` under a sentence giving
    the overall total, so both are recoverable without any credential.
    """
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:  # noqa: S310
            markup = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        sys.exit(f"The published signatory list returned HTTP {error.code}: {url}")
    except urllib.error.URLError as error:
        sys.exit(f"Could not reach the published signatory list: {error.reason}")

    entries = re.findall(
        r"<li><strong>([^<]+)</strong>\s*-\s*([^<]*)</li>", markup
    )
    if not entries:
        sys.exit(
            "Found no signatories on the published list. Its markup has probably "
            f"changed -- check {url} and update this parser rather than letting "
            "the site publish an empty list."
        )

    people = [
        {"name": tidy(html.unescape(name)), "affiliation": tidy(html.unescape(affil))}
        for name, affil in entries
    ]

    match = re.search(r"There are\s*<strong>(\d+)</strong>\s*signatories", markup)
    # The total includes people who signed without being named, so it should be at
    # least the number of names shown; fall back to that if the sentence moves.
    total = int(match.group(1)) if match else len(people)
    if total < len(people):
        total = len(people)
    return total, people


# ------------------------------------------------------------- shared


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
        default=pathlib.Path(__file__).resolve().parent.parent
        / "_data"
        / "signatories.yml",
    )
    parser.add_argument(
        "--published-list",
        default=PUBLISHED_LIST,
        help="URL of the Framework's own published signatory list",
    )
    parser.add_argument(
        "--require-supabase",
        action="store_true",
        help="fail rather than fall back to the published list",
    )
    args = parser.parse_args()

    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    if base and key:
        total, people = from_supabase(base, key)
        source = "the signature store directly"
    elif args.require_supabase:
        sys.exit(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required with "
            "--require-supabase. See docs/community-framework-operations.md."
        )
    else:
        total, people = from_published_list(args.published_list)
        source = args.published_list

    # The same person can sign more than once; show each only once.
    seen: set[tuple[str, str]] = set()
    unique = []
    for person in people:
        marker = (person["name"].lower(), person["affiliation"].lower())
        if marker in seen:
            continue
        seen.add(marker)
        unique.append(person)

    if not unique:
        sys.exit("Refusing to publish an empty signatory list; leaving the file alone.")

    unique.sort(key=lambda p: (p["name"].split()[-1].lower(), p["name"].lower()))

    lines = [
        "# Generated by scripts/fetch_signatories.py -- do not edit by hand.",
        "#",
        "# Public signatories of the EEG101 Community Framework. Only people who",
        "# ticked 'I'm happy for my name to be displayed publicly' appear here, and",
        "# only their name and affiliation are ever written to this file.",
        "",
        f"generated: {yaml_quote(dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'))}",
        f"source: {yaml_quote(source)}",
        f"total: {total}",
        f"public_count: {len(unique)}",
        "",
        "people:",
    ]
    for person in unique:
        lines.append(f"  - name: {yaml_quote(person['name'])}")
        lines.append(f"    affiliation: {yaml_quote(person['affiliation'])}")

    args.out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"wrote {args.out.name}: {len(unique)} public signatories "
        f"of {total} signatures in total, read from {source}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
