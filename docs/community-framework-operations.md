# EEG Community Framework — how the website integration works

The Community Framework used to live on two separate sites:

| What | Where it was | Where it is now |
| --- | --- | --- |
| The Framework document and signing form | `sign-cf.eeg101.eu` (MkDocs, `eeg101-costaction/sign-cf`) | `/framework/` and `/sign/` |
| Signatories | `sign-cf.eeg101.eu/signatories/` | `/framework/signatories/` |
| Glossary | `sign-cf.eeg101.eu/glossary/` | `/framework/glossary/` |
| References | `sign-cf.eeg101.eu/references/` | `/framework/references/` |
| Contributors | `sign-cf.eeg101.eu/contributors/` | `/framework/contributors/` |
| Resource catalogue | `catalog-cf.eeg101.eu` (Next.js, `eeg101-costaction/catalog-cf`) | `/library/` (merged into the Library; `/framework/catalogue/` redirects there) |

Nothing was migrated destructively. The signature store and the Zotero library
are untouched and still the single source of truth; this site reads from both.

---

## Signatures: the existing database is kept

**The question raised in the planning thread — "will you be using a new
database, or keeping the one we currently have?" — is answered: we keep the
existing one.** No signature is exported, copied or re-keyed, so none can be
lost in transfer.

Signatures live in the Supabase table `public.signatories`, created by
`backend/generate_schema.sql` in the `sign-cf` repository. Two keys govern it:

* a **publishable key**, which is public by design. It is in `_data/framework.yml`
  and is sent by the visitor's browser. Row-level security grants the anonymous
  role `INSERT` only, so this key can add a signature and can neither read, amend
  nor delete one.
* a **service-role key**, which bypasses row-level security. It must only ever
  exist as a repository secret. It is never committed and never reaches a browser.

```
visitor's browser ──POST (publishable key)──▶ Supabase public.signatories
                                                      │
GitHub Actions ──SELECT (service-role key)────────────┘
       │
       └─▶ _data/signatories.yml ──▶ /framework/signatories/
```

`sign-cf` writes to the same table with the same publishable key, so the two
front doors can run side by side for as long as you like. Retiring the old site
needs no data work at all.

### What is published, and what is not

The table holds personal data that is not for publication -- email address, age,
gender, country of origin, ORCID and free-text comments. **None of that may ever
appear on the website.** `scripts/fetch_signatories.py` enforces this:

* only people who ticked "I'm happy for my name to be displayed publicly" are
  read at all -- against Supabase the filter is applied server-side, so private
  signatures are never transmitted;
* only name and affiliation are selected;
* the overall total is asked for as a bare count, never as rows.

`scripts/check_framework.py` then fails the build if `_data/signatories.yml` ever
contains a field other than `name` and `affiliation`.

### Where the list comes from

The refresh has two sources and takes the first that is available.

**1. The signature store directly.** Used when `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set as repository secrets. This is the
authoritative source and the one to end up on: it is current to the minute and
keeps working after the original site is retired.

**2. The published list** at `sign-cf.eeg101.eu/signatories/`. Used otherwise.
The Framework's own nightly job regenerates that page from the same table, so
this reads a list the Framework already publishes -- no credential needed, and
**the signatory list on this site updates nightly out of the box.**

Source 2 is a real source, not a stopgap, but it has two limits worth knowing:
the list is up to a day behind the table, and it stops updating if the old site
is taken down. So adding the secrets is an upgrade to make at some point, not
something to do before launch.

### Adding the secrets (optional, recommended eventually)

Under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | the Supabase project URL (same value as in `_data/framework.yml`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API Keys → Secret keys |

These are the same two secrets the `sign-cf` repository already uses, so they can
be copied across. The sync job picks them up on its next run with no other
change; its log says which source it used.

As a check on any run: the published list showed **143 signatures, 122 of them
publicly named** (120 after removing duplicate signatures). `_data/signatories.yml`
should come back with figures at or above those. A materially lower number means
the read is being filtered somewhere it should not be -- investigate before
deploying, rather than publishing a short list.

---

## The resource catalogue needs no credentials

The standalone catalogue queries Zotero at runtime with an API key. It does not
have to: the EEG101 Community Framework Zotero group (`5794905`) is **public**,
so `scripts/build_catalogue.py` reads it with no key at all and writes
`_data/cf_catalogue.yml`. The site then renders it statically — no API key to
rotate, no runtime dependency on Zotero or Vercel being up, and the catalogue is
indexable by search engines, which a client-rendered SPA is not.

To add or change a resource, edit the
[Zotero group library](https://www.zotero.org/groups/5794905/library). The
nightly job picks it up; run the workflow by hand to publish sooner.

### Items the catalogue does not show

The catalogue reads the three Framework parts, matching the standalone
catalogue item for item (283 resources). **28 items in the Zotero library are in
no part it reads** and so appear in neither catalogue:

| Collection | Items not in any Framework part |
| --- | --- |
| `Publishing` (subcollection of Part 1) | 14 |
| `Societal and technological responsibility` (subcollection of Part 3) | 1 |
| `Part 0: Educational` | 13 |

Running `python3 scripts/build_catalogue.py --include-subcollections` folds the
two subcollections in (15 of the 28). Whether to show them — and whether Part 0
belongs in the catalogue at all — is an editorial decision for the Framework
steering group, so neither is on by default. Moving those items into their
parent collection in Zotero would also fix it at source, for both catalogues.

---

## The Library holds both collections

`/library/` renders `_data/library_index.yml`, which is **generated** by
`scripts/build_library.py` from two sources:

| Source | What it holds | Who edits it |
| --- | --- | --- |
| `_data/library.yml` | the curated EEG101 papers, with cover art, hosted PDFs and open-access links | edited by hand |
| `_data/cf_catalogue.yml` | the Framework catalogue | generated from Zotero |

Edit a source, then re-run the script:

```bash
python3 scripts/build_library.py
```

`scripts/check_framework.py` fails the build if the index has drifted from
either source, so a hand edit to `library.yml` that is never rebuilt is caught
rather than silently ignored. The nightly sync rebuilds the index after
refreshing the catalogue.

### Tags: EEG101's own vocabulary, carried across

The two collections could not share a tag vocabulary as they stood. The curated
entries carry the Library's own tags. The Zotero records carry **485 distinct
tags across 123 items, 411 of them appearing exactly once**, including MeSH
headings (`Humans`, `Brain Mapping`), arXiv categories
(`Computer Science - Machine Learning`), BISAC codes
(`Computers / Social Aspects`) and many case variants of one idea
(`Open science` / `open science`). As filter buttons those are unusable.

So the filters are **EEG101's own curated tags** — the ones already applied to
`library.yml` — carried across to the catalogue. Nothing in the vocabulary is
invented: every facet is a tag the team already uses. The `TOPICS` dictionary at
the top of `build_library.py` lists each tag with the words that mean it, used
only to decide which catalogue items earn it.

* **Curated entries are not inferred.** They were tagged by hand, so their tags
  are taken verbatim and only folded to a canonical spelling. The check script
  confirms no curated paper is ever given a tag it was not assigned.
* **The nine original filter buttons keep their order** and are pinned as
  buttons whatever their count, because `#EEG101-supported` matters at two items
  as much as at fifty. Tags carried by at least `FACET_MIN` (5) items are
  promoted to buttons behind the "more tags" toggle; the rest stay on cards and
  in search.
* Patterns are anchored at a **word start**, so `reproducib` catches
  "reproducibility" while `ica` would otherwise fire on "clinical",
  "publication" and "statistical". Write acronyms with an explicit trailing
  boundary, as `ica\b`.
* Raw Zotero tags stay on each item and stay searchable. They are simply not
  offered as buttons.

Re-run the script after editing the vocabulary; it prints the per-tag counts and
the share of items that matched nothing.

### What the vocabulary does not reach

About 17% of catalogue items (52) carry no EEG101 tag. They are still reachable
by search, by collection and by Framework part. They are not random — they
cluster into four subjects the Action's own papers do not cover, each of which
is a named section of the Framework:

| Cluster | Framework section | Roughly |
| --- | --- | --- |
| Ethics, neurorights, consumer neurotechnology | 3.1 Ethical use of EEG | ~20 |
| Research evaluation, publishing reform, DORA | 3.3 Research evaluation | ~15 |
| Theory, epistemology, reverse inference | 1.4 Theory-driven and data-driven research | ~12 |
| Technology hype and expectations | 3.2 Overestimating technology | ~8 |

Adding four tags named after those sections would close most of the gap. That is
an editorial decision for the team, not something to infer, so the vocabulary is
left as it stands.

---

## The Framework text is generated, not hand-maintained

`_includes/framework/*.html` is **generated** from the MkDocs source in
`sign-cf`. Do not edit it by hand; edit the upstream markdown and re-run:

```bash
python3 -m pip install markdown pymdown-extensions
python3 scripts/build_framework.py                        # fetch from GitHub
python3 scripts/build_framework.py --source ../sign-cf/docs   # or a local checkout
```

The script renders the source with the same Python-Markdown extension stack
MkDocs uses, so the text is reproduced faithfully, then fixes what does not
travel: `references.md#Anchor` links become real URLs, duplicated checkbox ids
are made unique, inline event handlers are dropped, external links gain
`rel="noopener"`, and every commitment checkbox gains an accessible name (see
below). It also writes `_data/cf_meta.yml` and `_data/cf_contributors.yml`.

### Known issues in the upstream source

These were found while porting and are worth fixing in `sign-cf` too:

1. **`pledge_3_3_4` has no checkbox.** The document shows 90 commitments; the
   table has 91 pledge columns. Because the column is `NOT NULL DEFAULT true`,
   every signature silently records agreement to a commitment nobody was shown.
   Either restore the missing commitment or drop the column.
2. **13 citation links have a stray slash** (`references.md/#Smith2020`), and
   **2 have no anchor at all**. They are dead links on the live site. The build
   script absorbs all of them; the empty ones land on the bibliography index.
3. **Commitment checkboxes had no accessible name.** A screen reader announced
   90 bare "checkbox, checked" controls, so a blind reader could not tell what
   they were agreeing to — on a document whose entire purpose is informed
   consent to specific commitments. The build script now gives each checkbox an
   `aria-labelledby` pointing at its own wording.
4. **Duplicated element ids.** Every "select all" checkbox was `id="cb-1-1"`.
   The build script makes them unique.

---

## What runs, and when

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/pages.yml` | push to `main` | Runs `scripts/check_framework.py`, then builds and deploys |
| `.github/workflows/community-framework-sync.yml` | nightly 02:41 UTC, or manually | Refreshes the catalogue and the signatory list, validates, commits if anything changed |

`scripts/check_framework.py` is the guard that matters. The form field names are
a contract with the database: rename one and the signature is still accepted
while that answer is quietly dropped, or the whole insert is rejected in the
visitor's browser where nobody will see it. The script checks that the
commitments in the document, the list in `_data/cf_meta.yml` and the columns the
table expects all still agree, that every citation resolves, that no personal
field has leaked into the published signatory list, and that no Liquid can reach
the generated includes from upstream prose.

---

## Still to do

* **Optionally add the two Supabase secrets** (above). The signatory list
  already updates nightly without them; the secrets make it current to the
  minute and independent of the old site.
* **Redirect the old URLs.** The new pages are live, but `sign-cf.eeg101.eu` and
  `catalog-cf.eeg101.eu` are separate deployments on their own subdomains, so
  their redirects have to be set in their own repositories. Ready-to-apply
  configuration is in `docs/community-framework-redirects.md`.
* **Decide on the 28 hidden catalogue items** (above).
* **Decide when to retire the old sites.** Nothing forces the timing: both front
  doors write to the same table, so they can run in parallel indefinitely.
