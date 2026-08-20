#!/usr/bin/env python3
"""Build the initial values payload for the private EEG101 raw eCOST export workbook."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "assets" / "data" / "network-map.json"


def cache_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def main() -> None:
    dataset = json.loads(DATA.read_text(encoding="utf-8"))
    read_me = [
        ["EEG101 Members: eCOST Export"],
        ["Purpose", "This workbook is the controlled source for the public EEG101 Members map and directory."],
        ["Your routine", "Export the detailed eCOST Working Group member CSV, then paste the entire export, including its original header row, into cell A1 of the ‘Raw eCOST export’ tab."],
        ["Do not edit", "Do not rename, rearrange, or add custom columns to the Raw eCOST export tab. The publishing action reads the eCOST structure directly."],
        ["Publish", "Select EEG101 Members → Validate and publish. The action validates required eCOST fields, refreshes locations, and only updates the public website after a successful check."],
        ["Location cache", "This tab is maintained automatically. New institutions are geocoded from institution plus country. If that is uncertain, the action uses a country-level provisional location and records the item for review."],
        ["Review", "Use the Publishing log only to review warnings. You should usually need no map maintenance unless a new institution needs a more precise placement."],
        ["Privacy", "The public website receives obfuscated email addresses only. The raw eCOST export and the workbook remain private."],
    ]
    cache_header = [["cache_key", "type", "institution", "country", "city", "latitude", "longitude", "confidence", "source", "updated_at", "review_status"]]
    cache_rows = []
    for site in dataset["sites"]:
        cache_rows.append([
            f"institution|{cache_key(site['institution'])}|{cache_key(site['country'])}",
            "institution",
            site["institution"],
            site["country"],
            site["city"],
            site["latitude"],
            site["longitude"],
            site.get("location_confidence", "reviewed"),
            "Existing EEG101 reviewed map data",
            "",
            "Approved",
        ])
    log_header = [["timestamp", "result", "source_rows", "published_members", "published_sites", "new_location_records", "provisional_locations", "commit", "notes"]]
    payload = {
        "valueInputOption": "RAW",
        "data": [
            {"range": "Read me!A1:B8", "values": read_me},
            {"range": "Location cache!A1:K%d" % (len(cache_rows) + 1), "values": cache_header + cache_rows},
            {"range": "Publishing log!A1:I1", "values": log_header},
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
