#!/usr/bin/env python3
"""Merge the curated Library and the Community Framework catalogue into one index.

The Library holds two collections:

  _data/library.yml        hand-curated EEG101 papers, with cover art, hosted
                           PDFs and open-access links. Edited by hand.
  _data/cf_catalogue.yml   the Community Framework catalogue, generated from
                           the public Zotero group by build_catalogue.py.

This writes _data/library_index.yml, the single collection the Library page
renders, plus the facet lists it filters by. Neither source is modified.

Facets
------
The same four the standalone catalogue offered, so the Library filters the way
the catalogue did, plus Collection so the two can be told apart:

    Collection        EEG101 Collection / Community Framework
    Framework Section Educational, Validity, Publishing, Democratization,
                      Responsibility, Societal and technological responsibility
    Type              Journal Article, Webpage, Preprint, ...
    Language          English, French, Not specified

Checkboxes within a group are OR; groups are ANDed together.

Curated entries keep the tags the team assigned them. Those are shown on the
card and are searchable, but they are not facets -- the catalogue's own
vocabulary could never be reconciled with them (485 distinct Zotero tags across
123 items, 411 appearing exactly once), so filtering uses the structured facets
above instead of guessing tags for 311 records.

Usage
-----
    python3 scripts/build_library.py
"""

from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import re
import sys

# Art for a card with no cover of its own, by resource type. Files live in
# assets/images/library/ and are drawn in the site's own palette.
PLACEHOLDER_BY_TYPE = {
    "Journal Article": "article",
    "Preprint": "preprint",
    "Review": "article",
    "Magazine Article": "article",
    "Newspaper Article": "article",
    "Book": "book",
    "Book Section": "book",
    "Thesis": "book",
    "Manuscript": "document",
    "Document": "document",
    "Report": "document",
    "Standard": "document",
    "Conference Paper": "conference",
    "Presentation": "conference",
    "Webpage": "webpage",
    "Blog Post": "webpage",
    "Computer Program": "software",
    "Dataset": "software",
    "Video Recording": "video",
    "Podcast": "audio",
    "Audio Recording": "audio",
}
DEFAULT_PLACEHOLDER = "document"


def placeholder_for(type_label: str) -> str:
    slug = PLACEHOLDER_BY_TYPE.get(type_label, DEFAULT_PLACEHOLDER)
    return f"/assets/images/library/{slug}.svg"


JUNK_TAG_PATTERNS = [
    r"^computer science - ",
    r"^fos: ",
    r"^(computers|medical|law|family & relationships|social science|science) / ",
    r"^(humans|animals|male|female|adult|child|aged|young adult)$",
    r"^\d+$",
]


def is_junk(tag: str) -> bool:
    low = tag.strip().lower()
    return any(re.search(p, low) for p in JUNK_TAG_PATTERNS)


def tidy_tags(tags: list[str] | None) -> list[str]:
    """Drop indexing junk and fold case variants to one spelling."""
    seen: dict[str, str] = {}
    for tag in tags or []:
        tag = re.sub(r"\s+", " ", str(tag)).strip()
        if not tag or is_junk(tag):
            continue
        key = tag.lower()
        if key not in seen or (tag[:1].isupper() and not seen[key][:1].isupper()):
            seen[key] = tag
    return sorted(seen.values(), key=str.lower)


def yaml_scalar(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    text = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{text}"'


def main() -> int:
    try:
        import yaml
    except ImportError:
        sys.exit("PyYAML is required: python -m pip install pyyaml")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=pathlib.Path,
        default=pathlib.Path(__file__).resolve().parent.parent,
    )
    args = parser.parse_args()
    data = args.root / "_data"

    curated = yaml.safe_load((data / "library.yml").read_text(encoding="utf-8")) or []
    catalogue = yaml.safe_load(
        (data / "cf_catalogue.yml").read_text(encoding="utf-8")
    ) or {}
    cat_items = catalogue.get("items") or []

    items: list[dict] = []

    for paper in curated:
        items.append(
            {
                "id": paper["id"],
                "collection": "eeg101",
                "collection_label": "EEG101 Collection",
                "featured": True,
                "title": paper.get("title", ""),
                "authors": paper.get("authors", ""),
                "year": str(paper.get("year", "") or ""),
                "venue": paper.get("journal", ""),
                "type_label": "Journal Article",
                "language": "English",
                "image": paper.get("image", ""),
                "url": paper.get("open_access_url") or paper.get("source_url", ""),
                "doi": "",
                "abstract": "",
                "oa_url": paper.get("open_access_url", ""),
                "oa_label": paper.get("open_access_label", ""),
                "source_url": paper.get("source_url", ""),
                "source_label": paper.get("source_label", ""),
                "access_version": paper.get("access_version", ""),
                "pdf": paper.get("pdf", ""),
                "theme": (paper.get("theme") or "").strip(),
                "sections": [],
                "section_titles": [],
                "tags": tidy_tags(paper.get("tags")),
            }
        )

    for entry in cat_items:
        link = (
            entry.get("url")
            or (f"https://doi.org/{entry['doi']}" if entry.get("doi") else "")
            or entry.get("zotero_url", "")
        )
        language = entry.get("language") or "Unknown"
        items.append(
            {
                "id": entry["id"],
                "collection": "framework",
                "collection_label": "Community Framework",
                "featured": False,
                "title": entry.get("title", ""),
                "authors": entry.get("creators", ""),
                "year": str(entry.get("year", "") or ""),
                "venue": entry.get("publication", ""),
                "type_label": entry.get("type_label", "Document"),
                "language": "Not specified" if language == "Unknown" else language,
                "image": "",
                "url": link,
                "doi": entry.get("doi", ""),
                "abstract": entry.get("abstract", ""),
                "oa_url": "",
                "oa_label": "",
                "source_url": entry.get("zotero_url", ""),
                "source_label": "Zotero record",
                "access_version": "",
                "pdf": "",
                "theme": "",
                "sections": entry.get("sections") or [],
                "section_titles": entry.get("section_titles") or [],
                "tags": tidy_tags(entry.get("tags")),
            }
        )

    for item in items:
        if not item["image"]:
            item["placeholder"] = placeholder_for(item["type_label"])
        else:
            item["placeholder"] = ""

    items.sort(
        key=lambda i: (
            0 if i["featured"] else 1,
            -(int(i["year"]) if i["year"].isdigit() else 0),
            i["title"].lower(),
        )
    )

    def tally(key):
        out: dict[str, int] = {}
        for i in items:
            for v in (i[key] if isinstance(i[key], list) else [i[key]]):
                if v:
                    out[v] = out.get(v, 0) + 1
        return out

    type_counts = tally("type_label")
    lang_counts = tally("language")
    section_counts = tally("section_titles")

    lines = [
        "# Generated by scripts/build_library.py -- do not edit by hand.",
        "#",
        "# The merged Library: the curated EEG101 collection from library.yml plus",
        "# the Community Framework catalogue from cf_catalogue.yml, with the facet",
        "# lists the Library page filters by. Edit library.yml for curated entries,",
        "# or the Zotero group for Framework entries, then re-run the script.",
        "",
        f"generated: {yaml_scalar(dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'))}",
        f"total: {len(items)}",
        f"curated_count: {sum(1 for i in items if i['featured'])}",
        f"framework_count: {sum(1 for i in items if not i['featured'])}",
        "",
        "collections:",
        f"  - slug: \"eeg101\"",
        f"    name: \"EEG101 Collection\"",
        f"    count: {sum(1 for i in items if i['featured'])}",
        f"  - slug: \"framework\"",
        f"    name: \"Community Framework\"",
        f"    count: {sum(1 for i in items if not i['featured'])}",
        "",
        "sections:",
    ]
    for section in catalogue.get("sections") or []:
        count = section_counts.get(section["title"], 0)
        if count:
            lines += [
                f"  - slug: {yaml_scalar(section['slug'])}",
                f"    name: {yaml_scalar(section['title'])}",
                f"    count: {count}",
            ]

    lines += ["", "types:"]
    for entry in catalogue.get("types") or []:
        name = entry["name"]
        if type_counts.get(name):
            lines += [
                f"  - name: {yaml_scalar(name)}",
                f"    count: {type_counts[name]}",
            ]
    for name, count in sorted(type_counts.items(), key=lambda kv: -kv[1]):
        if name not in {e["name"] for e in (catalogue.get("types") or [])}:
            lines += [f"  - name: {yaml_scalar(name)}", f"    count: {count}"]

    lines += ["", "languages:"]
    for name in ("English", "French", "Not specified"):
        if lang_counts.get(name):
            lines += [
                f"  - name: {yaml_scalar(name)}",
                f"    count: {lang_counts[name]}",
            ]

    lines += ["", "items:"]
    for item in items:
        lines.append(f"  - id: {yaml_scalar(item['id'])}")
        for field in (
            "collection", "collection_label", "title", "authors", "year", "venue",
            "type_label", "language", "image", "placeholder", "url", "doi",
            "abstract", "oa_url", "oa_label", "source_url", "source_label",
            "access_version", "pdf", "theme",
        ):
            lines.append(f"    {field}: {yaml_scalar(item[field])}")
        lines.append(f"    featured: {yaml_scalar(item['featured'])}")
        lines.append(
            "    sections: [" + ", ".join(yaml_scalar(s) for s in item["sections"]) + "]"
        )
        lines.append(
            "    section_titles: ["
            + ", ".join(yaml_scalar(s) for s in item["section_titles"]) + "]"
        )
        if item["tags"]:
            lines.append("    tags:")
            lines += [f"      - {yaml_scalar(t)}" for t in item["tags"]]
        else:
            lines.append("    tags: []")

    (data / "library_index.yml").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"wrote _data/library_index.yml: {len(items)} items")
    print(f"  EEG101 Collection    : {sum(1 for i in items if i['featured'])}")
    print(f"  Community Framework  : {sum(1 for i in items if not i['featured'])}")
    print("\n  Framework Section:")
    for section in catalogue.get("sections") or []:
        n = section_counts.get(section["title"], 0)
        if n:
            print(f"    {n:>4}  {section['title']}")
    print("\n  Type:")
    for name, n in sorted(type_counts.items(), key=lambda kv: -kv[1]):
        print(f"    {n:>4}  {name}")
    print("\n  Language:")
    for name in ("English", "French", "Not specified"):
        if lang_counts.get(name):
            print(f"    {lang_counts[name]:>4}  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
