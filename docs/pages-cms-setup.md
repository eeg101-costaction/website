# The website editor (Pages CMS): admin guide

Staff edit **Events**, **other calendar dates** and **Spotlights** through
[Pages CMS](https://pagescms.org), a free, open-source editor for content kept
in a GitHub repository. The staff guide is [`staff-guide.md`](staff-guide.md).

## How it works

- Content lives in this repository, one file per item: `_events/`, `_dates/`,
  `_spotlights/`. The forms staff see are defined in `.pages.yml`.
- **Save commits straight to `main`**, and GitHub Pages rebuilds the site within
  a couple of minutes. There are no drafts.
- Staff do **not** need GitHub accounts. They are invited by email and sign in
  with a 6-digit emailed code. Only admins with GitHub accounts can invite or
  remove people, or change `.pages.yml`.
- After each save, `.github/workflows/content-check.yml`:
  1. tidies what was saved and commits it back: rewrites the front matter so
     Jekyll reads times and yes/no words exactly as typed (the editor writes
     YAML 1.2, Jekyll reads 1.1, where an unquoted `09:00` is the number 540),
     and shrinks, rotates and strips metadata from the pictures uploaded in
     that save (existing pictures are never touched);
  2. checks the content (`scripts/validate_event_booking.py`) and the editor
     config (`scripts/check_cms_config.py`);
  3. builds the site with the exact builder GitHub Pages uses;
  4. if 2 or 3 fails, opens an issue labelled **content-check** explaining what
     is wrong in plain English. It closes the issue automatically when a later
     save passes.

  GitHub Pages publishes `main` regardless, so this cannot *block* a save. If
  the build fails, visitors keep seeing the previous version. If only the
  content check fails, the item is live but needs fixing.

## One-time setup

You need a GitHub account with admin (or write) access to
`eeg101-costaction/website`. Plan on two admins, so access never depends on one
person.

1. **Watch the repository** so you get the issue emails: on
   github.com/eeg101-costaction/website, choose **Watch → Custom → Issues**.
2. Go to **https://app.pagescms.org** and **Sign in with GitHub**.
3. When asked to install the Pages CMS GitHub App, choose
   **Only select repositories** and select **eeg101-costaction/website** only.
   Read the permissions it asks for before approving: it needs to read and
   write repository contents. If it asks for more than you are comfortable
   with, stop and check with the other admin.
4. Open the repository in Pages CMS. You should see **Events**, **Other
   calendar dates** and **Spotlights**. If you see an error about the
   configuration, `.pages.yml` has a problem; `python3 scripts/check_cms_config.py`
   explains most of them.
5. **Test it before inviting anyone.** Open an existing event, change nothing,
   and press **Save**. Then check:
   - the commit appears on `main`;
   - the **Check content saved in the website editor** workflow goes green;
   - the event still looks the same on www.eeg101.eu/events/.

   The first save may reformat the file (quotes, field order), which is
   harmless.
6. **Invite staff:** in Pages CMS open **Collaborators** for the repository and
   add each person's email address. Send them `docs/staff-guide.md`. Remove
   people from the same screen when they leave.

## Day to day

- **A content-check issue arrives.** It says what is wrong and which item. Fix
  it in the editor (or ask the person who saved it), save, and the issue closes.
  To undo a save entirely, open the commit linked in the issue and **Revert** it.
- **Adding a field to a form.** Edit `.pages.yml`, then run
  `python3 scripts/check_cms_config.py`. Never name a field `url`, `next`, `id`,
  `content`, `path`, `output`, `excerpt`, `collection` or `previous`: Jekyll
  reserves these on collection items and silently ignores them. Both checkers
  reject them.
- **Ids and web addresses.** An event's id and a Spotlight's address are its
  filename, made once from the title (and date). Renaming is switched off in the
  editor, because the booking form, its workbook tab and shared links depend on
  it. If one is badly wrong *before* anyone has booked or linked to it, rename
  the file in GitHub.

## Limits and risks

- **Third-party service.** app.pagescms.org is free and run essentially by one
  maintainer, with no service agreement. If it changes or disappears, the
  website keeps working and all content stays here as plain files; only the
  editor is lost until it is replaced. The code is open source (MIT) and can be
  self-hosted; another git-based editor could also use the same files, mainly by
  rewriting `.pages.yml`.
- **Removing access.** To cut Pages CMS off completely, uninstall its GitHub App
  (GitHub → Settings → Applications → Installed GitHub Apps).
- **Everything saved is public**, including in the repository history, even if
  later deleted. That is why internal calendar items stay in the internal Google
  Calendar.
- **Picture uploads** are committed to the repository. Very large originals are
  shrunk after saving, but the original stays in the history.
