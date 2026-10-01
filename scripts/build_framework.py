#!/usr/bin/env python3
"""Convert the EEG Community Framework MkDocs source into Jekyll includes.

The Community Framework is authored in the eeg101-costaction/sign-cf repository
as MkDocs Material markdown, which leans on pymdownx block syntax that kramdown
cannot parse. Rather than hand-porting ~25,000 words (and re-porting them every
time the steering group edits the text), this script renders the upstream source
with the very same Python-Markdown extension stack MkDocs uses, then rewrites the
handful of MkDocs-isms that do not travel:

  * ``references.md#Anchor`` cross-links become real site URLs
  * duplicated ``id="cb-1-1"`` select-all checkboxes get unique ids
  * inline ``onchange=`` handlers are dropped in favour of delegated listeners
  * ``target="_blank"`` links gain ``rel="noopener"``
  * upstream class names are namespaced to ``cf-*`` so they cannot collide with
    the main site's stylesheet
  * footnote ids are namespaced per source file

Output is committed to the repository, so an ordinary Jekyll build needs neither
Python nor network access. Re-run this script when the upstream text changes.

Usage
-----
    python3 scripts/build_framework.py --source ../sign-cf/docs
    python3 scripts/build_framework.py            # fetch from GitHub
"""

from __future__ import annotations

import argparse
import html
import pathlib
import re
import sys
import urllib.request

RAW_BASE = "https://raw.githubusercontent.com/eeg101-costaction/sign-cf/main/docs"

# The exact extension stack from the upstream mkdocs.yml, minus the two plugins
# that only make sense inside MkDocs itself (include-markdown, autorefs) and
# pymdownx.snippets (unused by the prose).
EXTENSIONS = [
    "pymdownx.superfences",
    "pymdownx.blocks.html",
    "pymdownx.blocks.details",
    "pymdownx.blocks.admonition",
    "pymdownx.tasklist",
    "attr_list",
    "def_list",
    "md_in_html",
    "footnotes",
    "toc",
]
EXTENSION_CONFIGS = {
    "pymdownx.tasklist": {"clickable_checkbox": True},
    "toc": {"toc_depth": 3},
}

# Prose sections of the framework, in reading order.
DOCUMENTS = [
    "introduction",
    "validity",
    "democratization",
    "responsibility",
    "conclusion",
    "glossary",
    "references",
]

# Upstream class name -> namespaced class name.
CLASS_RENAMES = {
    "info": "cf-note",
    "pledge": "cf-pledges",
    "tasklist": "cf-tasklist",
}

REFERENCES_URL = "{{ '/framework/references/' | relative_url }}"


def read_source(name: str, source_dir: pathlib.Path | None) -> str:
    if source_dir is not None:
        return (source_dir / f"{name}.md").read_text(encoding="utf-8")
    url = f"{RAW_BASE}/{name}.md"
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310
        return response.read().decode("utf-8")


def assert_liquid_safe(name: str, text: str) -> None:
    """Refuse to emit anything Jekyll would try to execute.

    The generated includes are processed by Liquid so that ``relative_url`` works,
    which means an upstream edit introducing ``{{`` or ``{%`` would be evaluated
    as template code. Fail loudly instead.
    """
    for token in ("{{", "{%", "}}"):
        if token in text:
            line = next(
                (i for i, l in enumerate(text.splitlines(), 1) if token in l), "?"
            )
            sys.exit(
                f"{name}.md:{line}: upstream source now contains {token!r}, which "
                f"Liquid would execute. Escape it upstream or extend this script."
            )


def render(text: str) -> str:
    import markdown  # imported late so --help works without the dependency

    converter = markdown.Markdown(
        extensions=EXTENSIONS, extension_configs=EXTENSION_CONFIGS
    )
    return converter.convert(text)


def rewrite(name: str, markup: str) -> str:
    # 1. Cross-document reference links. Upstream writes them as relative markdown
    #    paths, which only resolve inside MkDocs. Two upstream typos are absorbed
    #    here rather than silently shipped as dead links: a stray slash before the
    #    fragment ("references.md/#Smith2020"), and a handful of links with no
    #    fragment at all, which degrade to the bibliography index.
    def reference_link(match: re.Match[str]) -> str:
        anchor = match.group(1) or ""
        return f'href="{REFERENCES_URL}{"#" + anchor if anchor else ""}"'

    markup = re.sub(
        r'href="references\.md/?#?([^"\s]*)"', reference_link, markup
    )
    #    Links to the sibling pillar pages resolve to anchors on the one-page
    #    framework document.
    markup = re.sub(
        r'href="(introduction|validity|democratization|responsibility|conclusion)\.md(#([A-Za-z0-9_.:-]+))?"',
        lambda m: 'href="#' + (m.group(3) or f"cf-{m.group(1)}") + '"',
        markup,
    )

    # 2. Namespace upstream class names so they cannot collide with site styles.
    def rename_classes(match: re.Match[str]) -> str:
        names = [CLASS_RENAMES.get(c, c) for c in match.group(1).split()]
        return f'class="{" ".join(names)}"'

    markup = re.sub(r'class="([^"]*)"', rename_classes, markup)

    # 3. Give every "select all" checkbox a unique id, and drop the inline
    #    handler (framework.js binds these by class instead).
    counter = iter(range(1, 10_000))
    select_all_ids: list[str] = []

    def fix_select_all(match: re.Match[str]) -> str:
        element_id = f"cf-sa-{name}-{next(counter)}"
        select_all_ids.append(element_id)
        return (
            f'<input type="checkbox" checked id="{element_id}" class="cf-select-all">'
        )

    markup = re.sub(
        r"<input[^>]*class=\"cb-sa\"[^>]*/?>", fix_select_all, markup
    )

    # 4. Normalise the pledge checkboxes: upstream relies on markdown indentation
    #    that leaves stray whitespace inside each <li>.
    markup = re.sub(
        r"<li>\s*<input([^>]*?)class=\"data-input\"([^>]*?)/?>\s*",
        r'<li><input\1class="cf-pledge-input"\2>\n    ',
        markup,
    )

    # 4a. Accessible names. Upstream leaves every commitment checkbox unlabelled:
    #     the wording sits beside the input as loose text, so a screen reader
    #     announces 90 bare "checkbox, checked" controls and the reader has no way
    #     to know what they are agreeing to. Wrap each commitment's wording in a
    #     span and point the checkbox at it with aria-labelledby. A <label> would
    #     be the obvious choice, but most commitments contain links and nesting
    #     those inside a label makes them hard to reach with a keyboard.
    def label_commitment(match: re.Match[str]) -> str:
        attrs, wording = match.group(1), match.group(2)
        field = re.search(r'name="(pledge_[0-9_]+)"', attrs)
        if not field:
            return match.group(0)
        text_id = f"{field.group(1)}-wording"
        return (
            f'<li><input{attrs} id="cf-{field.group(1)}" '
            f'aria-labelledby="{text_id}">\n'
            f'    <span id="{text_id}">{wording.strip()}</span></li>'
        )

    markup = re.sub(
        r"<li><input([^>]*class=\"cf-pledge-input\"[^>]*)>\s*(.*?)</li>",
        label_commitment,
        markup,
        flags=re.S,
    )

    #     The same for each group's "select all": its accessible name should be
    #     the group's own "I commit to ..." sentence, not a generic string.
    def label_select_all(match: re.Match[str]) -> str:
        attrs, wording = match.group(1), match.group(2)
        element_id = re.search(r'id="([^"]+)"', attrs)
        if not element_id:
            return match.group(0)
        text_id = f"{element_id.group(1)}-wording"
        return (
            f'<p><input{attrs} aria-labelledby="{text_id}">\n'
            f'<span id="{text_id}">{wording.strip()}</span></p>'
        )

    markup = re.sub(
        r"<p><input([^>]*class=\"cf-select-all\"[^>]*)>\s*(.*?)</p>",
        label_select_all,
        markup,
        flags=re.S,
    )

    # 5. Security hardening upstream omits on its own links.
    markup = markup.replace('target="_blank">', 'target="_blank" rel="noopener">')
    markup = re.sub(r'(target="_blank")(?! rel=)', r'\1 rel="noopener"', markup)

    # 6. Namespace footnote ids: each source file is rendered independently, so
    #    two files could otherwise both emit "fn:1".
    markup = re.sub(r'(id|href)="#?(fn|fnref):', lambda m: f'{m.group(1)}="{"#" if m.group(1) == "href" else ""}{m.group(2)}-{name}:', markup)

    # 7. Anchor each top-level section so the home page and nav can deep-link.
    markup = markup.replace("<h2 ", f'<h2 data-cf-section="{name}" ', 1)

    return markup.strip() + "\n"


def parse_contributors(text: str) -> list[dict[str, str]]:
    """Turn the tab-and-<br> separated contributor blob into structured names."""
    blob = text.split("\n\n")[-1]
    people = []
    for raw in blob.split("<br>"):
        raw = raw.strip()
        if not raw:
            continue
        parts = [p.strip() for p in raw.split("\t") if p.strip()]
        if not parts:
            continue
        # Upstream columns are first / middle / last, with middles often blank.
        if len(parts) == 1:
            first, middle, last = parts[0], "", ""
        elif len(parts) == 2:
            first, middle, last = parts[0], "", parts[1]
        else:
            first, middle, last = parts[0], parts[1], " ".join(parts[2:])
        display = " ".join(p for p in (first, middle, last) if p)
        people.append({"name": display, "sort": (last or first).lower()})
    return people


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=pathlib.Path,
        help="path to a sign-cf docs/ checkout (default: fetch from GitHub)",
    )
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=pathlib.Path(__file__).resolve().parent.parent,
        help="repository root to write into",
    )
    args = parser.parse_args()

    includes = args.out / "_includes" / "framework"
    includes.mkdir(parents=True, exist_ok=True)

    pledge_fields: list[str] = []
    for name in DOCUMENTS:
        source = read_source(name, args.source)
        assert_liquid_safe(name, source)
        markup = rewrite(name, render(source))
        (includes / f"{name}.html").write_text(
            f"<!-- Generated by scripts/build_framework.py from sign-cf/docs/{name}.md.\n"
            f"     Do not edit by hand; edit the upstream source and re-run the script. -->\n"
            + markup,
            encoding="utf-8",
        )
        pledge_fields.extend(re.findall(r'name="(pledge_[0-9_]+)"', markup))
        print(f"wrote _includes/framework/{name}.html ({len(markup):,} bytes)")

    # Contributors become structured data so the page can render them in the
    # site's own card/list idiom rather than as a wall of <br> tags.
    contributors = parse_contributors(read_source("contributors", args.source))
    data_dir = args.out / "_data"
    lines = [
        "# Generated by scripts/build_framework.py from sign-cf/docs/contributors.md.",
        "# People who contributed to writing the EEG Community Framework.",
        "",
    ]
    for person in contributors:
        lines.append(f"- name: {yaml_quote(person['name'])}")
    (data_dir / "cf_contributors.yml").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print(f"wrote _data/cf_contributors.yml ({len(contributors)} contributors)")

    # The pledge field list is the contract between this document and the
    # Supabase table, so record it for the form and for check_framework.py.
    if len(pledge_fields) != len(set(pledge_fields)):
        dupes = sorted({f for f in pledge_fields if pledge_fields.count(f) > 1})
        sys.exit(f"duplicate pledge field names in source: {', '.join(dupes)}")
    meta = [
        "# Generated by scripts/build_framework.py.",
        "# Every pledge checkbox in the framework document, in document order.",
        "# These names must match the columns of the Supabase `signatories` table;",
        "# scripts/check_framework.py verifies that.",
        "",
        f"pledge_count: {len(pledge_fields)}",
        "pledge_fields:",
    ]
    meta.extend(f"  - {field}" for field in pledge_fields)
    (data_dir / "cf_meta.yml").write_text("\n".join(meta) + "\n", encoding="utf-8")
    print(f"wrote _data/cf_meta.yml ({len(pledge_fields)} pledge fields)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
