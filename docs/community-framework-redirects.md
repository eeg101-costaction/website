# Redirecting the old Community Framework URLs

The Framework and its catalogue now live on `eeg101.eu`, but the old sites are
separate deployments on their own subdomains, so their redirects must be applied
in their own repositories. Everything needed is below; neither change has been
pushed, because both are outside this repository.

Apply these **after** the new pages are live, and keep the redirects in place
indefinitely — these URLs are in the published literature, in emails, and on
slides.

---

## 1. `catalog-cf.eeg101.eu` → `/framework/catalogue/`

`eeg101-costaction/catalog-cf` is a Next.js app on Vercel, so redirects belong in
`next.config.mjs`. Replace the file with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,

  // The catalogue moved into the main EEG101 site. These URLs are cited in
  // papers and emails, so the redirects are permanent and stay indefinitely.
  async redirects() {
    const CATALOGUE = "https://www.eeg101.eu/framework/catalogue/";
    return [
      { source: "/", destination: CATALOGUE, permanent: true },
      { source: "/resources", destination: CATALOGUE, permanent: true },
      // A deep link to one resource has no equivalent single page, so it lands
      // on the catalogue, where the resource is searchable by name.
      { source: "/resources/:id", destination: CATALOGUE, permanent: true },
      { source: "/about", destination: "https://www.eeg101.eu/framework/", permanent: true },
      // Anything else that is not the API.
      { source: "/:path((?!api/).*)", destination: CATALOGUE, permanent: true },
    ];
  },
};

export default nextConfig;
```

`permanent: true` issues a 308, which search engines treat as a permanent move
and which preserves the request method.

Leave `/api/*` alone until you are sure nothing consumes it.

---

## 2. `sign-cf.eeg101.eu` → `/framework/`

`eeg101-costaction/sign-cf` is MkDocs published to GitHub Pages, which serves
static files only and so cannot issue a real HTTP redirect. Use the
`mkdocs-redirects` plugin, which writes a meta-refresh stub plus a canonical link
for each old page — enough for both browsers and search engines.

**Step 1.** Add the dependency in `pyproject.toml`:

```toml
dependencies = [
    "mkdocs>=1.6.1",
    "mkdocs-autorefs>=1.4.2",
    "mkdocs-include-markdown-plugin>=7.1.5",
    "mkdocs-material>=9.6.5",
    "mkdocs-redirects>=1.2.2",
    "supabase>=2.17.0",
    ...
]
```

**Step 2.** Add the plugin in `mkdocs.yml`:

```yaml
plugins:
  - include-markdown
  - autorefs
  - redirects:
      redirect_maps:
        index.md: https://www.eeg101.eu/framework/
        signatories.md: https://www.eeg101.eu/framework/signatories/
        glossary.md: https://www.eeg101.eu/framework/glossary/
        references.md: https://www.eeg101.eu/framework/references/
        contributors.md: https://www.eeg101.eu/framework/contributors/
```

**Step 3.** Keep the nightly `build_docs.yml` workflow running for now. It is
harmless, and it keeps the old signatory page accurate for as long as the old
site is reachable.

### Do not delete the repository

`sign-cf` remains the **source of truth for the Framework text**. The main site
generates its pages from it (`scripts/build_framework.py`). It also holds the
database schema and the Google Sheets export. Retire the *site* if you like, but
keep the repository.

---

## 3. Links already repointed inside this site

These were changed in this repository and need nothing further:

| Page | Was | Now |
| --- | --- | --- |
| `join.md` step 2 | `sign-cf.eeg101.eu/` | `/framework/` |
| `join.md` step 2 deep link | `sign-cf.eeg101.eu/#sign-the-pledge` | `/framework/#cf-sign` |
| `join.md` closing call to action | `sign-cf.eeg101.eu/#sign-the-pledge` | `/framework/#cf-sign` |
| `join.md` work-package glossary | `/working-groups/` | `/framework/` |
| `_data/resources.yml` Framework card | `sign-cf.eeg101.eu` | `/framework/` |

One deliberate exception: `/framework/signatories/` links to the old signatory
list **only while this site's own list is empty**, so visitors are never shown a
blank page. It disappears as soon as the Supabase secrets are added and the
nightly sync runs.

---

## 4. Checking the redirects afterwards

```bash
for u in https://catalog-cf.eeg101.eu/ \
         https://catalog-cf.eeg101.eu/resources \
         https://sign-cf.eeg101.eu/ \
         https://sign-cf.eeg101.eu/glossary/; do
  printf '%-46s ' "$u"
  curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$u"
done
```

The Next.js URLs should answer `308` with a `Location` header. The MkDocs URLs
answer `200` with a meta-refresh in the body, which is expected for GitHub Pages.
