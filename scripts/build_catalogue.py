#!/usr/bin/env python3
"""Build _data/cf_catalogue.yml from the Community Framework's Zotero library.

The standalone catalogue (catalog-cf.eeg101.eu) is a Next.js app that queries the
Zotero API on every revalidation using an API key. The main site is a static
Jekyll build on GitHub Pages, so there is no server to query from -- but the
EEG101 Community Framework Zotero group (5794905) is a *public* group, which means
its items can be read with no API key at all. This script reads them at authoring
time and writes a plain data file that Jekyll renders statically. No secrets, no
runtime dependency on Zotero being up, and the catalogue keeps working even if
the Vercel deployment goes away.

Re-run it to refresh the catalogue (a scheduled GitHub Action does this nightly).

Usage
-----
    python3 scripts/build_catalogue.py
    python3 scripts/build_catalogue.py --include-subcollections
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ZOTERO_GROUP_ID = "5794905"
API = f"https://api.zotero.org/groups/{ZOTERO_GROUP_ID}"

# The three Framework parts, mirroring COLLECTION_KEYS in the standalone
# catalogue so that the two views agree item for item.
#
# `children` lists subcollections of that part. They are EXCLUDED by default
# because the standalone catalogue excludes them too, and porting a different
# item set would make the two catalogues silently disagree. Together with the
# separate "Part 0: Educational" collection (JR7LCI93, 13 further items) this
# hides 28 items that are in the library but in no Framework part the catalogue
# reads. Pass --include-subcollections to fold the children in; adding Part 0 is
# an editorial decision for the Framework steering group, not a flag.
SECTIONS = [
    {
        "key": "F9DNTXQA",
        "number": 1,
        "title": "Validity and Research integrity",
        "anchor": "cf-validity",
        "children": ["UKQ3NDAL"],  # Publishing (14 items in no other part)
    },
    {
        "key": "ZD2RV8H9",
        "number": 2,
        "title": "Democratization",
        "anchor": "cf-democratization",
        "children": [],
    },
    {
        "key": "L72L5WAP",
        "number": 3,
        "title": "Responsibility",
        "anchor": "cf-responsibility",
        "children": ["XT96NNWY"],  # Societal and technological responsibility (1)
    },
]

# Zotero item type -> resource family, lifted from the standalone catalogue's
# src/lib/zotero/constants.js so the two stay in step.
FAMILIES = {
    "bibliographic": "Bibliographic",
    "multimedia": "Multimedia",
    "technical": "Technical & tools",
    "webpage": "Web page",
}
ITEM_TYPE_TO_FAMILY = {
    **{
        t: "bibliographic"
        for t in (
            "article bookSection book journalArticle magazineArticle"
            " newspaperArticle thesis letter manuscript preprint review report"
            " encyclopediaArticle conferencePaper document"
        ).split()
    },
    **{
        t: "multimedia"
        for t in (
            "film presentation videoRecording audioRecording interview artwork"
            " podcast radioBroadcast tvBroadcast"
        ).split()
    },
    **{
        t: "technical"
        for t in (
            "software computerProgram dataset standard map patent case bill"
            " statute"
        ).split()
    },
    **{t: "webpage" for t in "webpage blogPost forumPost attachment".split()},
}

# Human-readable labels for the item types actually present in the library.
TYPE_LABELS = {
    "audioRecording": "Audio recording",
    "blogPost": "Blog post",
    "book": "Book",
    "bookSection": "Book chapter",
    "computerProgram": "Software",
    "conferencePaper": "Conference paper",
    "dataset": "Dataset",
    "document": "Document",
    "journalArticle": "Journal article",
    "magazineArticle": "Magazine article",
    "manuscript": "Manuscript",
    "newspaperArticle": "Newspaper article",
    "podcast": "Podcast",
    "preprint": "Preprint",
    "presentation": "Presentation",
    "report": "Report",
    "software": "Software",
    "standard": "Standard",
    "thesis": "Thesis",
    "videoRecording": "Video",
    "webpage": "Web page",
}


def label_for_type(item_type: str) -> str:
    if item_type in TYPE_LABELS:
        return TYPE_LABELS[item_type]
    # Fall back on de-camel-casing an unexpected type rather than showing "n/a".
    spaced = re.sub(r"(?<!^)(?=[A-Z])", " ", item_type)
    return spaced[:1].upper() + spaced[1:].lower()


def fetch_collection(key: str) -> list[dict]:
    """Fetch every top-level item of a collection, following pagination."""
    items: list[dict] = []
    start = 0
    while True:
        url = f"{API}/collections/{key}/items/top?format=json&limit=100&start={start}"
        request = urllib.request.Request(
            url, headers={"Zotero-API-Version": "3", "User-Agent": "eeg101.eu build"}
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
                page = json.load(response)
        except urllib.error.HTTPError as error:
            sys.exit(f"Zotero API returned {error.code} for collection {key}: {error}")
        if not page:
            break
        items.extend(page)
        if len(page) < 100:
            break
        start += 100
    return items


def normalise_language(code: str | None) -> str:
    if not code:
        return "Unknown"
    code = code.lower().strip()
    if code in ("en", "eng", "english") or code.startswith(("en-", "en_")):
        return "English"
    if code in ("fr", "french") or code.startswith(("fr-", "fr_")):
        return "French"
    return "Unknown"


def format_creators(creators: list[dict] | None) -> str:
    if not creators:
        return ""
    names = []
    for creator in creators:
        if creator.get("name"):
            names.append(creator["name"])
            continue
        parts = [creator.get("firstName", ""), creator.get("lastName", "")]
        name = " ".join(p for p in parts if p).strip()
        if name:
            names.append(name)
    return ", ".join(names)


def extract_year(date: str | None) -> str:
    if not date:
        return ""
    match = re.search(r"\d{4}", date)
    return match.group(0) if match else ""


def url_from_extra(extra: str | None) -> str:
    if not extra:
        return ""
    match = re.search(r"https?://[^\s]+", extra)
    return match.group(0).rstrip(".,;)") if match else ""


def youtube_id(url: str) -> str:
    for pattern in (
        r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"youtube(?:-nocookie)?\.com/embed/([a-zA-Z0-9_-]{11})",
    ):
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""


def yaml_scalar(value: object) -> str:
    """Emit a YAML scalar. Everything textual is double-quoted and escaped."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    text = str(value)
    text = (
        text.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r\n", " ")
        .replace("\n", " ")
        .replace("\t", " ")
    )
    text = re.sub(r"\s{2,}", " ", text).strip()
    return f'"{text}"'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--include-subcollections",
        action="store_true",
        help="also read each part's subcollections (28 otherwise-hidden items)",
    )
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=pathlib.Path(__file__).resolve().parent.parent,
        help="repository root to write into",
    )
    args = parser.parse_args()

    # key -> record, so an item filed under two parts appears once with both.
    records: dict[str, dict] = {}
    counts: dict[int, int] = {}

    for section in SECTIONS:
        keys = [section["key"]]
        if args.include_subcollections:
            keys += section["children"]
        raw_items: list[dict] = []
        for key in keys:
            raw_items.extend(fetch_collection(key))
        counts[section["number"]] = len({i["key"] for i in raw_items})
        print(
            f"Part {section['number']} ({section['title']}): "
            f"{len(raw_items)} items from {len(keys)} collection(s)"
        )

        for item in raw_items:
            data = item.get("data", item)
            key = item["key"]
            if key in records:
                if section["number"] not in records[key]["sections"]:
                    records[key]["sections"].append(section["number"])
                continue

            item_type = data.get("itemType", "document")
            family = ITEM_TYPE_TO_FAMILY.get(item_type, "bibliographic")
            url = (data.get("url") or "").strip()
            extra_url = url_from_extra(data.get("extra"))
            video = youtube_id(url) or youtube_id(extra_url)

            records[key] = {
                "id": key,
                "title": data.get("title") or "(Untitled)",
                "type": item_type,
                "type_label": label_for_type(item_type),
                "family": family,
                "family_label": FAMILIES[family],
                "creators": format_creators(data.get("creators")),
                "year": extract_year(data.get("date")),
                "language": normalise_language(data.get("language")),
                "publication": (
                    data.get("publicationTitle")
                    or data.get("bookTitle")
                    or data.get("websiteTitle")
                    or data.get("repository")
                    or data.get("publisher")
                    or ""
                ),
                "url": url,
                "extra_url": "" if extra_url == url else extra_url,
                "doi": (data.get("DOI") or "").strip(),
                "abstract": data.get("abstractNote") or "",
                "video_id": video,
                "tags": [t.get("tag", "") for t in data.get("tags") or []],
                "sections": [section["number"]],
                "zotero_url": (
                    f"https://www.zotero.org/groups/{ZOTERO_GROUP_ID}/items/{key}"
                ),
            }

    items = sorted(
        records.values(),
        # Newest first, untitled/undated last, then alphabetically.
        key=lambda r: (-(int(r["year"]) if r["year"].isdigit() else 0), r["title"].lower()),
    )
    for record in items:
        record["sections"].sort()

    lines = [
        "# Generated by scripts/build_catalogue.py -- do not edit by hand.",
        "#",
        "# The EEG101 Community Framework resource catalogue, read from the public",
        f"# Zotero group {ZOTERO_GROUP_ID} at authoring time. Re-run the script to refresh.",
        "",
        f"generated: {yaml_scalar(dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'))}",
        f"zotero_group: {yaml_scalar(ZOTERO_GROUP_ID)}",
        f"zotero_url: {yaml_scalar(f'https://www.zotero.org/groups/{ZOTERO_GROUP_ID}/library')}",
        f"item_count: {len(items)}",
        f"includes_subcollections: {yaml_scalar(args.include_subcollections)}",
        "",
        "sections:",
    ]
    for section in SECTIONS:
        lines += [
            f"  - number: {section['number']}",
            f"    title: {yaml_scalar(section['title'])}",
            f"    anchor: {yaml_scalar(section['anchor'])}",
            f"    count: {counts[section['number']]}",
        ]

    lines += ["", "families:"]
    for slug, label in FAMILIES.items():
        count = sum(1 for r in items if r["family"] == slug)
        lines += [
            f"  - slug: {yaml_scalar(slug)}",
            f"    label: {yaml_scalar(label)}",
            f"    count: {count}",
        ]

    lines += ["", "items:"]
    for record in items:
        lines.append(f"  - id: {yaml_scalar(record['id'])}")
        for field in (
            "title",
            "type",
            "type_label",
            "family",
            "family_label",
            "creators",
            "year",
            "language",
            "publication",
            "url",
            "extra_url",
            "doi",
            "abstract",
            "video_id",
            "zotero_url",
        ):
            lines.append(f"    {field}: {yaml_scalar(record[field])}")
        lines.append(
            "    sections: [" + ", ".join(str(s) for s in record["sections"]) + "]"
        )
        if record["tags"]:
            lines.append("    tags:")
            lines += [f"      - {yaml_scalar(t)}" for t in record["tags"]]
        else:
            lines.append("    tags: []")

    out = args.out / "_data" / "cf_catalogue.yml"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nwrote _data/cf_catalogue.yml: {len(items)} distinct items")
    for slug, label in FAMILIES.items():
        print(f"  {label:20s} {sum(1 for r in items if r['family'] == slug)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
