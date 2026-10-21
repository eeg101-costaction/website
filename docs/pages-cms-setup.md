# The website editor (Pages CMS): admin guide

Staff edit **Events**, **other calendar dates** and **Spotlights** through
[Pages CMS](https://pagescms.org), a free, open-source editor for content kept
in a GitHub repository. The staff guide is [`staff-guide.md`](staff-guide.md).

## How it works

- Content lives in this repository, one file per item: `_events/`, `_dates/`,
  `_spotlights/`. The forms staff see are defined in `.pages.yml`.
- **Save commits straight to `main`**, and GitHub Pages rebuilds the site within
  a couple of minutes. An item is on the site only once **Published on the
  website** is ticked; until then it is a draft (see "Drafts and review" below).
- Staff do **not** need GitHub accounts. They are invited by email and sign in
  with a 6-digit emailed code. Only admins with GitHub accounts can invite or
  remove people, or change `.pages.yml`.
- After each save, `.github/workflows/content-check.yml`:
  1. tidies what was saved and commits it back: rewrites the front matter so
     Jekyll reads times and yes/no words exactly as typed (the editor writes
     YAML 1.2, Jekyll reads 1.1, where an unquoted `09:00` is the number 540),
     and shrinks, rotates and strips metadata (EXIF and XMP, keeping the colour
     profile) from pictures added since the last tidy-up. "Since the last
     tidy-up" is the tag `content-tidied`, which the workflow moves forward, so
     a save whose own run was dropped from GitHub's queue is still covered.
     Pictures already on the site before this was set up are never touched;
  2. checks the content (`scripts/validate_event_booking.py`) and the editor
     config (`scripts/check_cms_config.py`);
  3. builds the site with the exact builder GitHub Pages uses;
  4. if any of 1-3 fails, opens an issue labelled **content-check** explaining what
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

## Drafts and review

- Every item has **Published on the website** (`published`) and **Ready for
  review** (`ready_for_review`) ticks. `_config.yml` defaults all three
  collections to `published: false`, so an item is live only when its file says
  `published: true`: a new item, or a file missing the field, stays a draft.
  Jekyll leaves drafts out of the site completely (pages, lists, calendar,
  booking data, sitemap).
- Drafts are shown at **/drafts/** (`drafts.md`, unlinked, `noindex`). Because
  Jekyll does not build drafts, the content check copies them into
  `_data/drafts.yml` after every save (`scripts/export_drafts.py`); the page
  renders them with the live templates.
- Ticking **Ready for review** opens a GitHub issue labelled
  **ready-for-review** (`scripts/review_requests.cjs`) naming the people in
  `content_reviewers` in `_data/site.yml`, and **emails the reviewers** through
  the booking Apps Script (`sendReviewRequest` in
  `scripts/google-apps-script/event-hub.gs`, sent from the account that deployed
  it). When the item is published they get a short "now live" note. Publishing
  the item, unticking Ready for review or deleting it closes the issue.

### Setting up the review emails (once)

The reviewers' addresses are stored only in the Apps Script's settings, never
in this public repository.

1. Open the booking Apps Script project (the one whose web-app URL is
   `event_booking_endpoint` in `_data/site.yml`). Replace its code with
   `scripts/google-apps-script/event-hub.gs` from this repository and save.
2. **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.**
   Editing the existing deployment keeps the same web-app URL.
3. **Project Settings (⚙️) → Script properties → Add script property:**
   `EEG101_REVIEWER_EMAILS` = the reviewers' addresses, separated by commas.
4. In the editor, choose **createReviewToken** in the function list and press
   **Run**. Copy the long code it prints in the execution log.
5. On GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, name `EEG101_REVIEW_TOKEN`, paste the code, **Add secret**.

To test: tick Ready for review on a draft and save. Within a few minutes the
reviewers get an email from "EEG101 website", and the issue is opened. If the
email could not be sent, the issue says why (most often a missing secret or
property). To change reviewers, edit `EEG101_REVIEWER_EMAILS` (and the names in
`_data/site.yml`). At most 30 review emails are sent a day, and only with links
to the EEG101 site and editor, so a leaked secret cannot be misused for spam.
- Limits: the editor has no roles, so anyone invited can publish; review is a
  team rule. Drafts are public in the repository.

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
- **Picture uploads** are committed to the repository as uploaded, and only
  then cleaned up. The original, including any location data in it, stays in
  the public history; the staff guide asks people to remove location before
  uploading. Removing it from history needs a history rewrite. Uploads are
  limited to JPG, PNG and WebP, the types the clean-up handles.
