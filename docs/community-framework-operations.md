# EEG Community Framework — how the website integration works

The Community Framework used to live on two separate sites:

| What | Where it was | Where it is now |
| --- | --- | --- |
| The Framework document and signing form | `sign-cf.eeg101.eu` (MkDocs, `eeg101-costaction/sign-cf`) | `/framework/` and `/sign/` |
| Signatories | `sign-cf.eeg101.eu/signatories/` | `/framework/signatories/` |
| Glossary | `sign-cf.eeg101.eu/glossary/` | `/framework/glossary/` |
| References | `sign-cf.eeg101.eu/references/` | `/framework/references/` |
| Contributors | `sign-cf.eeg101.eu/contributors/` | `/framework/contributors/` |
| Resource catalogue | `catalog-cf.eeg101.eu` (Next.js, `eeg101-costaction/catalog-cf`) | `/framework/catalogue/` |

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

The table holds email addresses, ages, genders, countries of origin, ORCIDs and
free-text comments. **None of that may ever appear on the website.**
`scripts/fetch_signatories.py` enforces this at the point of reading:

* it filters `show_name = true` **server-side**, so signatures from people who
  did not opt in are never transmitted;
* it selects only `first_name`, `last_name` and `affiliation`;
* it asks for the overall total as a bare row count, never as rows.

`scripts/check_framework.py` then fails the build if `_data/signatories.yml`
ever contains a field other than `name` and `affiliation`.

### One-off setup needed before the signatory list appears

The signatory list ships empty and the page links to the old list until a
repository admin adds two secrets under **Settings → Secrets and variables →
Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | the Supabase project URL (same value as in `_data/framework.yml`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API Keys → Secret keys |

These are the same two secrets the `sign-cf` repository already uses, so they can
be copied across. Until they exist, the nightly job refreshes the catalogue,
logs a warning about the missing secrets, and leaves the signatory list alone —
it never fails the build.

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

* **Add the two Supabase secrets** (above) so the signatory list fills in.
* **Redirect the old URLs.** The new pages are live, but `sign-cf.eeg101.eu` and
  `catalog-cf.eeg101.eu` are separate deployments on their own subdomains, so
  their redirects have to be set in their own repositories. Ready-to-apply
  configuration is in `docs/community-framework-redirects.md`.
* **Decide on the 28 hidden catalogue items** (above).
* **Decide when to retire the old sites.** Nothing forces the timing: both front
  doors write to the same table, so they can run in parallel indefinitely.
