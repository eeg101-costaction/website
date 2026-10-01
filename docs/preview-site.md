# The preview site

**https://www.eeg101.eu/preview/** serves whatever is on the `preview` branch.

Push to `preview` and that URL updates a few minutes later. It is the place to
put work in front of the team before it reaches the live site.

```
push to `preview`
      │
      ├─▶ preview.yml       validates and builds the branch; publishes nothing,
      │                     so a broken branch fails here, loudly
      │
      └─▶ pages.yml         rebuilds the live site from `main` and stages the
                            preview branch into /preview/ of the same Pages site
```

## Why it is a path on the live domain

GitHub Pages serves **one site per repository**, and this repository's slot is
the live site at www.eeg101.eu. So a preview cannot have a Pages site of its own
here: pointing this repository's Pages at any other branch takes the live site
down.

The alternative is a second repository with its own Pages site. That works, and
is worth doing if the preview ever needs to be genuinely separate, but it needs
somebody with org permissions to create the repository and turn Pages on. The
path approach needs nothing and cannot be misconfigured into taking the site
down.

### What staging the preview does *not* do

Adding `/preview/` changes no live page. The live pages are still built from
`main` exactly as before — verified by building both ways and comparing: 223
files, none added, none removed, none changed apart from the Atom feed's build
timestamp, which changes on every deploy anyway.

The staging step is also `continue-on-error`. **A broken preview branch can
never stop the live site deploying** — the step is skipped, a warning is logged,
and `/preview/` goes stale until the branch builds again.

## The preview is hidden from search

It is on the public domain, so anyone with the link can read it. It will not
turn up in search results:

* every preview page carries `<meta name="robots" content="noindex, nofollow">`
* `robots.txt` carries `Disallow: /preview/`
* the preview's own `sitemap.xml` is removed, so nothing submits those URLs
* the `CNAME` is removed from the preview copy

Treat it as unlisted, not secret. Do not stage anything on `preview` that would
be a problem for a stranger to read.

## Using it

**Put a branch in front of the team**

```bash
git push origin my-branch:preview --force-with-lease
```

Force is normal here: `preview` is a staging pointer, not a branch with history
worth keeping. It gets reset whenever something new needs previewing.

**Refresh after a change**

Push to `preview` again. `pages.yml` restages it automatically when `preview.yml`
finishes.

**See what is staged right now**

```bash
git log --oneline -1 origin/preview
```

**Take the preview down**

Delete the branch. The next deploy stages nothing and the path stops updating;
to remove the files, deploy once with no `preview` branch present.

```bash
git push origin --delete preview
```

## Gotchas

* **Everything is built with `--baseurl /preview`.** Links written with
  `relative_url` handle this. A hardcoded `/assets/...` or `/framework/` in a
  page or data file will break on the preview while working on the live site —
  which is exactly the kind of bug a preview should catch.
* **`pages.yml` always builds the live site from `main`**, whatever triggered
  it. It pins `ref: main` on checkout, so a stray trigger cannot deploy another
  branch to production.
* **The old `gh-pages-preview` branch is no longer used.** Nothing reads or
  writes it; it can be deleted whenever convenient.
