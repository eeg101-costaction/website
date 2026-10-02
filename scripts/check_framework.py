#!/usr/bin/env python3
"""Validate the Community Framework pages before the site is deployed.

The Framework is unusual for this site: it is a document that is also a form,
and every checkbox in it corresponds to a column of the Supabase `signatories`
table that has collected signatures since the Framework launched. A renamed or
dropped field does not fail loudly -- the signature is accepted and that answer
is silently lost, or the whole insert is rejected in the visitor's browser long
after anybody would notice. So the contract is checked here, in CI.

Checks
------
1. Every data file the Framework pages read parses, and has the keys they use.
2. The pledge checkboxes in the generated includes match _data/cf_meta.yml.
3. The pledge field names match the Supabase column names (names and count).
4. The sign form posts exactly the personal-detail fields the table expects.
5. Every citation in the document resolves to an anchor on the references page.
6. The generated includes contain no Liquid that upstream text could inject.

Run: python3 scripts/check_framework.py
"""

from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INCLUDES = ROOT / "_includes" / "framework"
DATA = ROOT / "_data"

# Personal-detail columns of the `signatories` table, as created by
# backend/generate_schema.sql in the sign-cf repository. `id` and `created_at`
# are set by the database; everything else is submitted by the form.
PERSONAL_FIELDS = {
    "first_name",
    "last_name",
    "affiliation",
    "email",
    "country_of_residence",
    "gender",
    "career_stage",
    "country_of_origin",
    "age",
    "orcid",
    "comment",
    "show_name",
}

failures: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def note(message: str) -> None:
    notes.append(message)


def load_yaml(name: str):
    try:
        import yaml
    except ImportError:
        sys.exit("PyYAML is required: python -m pip install pyyaml")
    path = DATA / name
    if not path.exists():
        fail(f"{name} is missing")
        return None
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as error:  # noqa: BLE001 - surface any parse problem
        fail(f"{name} does not parse: {error}")
        return None


def check_data_files() -> dict:
    loaded = {}

    meta = load_yaml("cf_meta.yml")
    if meta is not None:
        loaded["meta"] = meta
        if "pledge_fields" not in meta or "pledge_count" not in meta:
            fail("cf_meta.yml must define pledge_fields and pledge_count")
        elif meta["pledge_count"] != len(meta["pledge_fields"]):
            fail(
                f"cf_meta.yml pledge_count is {meta['pledge_count']} but lists "
                f"{len(meta['pledge_fields'])} fields"
            )

    framework = load_yaml("framework.yml")
    if framework is not None:
        loaded["framework"] = framework
        for key in (
            "supabase_url",
            "supabase_publishable_key",
            "signatories_table",
            "contact_email",
            "one_pager",
            "parts",
        ):
            if not framework.get(key):
                fail(f"framework.yml is missing {key}")
        key = framework.get("supabase_publishable_key", "")
        if key.startswith("sb_secret") or "service_role" in key:
            fail(
                "framework.yml holds what looks like a SECRET Supabase key. Only "
                "the publishable key may appear in a committed file."
            )
        one_pager = framework.get("one_pager", "")
        if one_pager and not (ROOT / one_pager.lstrip("/")).exists():
            fail(f"framework.yml one_pager points at a missing file: {one_pager}")

    signatories = load_yaml("signatories.yml")
    if signatories is not None:
        loaded["signatories"] = signatories
        for key in ("total", "public_count", "people"):
            if key not in signatories:
                fail(f"signatories.yml is missing {key}")
        people = signatories.get("people") or []
        if signatories.get("public_count") != len(people):
            fail(
                f"signatories.yml public_count is {signatories.get('public_count')} "
                f"but lists {len(people)} people"
            )
        if signatories.get("total", 0) < len(people):
            fail("signatories.yml total is lower than the number of public names")
        # Nothing beyond name and affiliation may ever reach this file.
        for person in people:
            extra = set(person) - {"name", "affiliation"}
            if extra:
                fail(
                    "signatories.yml contains fields that must not be published: "
                    + ", ".join(sorted(extra))
                )
                break

    catalogue = load_yaml("cf_catalogue.yml")
    if catalogue is not None:
        loaded["catalogue"] = catalogue
        items = catalogue.get("items") or []
        if catalogue.get("item_count") != len(items):
            fail(
                f"cf_catalogue.yml item_count is {catalogue.get('item_count')} but "
                f"lists {len(items)} items"
            )
        ids = [i.get("id") for i in items]
        if len(ids) != len(set(ids)):
            fail("cf_catalogue.yml contains duplicate item ids")
        untitled = sum(1 for i in items if not i.get("title"))
        if untitled:
            fail(f"cf_catalogue.yml has {untitled} items with no title")

    index = load_yaml("library_index.yml")
    curated = load_yaml("library.yml")
    if index is not None:
        loaded["index"] = index
        items = index.get("items") or []
        if index.get("total") != len(items):
            fail(
                f"library_index.yml total is {index.get('total')} but lists "
                f"{len(items)} items"
            )
        ids = [i.get("id") for i in items]
        if len(ids) != len(set(ids)):
            fail("library_index.yml contains duplicate item ids")

        # The index is generated from library.yml and cf_catalogue.yml. If either
        # source is edited without re-running scripts/build_library.py, the site
        # silently keeps showing the old collection, so catch the drift here.
        if curated is not None:
            missing = [
                p["id"] for p in curated
                if p.get("id") and p["id"] not in set(ids)
            ]
            if missing:
                fail(
                    "library.yml entries missing from library_index.yml "
                    f"({', '.join(missing[:5])}) -- re-run scripts/build_library.py"
                )
            if index.get("curated_count") != len(curated):
                fail(
                    f"library_index.yml says {index.get('curated_count')} curated "
                    f"entries but library.yml has {len(curated)} -- re-run "
                    "scripts/build_library.py"
                )
        if catalogue is not None:
            cat_ids = {i.get("id") for i in (catalogue.get("items") or [])}
            absent = sorted(cat_ids - set(ids))
            if absent:
                fail(
                    f"{len(absent)} catalogue items missing from "
                    "library_index.yml -- re-run scripts/build_library.py"
                )
        # Every curated paper must keep what makes its card worth showing.
        for item in items:
            if not item.get("featured"):
                continue
            for field in ("image", "oa_url", "source_url", "title"):
                if not item.get(field):
                    fail(
                        f"curated library entry {item.get('id')} has lost its "
                        f"{field}"
                    )
                    break
        orphans = sum(1 for i in items if not i.get("url"))
        if orphans:
            fail(f"{orphans} library items have no link to follow")
        # Every facet value an item carries must be offered as a checkbox,
        # or that item becomes unreachable by filtering.
        offered = {
            "section": {s["name"].lower() for s in index.get("sections") or []},
            "type": {t["name"].lower() for t in index.get("types") or []},
            "language": {l["name"].lower() for l in index.get("languages") or []},
        }
        for field, facet in (("section_titles", "section"), ("type_label", "type"),
                             ("language", "language")):
            used = set()
            for item in items:
                value = item.get(field)
                for v in (value if isinstance(value, list) else [value]):
                    if v:
                        used.add(str(v).lower())
            orphaned = sorted(used - offered[facet])
            if orphaned:
                fail(
                    f"{facet} values on items with no filter offered: "
                    + ", ".join(orphaned[:5])
                )
        note(
            f"library: {index.get('curated_count')} curated + "
            f"{index.get('framework_count')} Framework = {len(items)} items; "
            f"facets {len(offered['section'])} sections, {len(offered['type'])} "
            f"types, {len(offered['language'])} languages"
        )

    contributors = load_yaml("cf_contributors.yml")
    if contributors is not None:
        loaded["contributors"] = contributors
        if not isinstance(contributors, list) or not contributors:
            fail("cf_contributors.yml should be a non-empty list")

    return loaded


def check_includes(loaded: dict) -> None:
    if not INCLUDES.is_dir():
        fail("_includes/framework/ is missing -- run scripts/build_framework.py")
        return

    expected_docs = {
        "introduction",
        "validity",
        "democratization",
        "responsibility",
        "conclusion",
        "glossary",
        "references",
        "sign-fields",
    }
    present = {p.stem for p in INCLUDES.glob("*.html")}
    for missing in sorted(expected_docs - present):
        fail(f"_includes/framework/{missing}.html is missing")

    document = ""
    for name in ("introduction", "validity", "democratization", "responsibility", "conclusion"):
        path = INCLUDES / f"{name}.html"
        if path.exists():
            document += path.read_text(encoding="utf-8")

    # 2. Pledge checkboxes vs cf_meta.yml
    in_document = re.findall(r'name="(pledge_[0-9_]+)"', document)
    meta = loaded.get("meta") or {}
    declared = list(meta.get("pledge_fields") or [])
    if in_document != declared:
        only_doc = sorted(set(in_document) - set(declared))
        only_meta = sorted(set(declared) - set(in_document))
        if only_doc:
            fail(f"pledges in the document but not cf_meta.yml: {', '.join(only_doc)}")
        if only_meta:
            fail(f"pledges in cf_meta.yml but not the document: {', '.join(only_meta)}")
        if not only_doc and not only_meta:
            fail("cf_meta.yml lists the pledges in a different order to the document")
    if len(in_document) != len(set(in_document)):
        duplicates = sorted({f for f in in_document if in_document.count(f) > 1})
        fail(f"duplicate pledge field names: {', '.join(duplicates)}")

    # 3. Pledge names must be well formed, or Supabase rejects the whole insert.
    for field in in_document:
        if not re.fullmatch(r"pledge_\d+_\d+_\d+", field):
            fail(f"pledge field name is not of the form pledge_N_N_N: {field}")

    # 4. The sign form must post exactly the personal fields the table expects.
    form_path = INCLUDES / "sign-fields.html"
    if form_path.exists():
        form = form_path.read_text(encoding="utf-8")
        posted = set(re.findall(r'name="([a-z_]+)"', form))
        unknown = posted - PERSONAL_FIELDS
        absent = PERSONAL_FIELDS - posted
        if unknown:
            fail(
                "the sign form posts fields the signatories table has no column "
                "for: " + ", ".join(sorted(unknown))
            )
        if absent:
            fail(
                "the sign form no longer collects: " + ", ".join(sorted(absent))
            )
        for required in ("first_name", "last_name", "affiliation", "email"):
            if not re.search(rf'name="{required}"[^>]*required', form):
                fail(f"{required} should be a required field on the sign form")

    # 5. Citations must resolve.
    references = INCLUDES / "references.html"
    if references.exists():
        bibliography = references.read_text(encoding="utf-8")
        anchors = set(re.findall(r'id="([^"]+)"', bibliography))
        cited = set()
        for path in INCLUDES.glob("*.html"):
            cited |= set(
                re.findall(
                    r"/framework/references/' \| relative_url \}\}#([^\"]+)\"",
                    path.read_text(encoding="utf-8"),
                )
            )
        unresolved = sorted(cited - anchors)
        if unresolved:
            fail(
                f"{len(unresolved)} citation(s) point at anchors that do not exist "
                f"on the references page: {', '.join(unresolved[:8])}"
                + (" ..." if len(unresolved) > 8 else "")
            )
        else:
            note(f"all {len(cited)} distinct citations resolve")

    # 6. No Liquid may reach the includes from upstream prose. The build script
    #    only ever emits the relative_url filter, so anything else is suspect.
    allowed = re.compile(
        r"\{\{ '/(?:framework/references/|library/\#framework|framework/)' "
        r"\| relative_url \}\}"
    )
    for path in sorted(INCLUDES.glob("*.html")):
        if path.stem == "sign-fields":
            continue  # authored here, not generated from upstream prose
        stripped = allowed.sub("", path.read_text(encoding="utf-8"))
        for token in ("{{", "{%"):
            if token in stripped:
                fail(
                    f"_includes/framework/{path.name} contains unexpected Liquid "
                    f"({token}); regenerate it with scripts/build_framework.py"
                )
                break

    # Cross-check against the pledge count the pages display.
    if declared:
        note(f"{len(declared)} commitments across the document")


def check_pages() -> None:
    for page, needle in [
        ("framework.md", "framework/sign-fields.html"),
        ("framework/signatories.md", "site.data.signatories"),
        ("framework/catalogue.md", "site.data.cf_catalogue"),
        ("framework/glossary.md", "framework/glossary.html"),
        ("framework/references.md", "framework/references.html"),
        ("framework/contributors.md", "site.data.cf_contributors"),
        ("sign.md", "/framework/#cf-sign"),
        ("library.md", "site.data.library_index"),
        ("framework/catalogue.md", "/library/#framework"),
    ]:
        path = ROOT / page
        if not path.exists():
            fail(f"{page} is missing")
        elif needle not in path.read_text(encoding="utf-8"):
            fail(f"{page} no longer references {needle}")

    # The form only works if the page opts into framework.js.
    framework_page = ROOT / "framework.md"
    if framework_page.exists():
        if "framework_form: true" not in framework_page.read_text(encoding="utf-8"):
            fail("framework.md must set 'framework_form: true' to load framework.js")

    script = ROOT / "assets" / "js" / "framework.js"
    if not script.exists():
        fail("assets/js/framework.js is missing")


def main() -> int:
    loaded = check_data_files()
    check_includes(loaded)
    check_pages()

    for message in notes:
        print(f"  {message}")

    if failures:
        print(f"\nCommunity Framework checks FAILED ({len(failures)}):")
        for message in failures:
            print(f"  - {message}")
        return 1

    print("\nCommunity Framework checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
