#!/usr/bin/env python3
"""Validate an eCOST member export and rebuild the EEG101 Network Map dataset.

The script is deliberately conservative. It refuses to overwrite the public map
when the export is incomplete or unexpectedly small. Institutions with no
resolved location are handled in layers:

  Option C — Fuzzy carry-forward: if the institution closely matches one
             already in the reviewed map, reuse that reviewed location.
  Option B — Multi-step geocoding (--geocode-missing): strip legal entity
             suffixes and parenthesised acronyms, then retry Nominatim.
  Option A — Pending list: members still unresolved after C and B are written
             to assets/data/pending-members.json and shown in the directory
             without a map pin (rather than being placed at 0°/0°).
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import difflib
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable


REQUIRED_FIELDS = {"first name", "last name", "email", "affiliation", "country"}
GROUP_FIELD_CANDIDATES = {"assigned working groups", "application working groups"}
GROUP_PATTERN = re.compile(r"\bWG\s*([123])\b", re.IGNORECASE)
COUNTRY_SUFFIX_PATTERN = re.compile(r"\s*\([A-Z]{2,3}\)\s*$")
COUNTRY_ALIASES = {"Turkey": "Türkiye", "Turkiye": "Türkiye"}

# Legal / administrative suffixes that Nominatim cannot geocode and should be
# stripped before a second geocoding attempt (Option B).
LEGAL_JUNK_PATTERN = re.compile(
    r"\b(?:"
    r"stiftung\s+(?:\w+\s+)*rechts?"   # "Stiftung Offentlichen Rechts"
    r"|offentlichen\s+rechts?"
    r"|asociacion\s+civil"
    r"|asociaci[oó]n\s+civil"
    r"|stiftung"
    r"|foundation"
    r"|gesellschaft"
    r"|g\.?m\.?b\.?h\.?"
    r"|s\.?r\.?l\.?"
    r"|s\.?a\.?s\.?"
    r"|inc\.?"
    r"|ltd\.?"
    r"|l\.?l\.?c\.?"
    r"|corp\.?"
    r")\b",
    re.IGNORECASE,
)

# Country values in the eCOST export that are not geographic and therefore
# useless for geocoding (e.g. "International Organisations").
NON_GEOGRAPHIC_COUNTRIES = {
    "international organisations",
    "international organization",
    "international organizations",
    "n/a",
    "other",
}

FUZZY_MATCH_THRESHOLD = 0.82   # SequenceMatcher ratio for Option C carry-forward


# ---------------------------------------------------------------------------
# Basic helpers
# ---------------------------------------------------------------------------

def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def field_key(value: str) -> str:
    return re.sub(r"\s+", " ", clean(value).lstrip("﻿").lower())


def ascii_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def normalise_country(value: str) -> str:
    country = COUNTRY_SUFFIX_PATTERN.sub("", clean(value))
    return COUNTRY_ALIASES.get(country, country)


def obfuscate_email(value: str) -> str:
    email = clean(value)
    if "@" not in email:
        return ""
    local, domain = email.split("@", 1)
    return f"{local} [at] {domain.replace('.', ' [dot] ')}"


def simplify_institution_name(name: str) -> str:
    """Strip parenthesised acronyms and legal-entity suffixes for a retry geocode."""
    # Remove anything in parentheses or brackets: "(CONICET)", "( I.u.s.s.)"
    simplified = re.sub(r"\s*[\(\[][^)\]]*[\)\]]\s*", " ", name)
    # Remove legal suffixes
    simplified = LEGAL_JUNK_PATTERN.sub(" ", simplified)
    # Collapse extra whitespace, trailing commas/hyphens
    simplified = re.sub(r"\s{2,}", " ", simplified).strip().rstrip(",-").strip()
    return simplified


# ---------------------------------------------------------------------------
# CSV / XLSX loading
# ---------------------------------------------------------------------------

def coerce_rows_from_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        preview = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(preview, delimiters=";,\t")
        except csv.Error:
            dialect = csv.excel
            dialect.delimiter = ";"
        return [
            {field_key(key): clean(value) for key, value in row.items() if key is not None}
            for row in csv.DictReader(handle, dialect=dialect)
        ]


def coerce_rows_from_xlsx(path: Path) -> list[dict[str, str]]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise RuntimeError("The .xlsx export requires openpyxl.") from exc
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook.active
    rows = worksheet.iter_rows(values_only=True)
    headers = [field_key(value) for value in next(rows)]
    return [
        {headers[index]: clean(value) for index, value in enumerate(row) if index < len(headers)}
        for row in rows
        if any(clean(value) for value in row)
    ]


def load_rows(path: Path) -> list[dict[str, str]]:
    if path.suffix.lower() == ".csv":
        return coerce_rows_from_csv(path)
    if path.suffix.lower() == ".xlsx":
        return coerce_rows_from_xlsx(path)
    raise RuntimeError("eCOST export must be a .csv or .xlsx file.")


# ---------------------------------------------------------------------------
# Working group extraction
# ---------------------------------------------------------------------------

def extract_groups(row: dict[str, str]) -> list[str]:
    text = " ".join(row.get(field, "") for field in GROUP_FIELD_CANDIDATES)
    groups = {f"WG{group}" for group in GROUP_PATTERN.findall(text)}
    for number in (1, 2, 3):
        value = row.get(f"wg{number}. reporting standards", "") if number == 1 else ""
        if number == 2:
            value = row.get("wg2. curation and harmonization", "")
        if number == 3:
            value = row.get("wg3. manifesto", "")
        if clean(value).lower() in {"y", "yes", "true", "1"}:
            groups.add(f"WG{number}")
    return sorted(groups, key=lambda group: int(group[-1]))


# ---------------------------------------------------------------------------
# Geocoding (Option B — multi-step)
# ---------------------------------------------------------------------------

def _nominatim_lookup(query: str) -> tuple[float, float] | None:
    """Single Nominatim query. Returns (lat, lon) or None."""
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": "1",
        "addressdetails": "0",
    })
    req = urllib.request.Request(url, headers={"User-Agent": "EEG101-NetworkMap/1.0 (eeg101.eu)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            results = json.loads(response.read())
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:
        print(f"  Nominatim request failed: {exc}", file=sys.stderr)
    return None


def geocode_institution(name: str, country: str) -> tuple[float, float] | None:
    """Try up to three Nominatim queries, each with ≥1 s spacing (rate limit).

    Attempt 1 — full name + country (or name alone for non-geographic countries).
    Attempt 2 — simplified name (strip acronyms, legal suffixes) + country.
    """
    is_non_geographic = ascii_key(country) in NON_GEOGRAPHIC_COUNTRIES

    # Attempt 1: full name
    query1 = name if is_non_geographic else f"{name}, {country}"
    result = _nominatim_lookup(query1)
    if result:
        return result

    # Attempt 2: simplified name
    simplified = simplify_institution_name(name)
    if simplified and ascii_key(simplified) != ascii_key(name):
        time.sleep(1.1)
        query2 = simplified if is_non_geographic else f"{simplified}, {country}"
        result = _nominatim_lookup(query2)
        if result:
            print(f"  Resolved via simplified name: {simplified!r}", flush=True)
            return result

    return None


# ---------------------------------------------------------------------------
# Location index and fuzzy carry-forward (Option C)
# ---------------------------------------------------------------------------

def build_location_index(current: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    locations: dict[tuple[str, str], dict[str, Any]] = {}
    for site in current.get("sites", []):
        country = normalise_country(site["country"])
        location = {
            "institution": site["institution"],
            "city": site["city"],
            "country": country,
            "latitude": site["latitude"],
            "longitude": site["longitude"],
            "location_confidence": site.get("location_confidence", "reviewed"),
        }
        aliases = {site.get("institution", "")}
        aliases.update(member.get("affiliation", "") for member in site.get("members", []))
        for alias in aliases:
            key = (ascii_key(alias), ascii_key(country))
            if key[0]:
                locations[key] = location
    return locations


def find_fuzzy_location(
    affiliation: str,
    country: str,
    locations: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any] | None:
    """Option C: fuzzy-match an unresolved institution against existing reviewed
    locations in the same country and return the best match above the threshold.

    This catches typos ("Pychology" vs "Psyсhology") and minor name variations
    without placing members at incorrect sites in other countries.
    """
    aff_key = ascii_key(affiliation)
    country_key = ascii_key(country)
    best_ratio = 0.0
    best_location: dict[str, Any] | None = None

    for (inst_key, loc_country_key), location in locations.items():
        if loc_country_key != country_key:
            continue
        ratio = difflib.SequenceMatcher(None, aff_key, inst_key).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_location = location

    if best_ratio >= FUZZY_MATCH_THRESHOLD and best_location is not None:
        print(
            f"  Fuzzy carry-forward ({best_ratio:.0%}): {affiliation!r} → "
            f"{best_location['institution']!r}",
            flush=True,
        )
        return best_location
    return None


# ---------------------------------------------------------------------------
# Header validation
# ---------------------------------------------------------------------------

def validate_headers(rows: list[dict[str, str]]) -> None:
    if not rows:
        raise RuntimeError("The eCOST export contains no member rows.")
    headers = set(rows[0])
    missing = sorted(REQUIRED_FIELDS - headers)
    has_group_source = bool(headers & GROUP_FIELD_CANDIDATES) or any(
        field.startswith("wg1.") or field.startswith("wg2.") or field.startswith("wg3.")
        for field in headers
    )
    if missing or not has_group_source:
        details = []
        if missing:
            details.append("missing fields: " + ", ".join(missing))
        if not has_group_source:
            details.append("no Working Group assignment fields")
        raise RuntimeError(
            "The downloaded export cannot safely rebuild the public map (" + "; ".join(details) + "). "
            "Use the detailed eCOST member export that includes affiliations, countries, and Working Group assignments."
        )


# ---------------------------------------------------------------------------
# Member mapping
# ---------------------------------------------------------------------------

def map_members(
    rows: Iterable[dict[str, str]],
    locations: dict[tuple[str, str], dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    unresolved: list[dict[str, Any]] = []

    for row in rows:
        first = clean(row.get("first name"))
        last = clean(row.get("last name"))
        name = " ".join(part for part in (first, last) if part)
        email = clean(row.get("email"))
        affiliation = clean(row.get("affiliation"))
        country = normalise_country(row.get("country", ""))
        if not name or not email or not affiliation or not country:
            raise RuntimeError("A required member value is blank in the eCOST export.")

        location_key = (ascii_key(affiliation), ascii_key(country))
        location = locations.get(location_key)
        if location is None:
            # Include all fields so pending members can be shown in the directory.
            unresolved.append({
                "name": name,
                "affiliation": affiliation,
                "country": country,
                "working_groups": extract_groups(row),
                "email": obfuscate_email(email),
                "homepage": clean(row.get("homepages")),
                "orcid": clean(row.get("orcid")),
            })
            continue

        member = {
            "name": name,
            "affiliation": affiliation,
            "working_groups": extract_groups(row),
            "email": obfuscate_email(email),
            "homepage": clean(row.get("homepages")),
            "orcid": clean(row.get("orcid")),
        }
        site_key = (ascii_key(location["institution"]), ascii_key(location["country"]))
        if site_key not in grouped:
            grouped[site_key] = {"location": location, "members": []}
        grouped[site_key]["members"].append(member)

    sites: list[dict[str, Any]] = []
    ordered_groups = sorted(
        grouped.values(),
        key=lambda group: (group["location"]["institution"].casefold(), group["location"]["country"].casefold()),
    )
    for index, group in enumerate(ordered_groups, start=1):
        location = group["location"]
        members = group["members"]
        members.sort(key=lambda member: member["name"].casefold())
        working_groups = sorted({tag for member in members for tag in member["working_groups"]}, key=lambda tag: int(tag[-1]))
        sites.append({
            "id": f"site-{index}",
            **location,
            "members": members,
            "member_count": len(members),
            "working_groups": working_groups,
        })
    return sites, unresolved


# ---------------------------------------------------------------------------
# Main dataset builder
# ---------------------------------------------------------------------------

def build_dataset(
    export_path: Path,
    existing_path: Path,
    output_path: Path,
    report_path: Path,
    pending_path: Path,
    geocode_missing: bool = False,
) -> None:
    rows = load_rows(export_path)
    validate_headers(rows)
    current = json.loads(existing_path.read_text(encoding="utf-8"))
    baseline_count = int(current.get("member_count", 0))
    minimum_count = max(20, int(baseline_count * 0.7))
    if len(rows) < minimum_count:
        raise RuntimeError(
            f"Export contains {len(rows)} members, below the safety threshold of {minimum_count}."
        )

    locations = build_location_index(current)
    sites, unresolved = map_members(rows, locations)

    if unresolved:
        # ------------------------------------------------------------------ #
        # Option C — fuzzy carry-forward from existing reviewed locations.    #
        # ------------------------------------------------------------------ #
        still_unresolved: list[dict[str, Any]] = []
        fuzzy_resolved = 0
        seen_fuzzy: dict[tuple[str, str], dict[str, Any] | None] = {}
        for member in unresolved:
            key = (member["affiliation"], member["country"])
            if key not in seen_fuzzy:
                seen_fuzzy[key] = find_fuzzy_location(member["affiliation"], member["country"], locations)
            fuzzy_loc = seen_fuzzy[key]
            if fuzzy_loc is not None:
                # Add to location index so map_members re-run can pick it up.
                loc_key = (ascii_key(member["affiliation"]), ascii_key(member["country"]))
                locations[loc_key] = fuzzy_loc
                fuzzy_resolved += 1
            else:
                still_unresolved.append(member)

        if fuzzy_resolved:
            print(f"Fuzzy carry-forward resolved {fuzzy_resolved} member(s).", flush=True)
            sites, unresolved = map_members(rows, locations)

    if unresolved and geocode_missing:
        # ------------------------------------------------------------------ #
        # Option B — multi-step Nominatim geocoding for remaining unknowns.  #
        # Failed geocodes are excluded (never placed at 0,0).               #
        # ------------------------------------------------------------------ #
        seen_geocode: dict[tuple[str, str], bool] = {}
        geocoded_count = 0
        geocode_failed: list[dict[str, Any]] = []

        for member in unresolved:
            key = (member["affiliation"], member["country"])
            if key in seen_geocode:
                continue
            seen_geocode[key] = True
            affiliation, country = member["affiliation"], member["country"]
            print(f"Geocoding new institution: {affiliation!r} ({country})", flush=True)
            coords = geocode_institution(affiliation, country)
            time.sleep(1.1)  # Nominatim rate limit: ≤1 req/s

            if coords is None:
                print(
                    f"  Could not geocode {affiliation!r} — member will appear in pending list.",
                    file=sys.stderr,
                )
                geocode_failed.append({"affiliation": affiliation, "country": country})
            else:
                lat, lon = coords
                locations[(ascii_key(affiliation), ascii_key(country))] = {
                    "institution": affiliation,
                    "city": "",
                    "country": country,
                    "latitude": lat,
                    "longitude": lon,
                    "location_confidence": "geocoded",
                }
                geocoded_count += 1

        if geocoded_count:
            print(f"Auto-geocoded {geocoded_count} new institution(s).", flush=True)
        if geocode_failed:
            print(
                f"{len(geocode_failed)} institution(s) could not be geocoded — "
                "affected members written to pending list.",
                file=sys.stderr,
            )

        # Re-run; members at still-unresolved institutions remain in unresolved.
        sites, unresolved = map_members(rows, locations)

    # ---------------------------------------------------------------------- #
    # Option A — write pending-members.json for the member directory.         #
    # ---------------------------------------------------------------------- #
    pending_path.parent.mkdir(parents=True, exist_ok=True)
    pending_data: dict[str, Any] = {
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "note": (
            "These members are registered EEG101 members whose institution location "
            "could not be automatically resolved. They are shown in the member directory "
            "but do not appear on the map."
        ),
        "pending_count": len(unresolved),
        "members": unresolved,
    }
    pending_path.write_text(json.dumps(pending_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ---------------------------------------------------------------------- #
    # Report                                                                  #
    # ---------------------------------------------------------------------- #
    report = {
        "export": export_path.name,
        "export_member_count": len(rows),
        "baseline_member_count": baseline_count,
        "resolved_member_count": sum(site["member_count"] for site in sites),
        "pending_member_count": len(unresolved),
        "unresolved_institutions": [
            {"affiliation": m["affiliation"], "country": m["country"]} for m in unresolved
        ],
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if unresolved and not geocode_missing:
        raise RuntimeError(
            f"{len(unresolved)} members have institutions without reviewed map locations. "
            f"See {report_path}; the public map was not changed."
        )

    # ---------------------------------------------------------------------- #
    # Build and write network-map.json                                        #
    # ---------------------------------------------------------------------- #
    countries: dict[str, dict[str, Any]] = {}
    for site in sites:
        country = countries.setdefault(site["country"], {"name": site["country"], "site_count": 0, "member_count": 0})
        country["site_count"] += 1
        country["member_count"] += site["member_count"]

    dataset = {
        "generated_from": export_path.name,
        "member_count": len(rows),
        "site_count": len(sites),
        "country_count": len(countries),
        "countries": sorted(countries.values(), key=lambda country: country["name"]),
        "sites": sites,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "members": len(rows),
        "sites": len(sites),
        "countries": len(countries),
        "pending": len(unresolved),
        "report": str(report_path),
    }, ensure_ascii=False))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Synchronise a detailed eCOST export to the EEG101 Network Map")
    parser.add_argument("--input", type=Path, required=True, help="Detailed eCOST .csv or .xlsx export")
    parser.add_argument("--existing", type=Path, default=Path("assets/data/network-map.json"))
    parser.add_argument("--output", type=Path, default=Path("assets/data/network-map.json"))
    parser.add_argument("--pending", type=Path, default=Path("assets/data/pending-members.json"),
                        help="Output path for members whose institution location could not be resolved")
    parser.add_argument("--report", type=Path, default=Path(".tmp/ecost-sync/report.json"))
    parser.add_argument(
        "--geocode-missing",
        action="store_true",
        help="Auto-geocode institutions not yet in the map using Nominatim (OpenStreetMap). "
             "Geocoded sites are marked location_confidence=geocoded for human review. "
             "Institutions that cannot be geocoded are written to --pending rather than "
             "placed at 0°/0°.",
    )
    args = parser.parse_args()

    try:
        build_dataset(
            args.input,
            args.existing,
            args.output,
            args.report,
            args.pending,
            geocode_missing=args.geocode_missing,
        )
    except Exception as exc:
        print(f"Network Map sync failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
