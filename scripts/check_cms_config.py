#!/usr/bin/env python3
"""Check that the Pages CMS editor config (.pages.yml) still matches the site.

The editor only shows the fields .pages.yml declares, so this catches the ways the
two can drift apart without anyone noticing:

  * a field used in the content files that the editor does not offer (it would be
    kept, because settings.content.merge is on, but staff could not edit it);
  * a field named after something Jekyll reserves on collection items (url, next,
    id...), which the site would silently ignore;
  * a dropdown that does not offer a value already in use, so editing that item
    would show the field blank;
  * media folders, collection paths and components that do not exist.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_event_booking import RESERVED_FIELDS, load_items  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

# Fields kept in existing files but deliberately not offered in the editor
# because nothing on the site displays them.
NOT_EDITED = {
    "spotlights": {"short_title", "lead", "lead_role", "impact", "year"},
}


def main() -> int:
    config = yaml.safe_load((ROOT / ".pages.yml").read_text())
    problems: list[str] = []

    media = {m["name"]: m for m in config.get("media", [])}
    for name, m in media.items():
        if not (ROOT / m["input"]).is_dir():
            problems.append(f"media {name!r}: folder {m['input']} does not exist.")
        if "/" + m["input"].strip("/") != m["output"].rstrip("/"):
            problems.append(f"media {name!r}: output {m['output']} does not match input {m['input']}.")

    components = config.get("components", {})
    if config.get("settings", {}).get("content", {}).get("merge") is not True:
        problems.append("settings.content.merge must be true, or saving would delete undeclared fields.")

    for entry in config["content"]:
        name = entry["name"]
        directory = ROOT / entry["path"]
        if not directory.is_dir():
            problems.append(f"{name}: collection folder {entry['path']} does not exist.")
            continue
        if (entry.get("operations") or {}).get("rename") is not False:
            problems.append(f"{name}: renaming must be off; the filename is the id/web address.")
        fields = {}
        for field in entry["fields"]:
            spec = {**components.get(field.get("component"), {}), **field}
            if field.get("component") and field["component"] not in components:
                problems.append(f"{name}.{field['name']}: unknown component {field['component']!r}.")
            if spec["name"] in RESERVED_FIELDS:
                problems.append(f"{name}.{spec['name']}: the name is reserved by Jekyll on collection items.")
            if spec.get("type") == "image" and (spec.get("options") or {}).get("media") not in media:
                problems.append(f"{name}.{spec['name']}: image field without a known media source.")
            fields[spec["name"]] = spec

        items, errors = load_items(directory)
        problems += errors
        used = set().union(*(set(i) for i in items)) - {"id"} if items else set()
        for key in sorted(used - set(fields) - NOT_EDITED.get(name, set())):
            problems.append(f"{name}: field {key!r} is used in the content but not offered in the editor.")
        for key, spec in fields.items():
            values = (spec.get("options") or {}).get("values")
            if spec.get("type") != "select" or not values:
                continue
            allowed = {v["name"] if isinstance(v, dict) else v for v in values}
            for item in items:
                value = item.get(key)
                for v in (value if isinstance(value, list) else [value]):
                    if v not in (None, "") and v not in allowed:
                        problems.append(f"{name}/{item['id']}: {key} is {v!r}, which the editor's dropdown does not offer.")

    if problems:
        print("Pages CMS config check failed:")
        print("\n".join(f"- {p}" for p in problems))
        return 1
    print(f"Pages CMS config matches the site: {', '.join(e['name'] for e in config['content'])}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
