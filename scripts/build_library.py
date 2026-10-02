#!/usr/bin/env python3
"""Merge the curated Library and the Community Framework catalogue into one index.

The Library holds two collections that used to live apart:

  _data/library.yml        hand-curated EEG101 papers, with cover art, hosted
                           PDFs and open-access links. Edited by hand.
  _data/cf_catalogue.yml   the Community Framework reading list, generated from
                           the public Zotero group by build_catalogue.py.

This script reads both and writes _data/library_index.yml, the single collection
the Library page renders. Neither source file is modified, so the curated entries
stay hand-editable and the catalogue stays regenerable.

Topics
------
The two collections cannot share a tag vocabulary as they stand. The curated
entries carry a tidy dozen themes; the Zotero records carry 485 distinct tags
across 123 items, 411 of which appear exactly once, and include MeSH headings
("Humans", "Brain Mapping"), arXiv categories ("Computer Science - Machine
Learning"), BISAC codes ("Computers / Social Aspects") and many case variants of
the same idea ("Open science" / "open science" / "OPEN SCIENCE").

Rather than surface that as filter buttons, every item is assigned canonical
TOPICS by matching its own tags, title, venue and abstract against the vocabulary
below. Raw tags are kept on each item so search still finds them; they are just
not offered as facets. Items that match nothing keep their raw tags and are
reachable by search, by type, and by Framework part.

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

# Canonical topics, in display order. Each is a list of lowercase substrings
# matched against an item's tags, title, venue and abstract. Order matters only
# for display; an item can carry several topics.
#
# Patterns are deliberately specific. "ai" alone would match "chair"; "bci"
# alone would match nothing useful without the spelled-out form beside it.
# EEG101's own curated vocabulary -- the tags already in use on library.yml,
# which is what the Library has always filtered by. Nothing here is invented:
# each key is a tag the team already applies to its own papers. The lists are
# the words that mean that tag, used to carry it across to the Framework
# catalogue so both collections filter together.
#
# Order is the order the facets appear. The first nine are the filter buttons
# the Library already had; the rest are curated tags that only became worth
# promoting to a button once the catalogue was merged in.
#
# Patterns are anchored at a word start, so "reproducib" catches
# "reproducibility" while an acronym written "ica\\b" does not fire on
# "clinical", "publication" or "statistical".
TOPICS: dict[str, list[str]] = {
    "#EEG101-supported": ["eeg101-supported"],
    "History": [
        "history", "historical", "centenary", "100 years", "hans berger",
        "a century",
    ],
    "Reporting standards": [
        "reporting", "cobidas", "artem-is", "artemis", "checklist",
        "guideline", "good scientific practice", "documentation",
        "international standards",
    ],
    "Data harmonisation": [
        r"bids\b", "brain imaging data structure", "harmonis", "harmoniz",
        "standardis", "standardiz", "metadata", "curation", "interoperab",
        "data standard", "openneuro", "datalad", "repositor",
    ],
    "Global neuroscience": [
        "africa", r"lmics?\b", "low-income", "low and middle", "global south",
        "global neuroscience", "capacity building", "brain drain",
        "ethics dumping", "helicopter", "decoloni",
    ],
    "#EEGManyLabs": ["eegmanylabs"],
    "Community": [
        "community", "collaborat", "network", "consortium",
        "research culture", "career", "mentor", "training", "education",
        "scientists", "lab life",
    ],
    "Software": [
        "software", "toolbox", r"mne\b", "eeglab", "fieldtrip", "brainstorm",
        "matlab", "python", "open source", "analysis tool",
        "computer program", "code sharing", "platform",
    ],
    "Open Science": [
        "open science", "open-science", "open access", "open data",
        "data sharing", "transparen", "preprint", "fair data",
        "fair principle", "fair indicator", "openness", "diamond",
    ],
    "Methodology": [
        "methodolog", "method", "analysis pipeline", "statistical",
        "experimental design", "sample size", "power analysis",
        "signal processing", "artifact", "artefact", r"ica\b", "preprocess",
        r"erps?\b", "event-related", "time-frequency", "evoked potential",
    ],
    "Inclusivity": [
        "diversi", "inclusi", "equity", "equitab", r"weird\b",
        "representation", "gender", "ethnicit", "minorit", "accessib",
        "disabilit", "neurodiver", "under-represent", "underrepresent",
        "bias", "stigma",
    ],
    "Sustainability": [
        "carbon", "climate", "sustainab", "environment", "footprint",
        "1point5", "emission", "decarbon", "life cycle", "greenhouse",
        "recycl", "planetary", r"energy\b",
    ],
    "Reproducibility": [
        "reproducib", "replicat", "preregistrat", "pre-registrat",
        "registered report", "multiverse", "p-hacking",
        "questionable research", "false positive", "metascience",
        "many analysts",
    ],
    "Machine learning": [
        "machine learning", "deep learning", "artificial intelligence",
        "neural network", "large language model", r"llms?\b", "chatgpt",
        "classification", "algorithm", "generative ai",
    ],
    "Clinical EEG": [
        "clinical", "patient", "diagnos", "seizure", "epilep", "dementia",
        "alzheimer", "biomarker", "neurological disorder", "psychiatr",
    ],
    "EEG": [r"eegs?\b", "electroencephalo"],
    "MEG": [r"megs?\b", "magnetoencephalo"],
    "Conferences": ["conference", "symposium", "cuttinggardens", "cuttingeeg"],
    "Large-scale collaboration": [
        "many labs", "manylabs", "multi-site", "multisite", "large-scale",
        "consortium",
    ],
    "BIDS": [r"bids\b", "brain imaging data structure"],
    "Neonatal EEG": ["neonat", "newborn", r"infants?\b"],
    "Seizure detection": ["seizure detection", "seizure"],
    "ARTEM-IS": ["artem-is", "artemis"],
    "CuttingEEG": ["cuttingeeg", "cuttinggardens"],
    "FieldTrip": ["fieldtrip"],
    "Open source": ["open source", "open-source"],
    "Analysis tools": ["analysis tool", "toolbox"],
    "Replication": ["replicat"],
    "Alzheimer\u2019s disease": ["alzheimer"],
}

# A facet needs enough behind it to be worth a button; the rest stay as tags on
# the cards and in search. The buttons the Library already had are pinned
# regardless of count -- #EEG101-supported is how the Action surfaces the work
# it funded, and matters at two items as much as at fifty.
FACET_MIN = 5
ALWAYS_FACET = {
    "#EEG101-supported", "History", "Reporting standards", "Data harmonisation",
    "Global neuroscience", "#EEGManyLabs", "Community", "Software",
    "Open Science",
}


# Raw tags that carry no meaning for a reader: indexing vocabularies and
# repository categories that came along with the records.
JUNK_TAG_PATTERNS = [
    r"^computer science - ",
    r"^fos: ",
    r"^(computers|medical|law|family & relationships|social science|science) / ",
    r"^(humans|animals|male|female|adult|child|aged|young adult)$",
    r"^\d+$",
]

TYPE_ORDER = [
    "Journal article", "Preprint", "Review", "Book", "Book chapter",
    "Conference paper", "Report", "Standard", "Thesis", "Manuscript",
    "Document", "Software", "Dataset", "Video", "Presentation", "Podcast",
    "Audio recording", "Blog post", "Web page",
]


def is_junk(tag: str) -> bool:
    low = tag.strip().lower()
    return any(re.search(p, low) for p in JUNK_TAG_PATTERNS)


# Each pattern is anchored at a word start, so a prefix like "reproducib" still
# catches "reproducibility" while an acronym written "ica\\b" no longer fires on
# "clinical", "publication" or "statistical".
_TOPIC_RE = {
    topic: re.compile(
        "|".join(r"\b" + n for n in needles), re.IGNORECASE
    )
    for topic, needles in TOPICS.items()
}


def assign_topics(*fields: object) -> list[str]:
    """Match an item's own words against the canonical vocabulary."""
    haystack = " ".join(
        " ".join(f) if isinstance(f, list) else str(f or "") for f in fields
    )
    return [topic for topic, rx in _TOPIC_RE.items() if rx.search(haystack)]


def tidy_tags(tags: list[str] | None) -> list[str]:
    """Drop indexing junk and fold case variants to one spelling."""
    seen: dict[str, str] = {}
    for tag in tags or []:
        tag = re.sub(r"\s+", " ", str(tag)).strip()
        if not tag or is_junk(tag):
            continue
        key = tag.lower()
        # Prefer the capitalised spelling when the same tag appears both ways.
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

    # --- the curated EEG101 collection -----------------------------------
    canonical_by_lower = {t.lower(): t for t in TOPICS}
    for paper in curated:
        tags = tidy_tags(paper.get("tags"))
        theme = (paper.get("theme") or "").strip()
        # These entries were tagged by hand, so the tags on them ARE the answer;
        # take them as-is, folded to the canonical spelling, rather than
        # re-deriving topics from their words.
        topics = []
        for label in tags + [theme]:
            canonical = canonical_by_lower.get(label.strip().lower())
            if canonical and canonical not in topics:
                topics.append(canonical)
        items.append(
            {
                "id": paper["id"],
                "collection": "eeg101",
                "featured": True,
                "title": paper.get("title", ""),
                "authors": paper.get("authors", ""),
                "year": str(paper.get("year", "") or ""),
                "venue": paper.get("journal", ""),
                "type_label": "Journal article",
                "family": "bibliographic",
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
                "theme": theme,
                "parts": [],
                "topics": topics,
                "tags": tags,
            }
        )

    # --- the Community Framework catalogue -------------------------------
    for entry in cat_items:
        tags = tidy_tags(entry.get("tags"))
        topics = assign_topics(
            tags,
            entry.get("title"),
            entry.get("publication"),
            entry.get("abstract"),
        )
        link = (
            entry.get("url")
            or (f"https://doi.org/{entry['doi']}" if entry.get("doi") else "")
            or entry.get("zotero_url", "")
        )
        items.append(
            {
                "id": entry["id"],
                "collection": "framework",
                "featured": False,
                "title": entry.get("title", ""),
                "authors": entry.get("creators", ""),
                "year": str(entry.get("year", "") or ""),
                "venue": entry.get("publication", ""),
                "type_label": entry.get("type_label", "Document"),
                "family": entry.get("family", "bibliographic"),
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
                "parts": entry.get("sections") or [],
                "topics": topics,
                "tags": tags,
            }
        )

    # Curated entries first, then newest, then alphabetical.
    items.sort(
        key=lambda i: (
            0 if i["featured"] else 1,
            -(int(i["year"]) if i["year"].isdigit() else 0),
            i["title"].lower(),
        )
    )

    topic_counts = {
        t: sum(1 for i in items if t in i["topics"]) for t in TOPICS
    }
    type_counts: dict[str, int] = {}
    for item in items:
        type_counts[item["type_label"]] = type_counts.get(item["type_label"], 0) + 1

    lines = [
        "# Generated by scripts/build_library.py -- do not edit by hand.",
        "#",
        "# The merged Library: the curated EEG101 collection from library.yml plus",
        "# the Community Framework catalogue from cf_catalogue.yml, with a shared",
        "# topic vocabulary so both can be filtered together. Edit library.yml for",
        "# curated entries, or the Zotero group for Framework entries, then re-run",
        "# the script.",
        "",
        f"generated: {yaml_scalar(dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'))}",
        f"total: {len(items)}",
        f"curated_count: {sum(1 for i in items if i['featured'])}",
        f"framework_count: {sum(1 for i in items if not i['featured'])}",
        "",
        "topics:",
    ]
    for topic in TOPICS:
        if topic_counts[topic] >= FACET_MIN or (
            topic in ALWAYS_FACET and topic_counts[topic]
        ):
            lines += [
                f"  - name: {yaml_scalar(topic)}",
                f"    count: {topic_counts[topic]}",
            ]

    lines += ["", "types:"]
    for label in TYPE_ORDER:
        if type_counts.get(label):
            lines += [
                f"  - name: {yaml_scalar(label)}",
                f"    count: {type_counts[label]}",
            ]
    for label, count in sorted(type_counts.items()):
        if label not in TYPE_ORDER:
            lines += [f"  - name: {yaml_scalar(label)}", f"    count: {count}"]

    lines += ["", "items:"]
    for item in items:
        lines.append(f"  - id: {yaml_scalar(item['id'])}")
        for field in (
            "collection", "title", "authors", "year", "venue", "type_label",
            "family", "image", "url", "doi", "abstract", "oa_url", "oa_label",
            "source_url", "source_label", "access_version", "pdf", "theme",
        ):
            lines.append(f"    {field}: {yaml_scalar(item[field])}")
        lines.append(f"    featured: {yaml_scalar(item['featured'])}")
        lines.append("    parts: [" + ", ".join(str(p) for p in item["parts"]) + "]")
        if item["topics"]:
            lines.append("    topics:")
            lines += [f"      - {yaml_scalar(t)}" for t in item["topics"]]
        else:
            lines.append("    topics: []")
        if item["tags"]:
            lines.append("    tags:")
            lines += [f"      - {yaml_scalar(t)}" for t in item["tags"]]
        else:
            lines.append("    tags: []")

    (data / "library_index.yml").write_text("\n".join(lines) + "\n", encoding="utf-8")

    untagged = sum(1 for i in items if not i["topics"])
    print(f"wrote _data/library_index.yml: {len(items)} items")
    print(f"  curated EEG101 collection : {sum(1 for i in items if i['featured'])}")
    print(f"  Framework catalogue       : {sum(1 for i in items if not i['featured'])}")
    print(f"  items with no topic       : {untagged} ({untagged*100//len(items)}%)")
    print(f"\n  facets (curated tags with at least {FACET_MIN} items):")
    for topic in TOPICS:
        if topic_counts[topic] >= FACET_MIN or (
            topic in ALWAYS_FACET and topic_counts[topic]
        ):
            pin = "  (pinned)" if topic in ALWAYS_FACET and topic_counts[topic] < FACET_MIN else ""
            print(f"    {topic_counts[topic]:>4}  {topic}{pin}")
    small = [
        (t, topic_counts[t]) for t in TOPICS
        if 0 < topic_counts[t] < FACET_MIN and t not in ALWAYS_FACET
    ]
    if small:
        print("\n  curated tags too small for a button (still on cards and in search):")
        for t, n in small:
            print(f"    {n:>4}  {t}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
