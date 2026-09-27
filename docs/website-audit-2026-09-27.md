# EEG101 website audit — 27 September 2026

> **Status: findings 1–34 were addressed on 27 September 2026**, in the commit that
> follows this one on `claude/eeg101-website-audit-egbzr4`. This document is kept as
> the point-in-time record of what was found; the notes below describe the site *as
> audited*, not as it stands now. Four items were deliberately left for the
> coordination team to decide, and are listed at the end under
> [Left open](#left-open).

Audit of `eeg101-costaction/website` (live at [www.eeg101.eu](https://www.eeg101.eu)) covering build
health, broken links and missing files, content accuracy, SEO, accessibility, and performance.

Method: clean `bundle exec jekyll build` (no errors or warnings); `scripts/validate_event_booking.py`
(passes); the 8 Python unit tests (all pass); an internal link/asset crawl of the built site; HTTP
checks of all 95 external URLs; verification of the key findings against the **live production site**;
and a read of every page, layout, include, and data file.

Nothing in this report has been changed. It is a findings list.

---

## Summary

The site is in good structural shape — the build is clean, event validation and tests pass, and the
eCOST member sync is running and fresh (523 members, 307 institutions, 58 countries, regenerated
today). The problems are concentrated in **missing asset files, dead social and COST links, and stale
grant messaging** — all visitor-facing, all small fixes.

| Area | Findings |
|---|---|
| Broken links and missing files | 9 |
| Content accuracy and consistency | 11 |
| Technical and SEO | 6 |
| Performance | 4 |
| Accessibility | 4 |

Highest priority: the four missing asset files (1–4), the three dead social links (5–7), the four wrong
COST grant guidance links (8), and the Round 1 grants news item that still says applications are open (10).

---

## A. Broken links and missing files

All four missing files below were confirmed as **404 on the live site**, not just absent locally.

**1. The favicon is missing on every page.**
`_layouts/default.html:42` links `/assets/images/logo/favicon.png`. That file is not in the repository
and returns 404 in production. Every page requests a favicon that does not exist.

**2. The social sharing image is missing — every share preview is broken.**
`_config.yml` sets `image: /assets/images/og-image.png` as the site-wide default, and
`_layouts/default.html` also hardcodes it. The file does not exist (404 live). It is emitted three
times per page — hand-rolled `og:image`, `jekyll-seo-tag`'s `og:image` and `twitter:image`, and the
schema.org JSON-LD block — so every link shared to LinkedIn, Bluesky, Slack, or WhatsApp renders
without an image.

**3. "Download all logos (ZIP)" is a dead link.**
`logos.md:12` points to `/assets/EEG101-logos.zip`, which does not exist (404 live). The page also
states "All logo variants are included in the ZIP download above." The individual logo downloads on
that page do work.

**4. The hero video has no poster image.**
`_data/site.yml:31` sets `hero_fallback: "/assets/images/hero-fallback.jpg"`, used as the `poster` on
the homepage hero video. It does not exist (404 live), so the hero is blank until the 6.9 MB video
paints — and stays blank on any connection where the video does not load.

**5. The Discord invite link is invalid.**
`discord_url: "https://discord.gg/eeg101"` (`_data/site.yml:19`). The Discord API returns
`{"message": "Unknown Invite", "code": 10006}` — the invite does not exist or has expired. It is
rendered in the footer of **every page**, twice on the Contact page, and referenced on the Join page
(step 6) and in the Code of Conduct scope.
Note that `_data/resources.yml` deliberately does *not* publish a Discord link — its Discord card says
invites are sent to approved members and points at e-COST instead. The footer link contradicts that
policy as well as being broken.

**6. The LinkedIn link 404s.**
`linkedin_url: "https://www.linkedin.com/company/eeg101"` (`_data/site.yml:21`) returns 404.
`_data/resources.yml` uses a different and working URL for the same organisation:
`https://www.linkedin.com/groups/16491058/` (200). One of the two is wrong; the footer has the broken one.

**7. The Bluesky handle does not resolve.**
`bluesky_url: "https://bsky.app/profile/eeg101.bsky.social"` (`_data/site.yml:22`). Resolving that
handle through the Bluesky API returns `"Unable to resolve handle"`. The real account is
`eeg101costaction.bsky.social` (resolves to `did:plc:jlzj5soe54rfix4nzomg5422`) — which is what
`_data/resources.yml` already uses. `bsky.app` returns HTTP 200 for any profile URL, so this fails
silently in a link checker; only the API call exposes it.

**8. All four "COST guidance ↗" buttons on the Grants page go somewhere wrong.**
These are `guidance_url` values in `_data/grants.yml`, and every one of them misses:

| Scheme | Current URL | What actually happens |
|---|---|---|
| STSM | `cost.eu/funding/stsm/` | 301 → `cost.eu/uploads/2020/10/STSM.png` — a bare PNG image file |
| VMG | `cost.eu/funding/vmg/` | 404 |
| Conference Grant (in-person) | `cost.eu/funding/dissemination-conference-grants/` | 301 → an unrelated SUSTAIN event page |
| Conference Grant (online) | same as above | same |

COST has reorganised these pages. The current canonical page is
`https://www.cost.eu/cost-actions-event/action-networking-tools/` (200, already used in
`_data/resources.yml`), which has per-scheme sections including anchors `#h-conference-grants` and
`#Virtual-Networking-Tools`. Worth confirming with the Science Officer before switching, since these
are the links applicants follow.

**9. A Team member's profile link 404s.**
`andras` in `_data/people.yml` — `btk.pte.hu/hu/munkatarsak/dr-habil-zsido-andras-norbert-az-mta-doktoradsc`
returns 404. Rendered as the "Website" button on his Team card.

*Checked and healthy:* all 6 YouTube video IDs resolve via oEmbed; the Zenodo dataset, ORCID, DOI,
publisher, and partner links all resolve (several return 403 to automated checks but are fine in a
browser); `sign-cf.eeg101.eu`, all e-COST links, and the MoU PDF are live. No broken internal page
links anywhere in the built site.

---

## B. Content accuracy and consistency

**10. The Events feed still advertises Round 1 grants as open, with contradictory dates.**
`_data/news.yml` — "Round 1 grants open: STSMs, VMGs, and Conference Grants" (dated 2026-03-01):

> "Applications are now open... The deadline is 31 October 2026, 17:00 CET. Decisions will be announced
> by 30 April 2026."

Three problems: decisions are announced *before* the stated deadline; the deadline is a month in the
future so a reader takes the call to be live; and both statements are contradicted by
`_data/events.yml` ("Funding Round 1: Application Window Closed", 3 April 2026) and `_data/grants.yml`
(all four schemes `status: closed`, "All Year 1 funding has been allocated"). This card is on
`/events/` now, in the same feed as the closure announcement.

**11. "Funding Round 2 Opening Shortly" is four months stale.**
The `funding-round-2-announcement` event is dated 1 June 2026 and says Round 2 "will open shortly";
`_data/grants.yml` notes say "Check back from November onwards for Year 2 funding calls". It is now late
September. Either the announcement needs a date and a real timeline, or it should be retired.

**12. Join page step numbering is off by one.**
`join.md` step 3 ("Create an e-COST account") ends: "If you already have an e-COST account, sign in and
go straight to step 3." Step 3 *is* that step — it should say step 4. Left over from the commit that
split the e-COST step into account creation and application.

**13. Who can join is stated four different ways.**

| Where | What it says |
|---|---|
| `join.md` → "Who can join?" | COST Full Member, Cooperating Member, and approved Near Neighbour Countries |
| `grants.md` banner | "Membership is open to eligible researchers internationally, including those based outside COST countries" |
| `_data/resources.yml` → "Join the EEG101 Network" | "free and open to researchers at all career stages from **any country**" |
| `_data/content.yml` → `join_cta` (homepage) | "from any **COST member country**" |

The membership data settles it: the network map includes members in Argentina, India, the USA, and
Chile, so the "internationally" version is the accurate one and `join.md` is the page most likely to
turn away an eligible applicant. Grant eligibility genuinely *is* restricted to COST countries — that
distinction is what needs stating consistently.

**14. The Graphical Charter's Azure colour values contradict each other.**
`logos.md` lists Azure as HEX `#000099` with RGB `0, 51, 153`. Those are different colours: `#000099`
is RGB 0, 0, 153; RGB 0, 51, 153 is `#003399`. `assets/css/style.css:9` uses `#000099`, so the RGB row
is the wrong one — but since `#003399` is COST/EU Reflex Blue, it is worth confirming which is the
brand colour before correcting either.

**15. Email and ORCID data in `people.yml` is never displayed — and one email is malformed.**
`_includes/person-card.html` renders name, role, institution, country, tags, and website only. The
`email` and `orcid` fields on all 28 profiles are unused. Consequently nobody has noticed that
`mikkel`'s email is `mvi@psy.ku` (missing `.dk`), and that ORCIDs are recorded inconsistently — some as
full `https://orcid.org/...` URLs, some as bare IDs. Harmless while unrendered; a bug the moment
someone adds ORCID links to the card.

**16. Country names are inconsistent in `people.yml`.**
"UK" (faisal, amy, mahnaz, xun) vs "United Kingdom" (fangzhou); "Türkiye" (pinar) vs "Turkey" (fatih).
The generated map data uses "Türkiye" and "United Kingdom" throughout, so the Team data does not match
the Members data.

**17. The nav says "Team", the page says "Coordination".**
`_data/navigation.yml` labels `/coordination/` as "Team" in both the main and footer menus, but the page
title, `<h1>`, and browser tab all say "Coordination".

**18. The homepage Spotlight shows the older story.**
`_layouts/home.html` uses `site.data.spotlights | where: "featured", true | first`, which takes the
first *in file order* — the April STSM — while `/spotlight/` sorts newest-first and leads with the
August Virtual Mobility. The homepage feature is effectively pinned to whichever entry sits higher in
the file.

**19. Four homepage content blocks are configured but never rendered.**
`_data/content.yml` defines `news_preview`, `grants_preview`, `events_preview`, and `videos_preview`
with headings, intros, and CTAs. `_layouts/home.html` renders none of them. The homepage therefore has
no latest-news, upcoming-events, or video section at all — so the one event currently open for
registration (Diversity in EEG populations, 20 November, booking open) is not visible anywhere on the
homepage. Either the sections were dropped deliberately and the config is dead, or they were lost.

**20. The governance table omits half the coordination roles.**
`coordination.md`'s "Core coordination roles" table lists six roles. `_data/people.yml` also carries
EDIA Lead, Industry Engagement Lead, Training School Lead, Research Support, and Community Support —
all shown as cards immediately above the table.

*Time-sensitive:* the IPEG 2026 entry carries an abstract submission deadline of **30 September 2026** —
three days away — mentioned only inside the summary paragraph.

---

## C. Technical and SEO

**21. Every page emits duplicate and conflicting head tags.**
`_layouts/default.html` hand-rolls `<title>`, `meta description`, the Open Graph set, the Twitter card,
and `<link rel="canonical">`, and *then* calls `{% seo %}`, which emits its own. Each page ships two
`<title>` elements, two meta descriptions, two `og:title`, two `og:url`, two `og:image`, two
`og:type`, and two canonical links. Verified in the built output. Invalid HTML, and it leaves crawlers
to pick between them. Fix by deleting the hand-rolled block and configuring `jekyll-seo-tag` (it needs
`title`, `description`, `twitter.username`, `logo`, and a default `image` in `_config.yml`), or by
dropping `{% seo %}`.

**22. Internal files are published on the production domain.**
`_config.yml`'s `exclude` list does not cover them, so all of these return 200 on www.eeg101.eu:

- `/README.md` (27 KB)
- `/todo.md` — the internal roadmap, including unfinished items
- `/docs/*.md` — six internal ops and validation records; `docs/event-hub-operations.md` names a
  personal Gmail address
- `/scripts/google-apps-script/event-hub.gs` (56 KB), `members-auto-sync.gs`, `members-publish.gs`,
  `location-overrides.json`, `requirements-ecost-sync.txt`

No secrets are exposed — the registration workbook ID is correctly held in Apps Script properties, and
the booking web-app URL is public by design — but internal notes and automation source being served
from the public site is unintended. Add `README.md`, `todo.md`, `docs/`, `scripts/`, and `LICENSE.md` to
`exclude`.

**23. `/calendar/` is an orphan page.**
It exists, works, is in `sitemap.xml`, and is documented in the README — but nothing links to it. It is
in neither the main nav nor either footer column, and no page body references it. Visitors can only
reach it by typing the URL. Either add it to the nav (or link it from Events) or drop it.

**24. The preview build is partly broken by hardcoded paths.**
`.github/workflows/preview.yml` builds with `--baseurl "/website"`, but `logos.md` uses about 30
hardcoded `/assets/...` paths (the logo previews and every download link) and `library.md:41` renders
`src="{{ paper.image }}"` without `relative_url`. Under a non-empty baseurl all of those resolve
wrongly, so logo images and paper covers are broken in preview. Everything else on the site correctly
uses `relative_url`.

**25. The test suite never runs in CI.**
`scripts/test_validate_event_booking.py` and `scripts/test_prepare_members_workbook_seed.py` contain 8
tests and all pass, but `.github/workflows/pages.yml` only runs `validate_event_booking.py`. The tests
can rot unnoticed. One `python3 -m unittest discover -s scripts -p "test_*.py"` step in the build job
would close this.

**26. Dead template and unreferenced assets.**
`_includes/video-card.html` is included by nothing — `video-hub.md` inlines its own card markup — and it
is the only reference to the also-missing `/assets/images/placeholders/video-placeholder.jpg`.
Separately, 40 of 163 image files are referenced by nothing (~2.3 MB), mostly duplicate COST and EU
logo sets stored in both `assets/images/logo/` and `assets/images/partners/`, plus superseded
`eegmanylabs-logo.svg`, `fieldtrip-logo.svg`, `gbhi-logo.webp`, `mc1-meeting.jpg`,
`ohbm-brainhack-day1.jpg`, and `group-photo-mc1.jpg`.

---

## D. Performance

**27. The homepage ships ~7.6 MB of local assets, 6.9 MB of it the hero video.**
`assets/video/hero.mp4` autoplays and loops on every homepage visit. There is no `preload` hint, no
`media`/connection gating, and the `prefers-reduced-motion` block in `style.css:56` only neutralises
CSS animations — it does not pause or replace the video, which is exactly the kind of continuous
background motion that setting exists for. Compressing the video, adding a WebM source, and swapping in
the (currently missing) poster for reduced-motion users would all help.

**28. The Team page loads 7.5 MB of portraits across 29 images.**
Worst offenders, all displayed at 200×200:

| File | Size | Actual dimensions |
|---|---|---|
| `people/daniela.jpg` | 2.8 MB | 3652 × 5476 |
| `people/heinrich.jpg` | 1.6 MB | 2500 × 2500 |
| `people/yuri.png` | 996 KB | 770 × 914 (PNG for a photo) |
| `people/fangzhou.jpg` | 421 KB | 1665 × 2331 |
| `people/fernando.jpg` | 319 KB | 1067 × 1067 |

The README's own guidance is "400×400px square, JPEG, under 100KB". Resizing to 400×400 would take the
page from 7.5 MB to well under 1 MB.

**29. The footer loads a 387 KB print-resolution COST logo.**
`_includes/cost-footer.html` uses `COST_LOGO_rgb_highresolution.jpg` (387 KB) for a small footer mark,
on the homepage and the Graphical Charter page. `COST_LOGO_darkgrey_transparentbackground.png` (8.6 KB)
sits in the same folder.

**30. Spotlight images are oversized.**
`spotlights/kljajic-virtual-mobility-2026.jpg` is 1.8 MB at 1690 × 2222 and loads on both
`/spotlight/` and the detail page; `kljajic-vm-2026-workflow.png` is 1.5 MB.

---

## E. Accessibility

Generally good: a skip link, correct landmark roles, `aria-live` on the map and directory panels, a
`<noscript>` fallback for the Members map, alt text on **every** image site-wide, no duplicate `id`
attributes, and `aria-label`s on all icon-only links. Four gaps:

**31. Two search inputs have no label.**
`library.md:16` (`#hub-search`) and `video-hub.md` (`#library-search`) are bare `<input type="text">`
with a placeholder only — no `<label for>`, no `aria-label`. Placeholders are not accessible names and
vanish on input (WCAG 3.3.2, 4.1.2). Every other input on the site is properly labelled.

**32. Heading levels skip h1 → h3.**
On `/grants/`, `/library/`, `/video-hub/`, `/events/`, and `/coordination/`, the page `<h1>` is followed
by `<h3>` with no intervening `<h2>`, which breaks screen-reader heading navigation.

**33. The booking dialog has no focus management.**
`_includes/event-booking-modal.html` declares `role="dialog" aria-modal="true"` but never moves focus
into the panel when it opens, never returns focus to the trigger on close, and does not trap Tab — so a
keyboard or screen-reader user opening "Register" stays outside the dialog while the page behind it
remains tabbable. Escape-to-close and the backdrop click both work.

**34. Multi-day events appear on one calendar day only.**
`calendar.md`'s `eventsOnDay()` matches `start_date` exactly, so CuttingGardens 2026 (21–25 September)
and the IPEG conference (16–19 November) each occupy a single cell. Someone looking at the week of the
23rd sees nothing.

---

## What is working well

Worth recording, since much of this was clearly deliberate:

- The build is clean — no Jekyll errors or warnings — and all internal page links resolve.
- `validate_event_booking.py` passes and genuinely guards the booking data (duplicate IDs, incomplete
  booking fields, members-only events carrying public booking state or joining links).
- The eCOST member sync is working and current: 523 members, 307 institutions, 58 countries, stats and
  pending lists regenerated today. Every member record has a name, affiliation, and Working Group; there
  are no duplicates, no missing coordinates, and no un-obfuscated email addresses — all 517 mapped
  members use `[at]`/`[dot]` masking, and the 6 unmappable members are handled explicitly rather than
  dropped.
- No credentials or identifiers are exposed: the registration workbook ID lives in Apps Script
  properties, and the Apps Script source documents that choice.
- The privacy notice matches what the booking script actually collects, field for field, and its
  12-month retention claim matches `retentionDays: 365` in the script.
- The members-only event flow correctly routes invitations through e-COST and never collects
  registrations on the site.

---

## Suggested order of work

1. **Add the four missing files** — favicon, `og-image.png`, `hero-fallback.jpg`, and the logos ZIP
   (or remove the ZIP button and the sentence that references it). Findings 1–4.
2. **Fix or remove the three dead social links** in `_data/site.yml` — Discord, LinkedIn, Bluesky.
   The working LinkedIn and Bluesky URLs are already in `_data/resources.yml`. Findings 5–7.
3. **Correct the Round 1 news item and the Round 2 announcement** so the Events feed does not advertise
   a closed call. Findings 10–11.
4. **Repoint the four COST guidance links**, ideally confirmed with the Science Officer. Finding 8.
5. **Remove the duplicate head block** and configure `jekyll-seo-tag` properly; add `docs/`, `scripts/`,
   `README.md`, and `todo.md` to `exclude`. Findings 21–22.
6. **Resize the Team portraits and the hero video**, and switch the footer COST logo to the small PNG.
   Findings 27–29.
7. **Label the two search inputs**, fix the heading skips, add focus management to the booking dialog.
   Findings 31–33.
8. The remaining consistency items — eligibility wording, step numbering, colour values, country names,
   "Team" vs "Coordination", the homepage Spotlight ordering, and the unrendered homepage sections.
   Findings 12–20.
9. Housekeeping: run the tests in CI, fix the baseurl-unsafe paths so preview builds work, link or
   retire `/calendar/`, delete the dead include and the unreferenced images. Findings 23–26.

---

## Left open

Four items were not changed, because they are decisions for the coordination team
rather than defects to repair:

1. **A public Discord invite (finding 5).** The dead `discord.gg/eeg101` link was
   removed rather than replaced — `site.yml`'s `discord_url` is now empty, which
   hides the footer icon, and the Contact and Join pages describe the existing
   policy that invites go to approved members. If a permanent public invite is
   wanted, paste it into `discord_url` and the icon returns.

2. **The Azure brand colour (finding 14).** The RGB row on the Graphical Charter was
   corrected to `0, 0, 153` so it matches the `#000099` the stylesheet actually uses.
   If the intended colour was COST/EU Reflex Blue `#003399` — which the listed CMYK
   values suggest — then the hex, the RGB and `--color-primary` in `style.css` all
   need changing together, and that is a visual change to every page.

3. **The four COST guidance links (finding 8).** They now point at
   `cost.eu/cost-actions-event/action-networking-tools/` and its per-scheme anchors,
   which is the live replacement for the retired pages. Worth confirming with the
   Science Officer that this is where applicants should be sent.

4. **Email and ORCID on Team cards (finding 15).** The malformed address was fixed
   and the ORCID iDs normalised to full URLs, but `person-card.html` still renders
   neither. Publishing member email addresses invites spam, so whether to surface
   either field is a deliberate choice, not an oversight to correct.

Also left in place: roughly 28 unreferenced image files that are *not* byte-identical
duplicates — among them `mc1-meeting.jpg`, `ohbm-brainhack-day1.jpg`,
`group-photo-mc1.jpg`, `activities/training.png` and `people/avatar.jpg`. They may be
wanted for future pages, so they were kept; the 12 exact duplicates were deleted.
