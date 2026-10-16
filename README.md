# EEG101 Website

Source for [www.eeg101.eu](https://www.eeg101.eu) -- the EEG101 COST Action website (CA24148).

Built with [Jekyll](https://jekyllrb.com) and deployed automatically to [GitHub Pages](https://pages.github.com) every time a change is pushed to the `main` branch. You do **not** need to install anything on your computer to update the site. Edit a file, commit, push, and the live site updates within about two minutes.

---

## Table of contents

1. [How publishing works](#how-publishing-works)
2. [Golden rules for editing YAML](#golden-rules-for-editing-yaml)
3. [Add or edit a team member](#add-or-edit-a-team-member)
4. [Add a news item](#add-a-news-item)
5. [Add or edit an event](#add-or-edit-an-event)
6. [Enable event booking (registration)](#enable-event-booking-registration)
7. [Add a YouTube video](#add-a-youtube-video)
8. [Add a paper to the Library](#add-a-paper-to-the-library)
9. [Add a Spotlight story](#add-a-spotlight-story)
10. [Update grants and calls](#update-grants-and-calls)
11. [Update Working Group descriptions](#update-working-group-descriptions)
12. [Update navigation menus](#update-navigation-menus)
13. [Update site-wide settings](#update-site-wide-settings)
14. [Update the Members map and directory](#update-the-members-map-and-directory)
15. [Update partners](#update-partners)
16. [Update page content](#update-page-content)
17. [Where to place images and files](#where-to-place-images-and-files)
18. [Previewing locally (optional)](#previewing-locally-optional)
19. [What to do when the build fails](#what-to-do-when-the-build-fails)
20. [Full site structure](#full-site-structure)
21. [Licence](#licence)

---

## How publishing works

Every push to the `main` branch triggers a GitHub Actions workflow that validates the event data, builds the Jekyll site, and deploys it to GitHub Pages. The live site at [www.eeg101.eu](https://www.eeg101.eu) usually updates within two minutes.

You can edit files directly on GitHub (click the pencil icon on any file), or clone the repository and push changes from your computer. Either way, the result is the same: push to `main` and the site rebuilds.

If the build fails, the previous version of the site stays live. Nothing breaks publicly. See [What to do when the build fails](#what-to-do-when-the-build-fails) for help.

---

## Golden rules for editing YAML

Almost all website content lives in `.yml` files inside the `_data/` folder. YAML is a plain-text format that is easy to read but unforgiving about formatting. Follow these rules every time you edit a YAML file.

| Rule | Example |
|------|---------|
| Use **spaces**, never tabs | Indent with exactly 2 spaces per level |
| Wrap text containing colons in **double quotes** | `title: "EEG101: A Network"` |
| Use `>` for multi-line text, then indent the block | See examples below |
| Write dates as **YYYY-MM-DD** | `start_date: 2026-09-15` |
| Leave unused fields as `""` | `recording_url: ""` |
| Lists start with `- ` (dash then space) | `tags:` followed by `- Open Science` on the next line |

> **Tip:** If you are unsure, copy an existing entry in the same file and change only the values. That is the safest way to avoid formatting errors.

---

## Add or edit a team member

**File to edit:** `_data/people.yml`

**Image folder:** `assets/images/people/`

Each person is one block in the file. To add someone new, copy an existing block and paste it at the bottom. Then change the values.

```yaml
- id: firstname           # A short unique ID (lowercase, no spaces)
  name: "First Last"
  role: "Management Committee Member"
  institution: "University of Example"
  country: "Country"
  email: "name@example.ac.uk"
  website: "https://example.ac.uk/profile"
  orcid: "https://orcid.org/0000-0000-0000-0000"
  image: "/assets/images/people/firstname.jpg"
  bio: >
    A short paragraph about the person. Keep it to 2-3 sentences.
  tags: [WG2]
  order: 99
```

**Field-by-field guide:**

| Field | What to put | Required? |
|-------|-------------|-----------|
| `id` | A short lowercase identifier, e.g. `heinrich`. Must be unique across the file | Yes |
| `name` | Full name in quotes | Yes |
| `role` | Their role, e.g. `"Action Chair"`, `"WG1 Leader"`, `"Management Committee Member"`, `"Research Support"` | Yes |
| `institution` | Their university or organisation | Yes |
| `country` | Their country | Yes |
| `email` | Email address, or `""` if not sharing | No |
| `website` | Profile URL, or `""` | No |
| `orcid` | Full ORCID URL, or `""` | No |
| `image` | Path to their photo. Name the file to match the `id` | Yes |
| `bio` | A short paragraph. Use `>` then indent the text on the next line | Yes |
| `tags` | A list in square brackets. Use `CG` for Core Group, `MC` for Management Committee, `WG1`, `WG2`, `WG3` for Working Groups | Yes |
| `order` | A number controlling display order. Lower numbers appear first. Use `99` for general members | Yes |

**To add the photo:** Upload a square image (recommended 400x400 pixels, JPEG) to `assets/images/people/`. Name it to match the `id`, e.g. `heinrich.jpg`.

**To edit an existing person:** Find their block by searching for their name. Change the field you need. Commit and push.

**To remove a person:** Delete their entire block (from `- id:` to the line before the next `- id:`). Also delete their image from `assets/images/people/` if no longer needed.

---

## Add a news item

**File to edit:** `_data/news.yml`

**Image folder:** `assets/images/news/`

News items appear on the [Events](https://www.eeg101.eu/events/) page. Add a new entry at the **top** of the file so the newest item is first.

```yaml
- title: "Your headline here"
  date: 2026-09-15
  category: "Announcement"
  summary: >
    A 1-3 sentence summary shown on the card.
  image: "/assets/images/news/your-image.jpg"
  alt: "Descriptive alt text for the image"
  featured: false
  external_url: ""
  internal_url: ""
  button_label: "Read more"
  tags:
    - announcement
```

| Field | What to put | Required? |
|-------|-------------|-----------|
| `title` | The headline in quotes | Yes |
| `date` | Date as YYYY-MM-DD | Yes |
| `category` | One of: `Announcement`, `Grants`, `Research`, `Community` | Yes |
| `summary` | 1-3 sentences. Use `>` then indent | Yes |
| `image` | Path to an image (800x450px recommended). Leave as `""` to use a placeholder | No |
| `alt` | A description of the image for accessibility | Yes |
| `featured` | Set to `true` to pin this item to the top | No |
| `external_url` | A full URL if the card should link to an external page | No |
| `internal_url` | A relative path if the card should link to an internal page, e.g. `/grants/` | No |
| `button_label` | Text for the link button. Defaults to "Read more" | No |
| `tags` | A list of tags for filtering | No |

---

## Add or edit an event

**The easy way:** use the website editor. Sign in at [app.pagescms.org](https://app.pagescms.org), open **Events**, and press **Add an entry** (or pick an event to change it). Fill in the form and press **Save**: the site updates within a couple of minutes. Each field explains itself. The staff guide is [`docs/staff-guide.md`](docs/staff-guide.md); admin setup is [`docs/pages-cms-setup.md`](docs/pages-cms-setup.md).

Events appear on both the [Events](https://www.eeg101.eu/events/) page and the [Calendar](https://www.eeg101.eu/calendar/) page. They are sorted into **Upcoming**, **Recent** (last 30 days) and **Past** automatically from their dates.

Dates that are not events (deadlines, calls) go under **Other calendar dates** in the editor. They appear on the Calendar only.

**By hand (for maintainers).** Each event is one file in `_events/`. **The filename is the event's id** (e.g. `_events/mc2-lisbon-2027.md` has id `mc2-lisbon-2027`). The booking form, the event's tab in the registration workbook and shared links all depend on it, so never rename a file once people may have booked. The id must be lowercase words joined by hyphens and must not start with a date. The file is front matter only:

```yaml
---
title: "MC2 meeting, Lisbon"
category: Events               # Events | Announcement | Grants
start_date: 2027-03-10
end_date: 2027-03-11           # leave empty for a one-day event
time: "09:00"                  # 24-hour clock; leave empty for all-day
end_time: "17:00"
timezone: Europe/Lisbon        # a full time-zone name, not an abbreviation
timezone_label: WET            # optional, shown on the card
location: "Lisbon, Portugal"
format: in-person              # in-person | online | hybrid
summary: "One to three sentences shown on the card."
image: /assets/images/events/mc2-lisbon-2027.jpg   # 16:9; empty for a placeholder
alt: "Descriptive alt text"
external: false                # true for events run by another organisation
tags: [community, in-person]
---
```

Never add an `id`, `url` or `next` field: on these files Jekyll reserves those names (and a few others) and would silently ignore them. `python3 scripts/validate_event_booking.py` checks all of this.

---

## Enable event booking (registration)

In the editor, tick **Take bookings on this website**, set **Bookings are** to **Open**, and give a start time, end time and time zone. **Places available** is the capacity (0 means no limit; beyond it people join a waiting list).

By hand, the same fields are:

| Field | What to put |
|-------|-------------|
| `booking_enabled` | `true` shows the Register button |
| `booking_status` | `open` to accept registrations, `closed` to stop |
| `capacity` | Maximum registrants; `0` for no limit |
| `time`, `end_time` | `"HH:MM"`, used for the calendar invitation |
| `timezone` | A full time-zone name, e.g. `Europe/Brussels` |
| `audience` | `open` (default) or `members` (COST members only: no booking here, invitations go through e-COST) |
| `joining_link` | Optional online meeting link. **Public**, and emailed within the hour to everyone booked |

Leave `registration_url` empty on a bookable event: it is for events whose registration happens on another website.

**To close registration:** set **Bookings are** to **Closed**. Once an event has passed, the Register button disappears by itself, but please still close it.

> The booking system needs the Google Apps Script described in `docs/event-hub-operations.md`. Without it, the form will not submit, but the rest of the site works normally.

---

## Add a YouTube video

**File to edit:** `_data/video_hub.yml`

Videos appear on the [Video Hub](https://www.eeg101.eu/video-hub/) page in the
order they appear in this file, newest first. **Add a new entry at the top**, so
the most recent recordings lead the page.

```yaml
- id: abc123XYZ
  title: "Title of the video -- Speaker Name"
  duration: "12:30"
  series: "WG2 Mini-Symposium"
  thumbnail: "/assets/images/video-hub/abc123XYZ.jpg"   # optional — see below
  tags: [WG2, Invited talk, Data harmonisation]
```

| Field | What to put | Required? |
|-------|-------------|-----------|
| `id` | The YouTube video ID. This is the part after `?v=` in the YouTube URL. For example, if the URL is `https://www.youtube.com/watch?v=abc123XYZ`, the ID is `abc123XYZ` | Yes |
| `title` | Video title in quotes | Yes |
| `duration` | Length as `"MM:SS"` | Yes |
| `series` | The series name, e.g. `"WG2 Mini-Symposium"` | No |
| `thumbnail` | A still from the talk, in `assets/images/video-hub/`. Only needed when the YouTube thumbnail is unhelpful — see below | No |
| `tags` | A list of tags in square brackets. These become the filter buttons on the Video Hub page. Use existing tags where possible | Yes |

**Current tag categories used on the Video Hub:** `WG2`, `Introduction`, `Invited talk`, `Flash talks`, `#EEGManyLabs`, `Data harmonisation`, `Open Science`.

### Thumbnails

By default the Video Hub uses whatever thumbnail YouTube serves, and you do not
need to provide an image.

The exception is a video uploaded with the EEG101 logo as its custom YouTube
thumbnail. Every such video looks identical in the grid, which makes a set of
talks impossible to tell apart. In that case, save a still from the talk itself
to `assets/images/video-hub/<video id>.jpg` and point `thumbnail:` at it.

The quickest way to get one without downloading the video: YouTube publishes three
auto-generated stills for every video, taken from roughly a quarter, half and
three quarters of the way through, at
`https://i.ytimg.com/vi/<video id>/maxres1.jpg` (also `maxres2`, `maxres3`).
Pick whichever best shows what the talk is about — usually a slide rather than a
speaker's webcam — crop it to 16:9, and save it around 960px wide.

---

## Add a paper to the Library

**File to edit:** `_data/library.yml`

**Image folder:** `assets/images/hub/`

Papers appear on the [Library](https://www.eeg101.eu/library/) page. Add a new entry at the top of the file.

```yaml
- id: authorname-2026-journal
  title: "Full title of the paper"
  authors: "Author A, Author B, Author C, et al."
  journal: "Journal Name"
  year: 2026
  source_url: "https://doi.org/10.xxxx/xxxxx"
  source_label: "Journal source"
  open_access_url: "https://example.com/open-access-version.pdf"
  open_access_label: "Read open access"
  access_version: "Author-accepted manuscript"
  open_access: true
  pdf: "/assets/docs/authorname-2026-journal.pdf"   # optional — see below
  theme: "Reporting standards"
  image: "/assets/images/hub/authorname-2026-journal.jpg"
  tags: [Reporting standards, Methodology, Open Science]
```

| Field | What to put | Required? |
|-------|-------------|-----------|
| `id` | A unique identifier: `leadauthor-year-journal` in lowercase | Yes |
| `title` | Full paper title in quotes | Yes |
| `authors` | Author list. Use `et al.` for long lists | Yes |
| `journal` | Journal name | Yes |
| `year` | Publication year (integer) | Yes |
| `source_url` | DOI or publisher URL | Yes |
| `source_label` | Label for the source link, e.g. `"Journal source"` | Yes |
| `open_access_url` | URL to a freely accessible version (preprint, author copy, or open-access publisher page) | Yes |
| `open_access_label` | Label for the open-access link, e.g. `"Read open access"` or `"Open manuscript"` | Yes |
| `access_version` | Description of the open-access version, e.g. `"Publisher open access"` or `"Author-accepted manuscript"` | Yes |
| `open_access` | `true` if an open-access version is available | Yes |
| `pdf` | Path to a copy of the PDF hosted in `assets/docs/`. Adds a **Download PDF** button to the card. Leave it out unless the licence allows redistribution — see below | No |
| `theme` | A broad theme. Current themes: `History`, `Reporting standards`, `Community`, `Software`, `Data harmonisation` | Yes |
| `image` | Path to a screenshot from the paper (title page or a key figure). Take a screenshot, crop it to roughly 800x450px, save as JPEG | Yes |
| `tags` | A list of tags for filtering | Yes |

**Important:** Take a screenshot directly from the paper itself for the image. Do not use AI-generated or placeholder images.

### Hosting a PDF on the site

Adding `pdf:` puts a **Download PDF** button on the card and serves the file straight
from this repository, so readers get the paper in one click without hitting a
publisher paywall.

**Only do this when the licence allows it.** Check the PDF's own copyright line:

- **Safe to host:** anything under a Creative Commons licence (`CC BY`, `CC BY-SA`,
  `CC BY-NC`, …), and most arXiv, bioRxiv or institutional-repository preprints. The
  licence is usually printed on the first page or the abstract page.
- **Do not host:** a publisher's version of record that says "All rights reserved",
  which is the norm for subscription articles. Link to it with `source_url` instead.
  Where a free author version exists, host that and say which version it is in
  `access_version`.

Put the file in `assets/docs/`, named like the entry `id`. Note that whatever is in
that folder is publicly downloadable by anyone with the link.

---

## Add a Spotlight story

**The easy way:** in the website editor ([app.pagescms.org](https://app.pagescms.org)) open **Spotlights** and press **Add an entry**. The form follows the page from top to bottom:
- the main picture;
- the summary and facts;
- three sections: why it mattered, what it enabled, and what comes next, each with an optional heading and text;
- key outcomes, extra pictures, and people and places;
- the buttons at the end.

Press **Save** and the page appears at `/spotlights/<name>/` within a couple of minutes. Tick **Show on the home page** to feature it: the most recent featured Spotlight is the one shown there.

**By hand (for maintainers).** Each Spotlight is one file in `_spotlights/`. The filename becomes its web address, so do not rename it once published. The page is laid out by `_layouts/spotlight.html` from the file's fields; there is no HTML to write. Copy an existing file (e.g. `_spotlights/stsm-2026-anne-sophie-dubarry.md`) and change the values. Pictures go in `assets/images/spotlights/`. The finish date (`date`) orders the list, newest first.

---

## Update grants and calls

**File to edit:** `_data/grants.yml`

Each grant scheme (STSM, VMG, Conference Grant) has an entry. To update a funding round:

1. Find the relevant grant entry
2. Change `status:` to `"open"`, `"closed"`, or `"upcoming"`
3. Update `deadline:` with the new deadline date
4. Update `application_url:` if the link has changed

---

## Update Working Group descriptions

**File to edit:** `_data/working_groups.yml`

Each Working Group has a block under `working_groups:`. You can edit the `aim`, `activities`, `outputs`, and `mou_objectives` fields. The `leaders` and `co_leaders` fields reference person IDs from `_data/people.yml`.

---

## Update navigation menus

**File to edit:** `_data/navigation.yml`

The file has three sections:

| Section | Where it appears |
|---------|-----------------|
| `main:` | The header navigation bar |
| `footer_network:` | The left column of footer links |
| `footer_resources:` | The right column of footer links |

Each item has a `title:` (the visible label) and a `url:` (the page path). To add a new menu item, add a new `- title:` / `url:` pair. To reorder, move the block up or down. To remove, delete the block.

---

## Update site-wide settings

**File to edit:** `_data/site.yml`

This file controls global settings such as the site title, tagline, contact email, social media links, Google Analytics ID, and the e-COST join link. Edit the relevant field and push.

**File to edit:** `_config.yml`

This file controls Jekyll's build settings. You should rarely need to change it. The `title`, `subtitle`, `description`, and `url` fields are set here.

---

## Update the Members map and directory

The Members page at [www.eeg101.eu/members/](https://www.eeg101.eu/members/) shows an interactive map and a searchable directory. The data comes from a single JSON file: `assets/data/network-map.json`.

**Do not edit `network-map.json` directly.** It is generated automatically.

### How to update the member list

The recommended workflow uses a private Google Sheet as the master record:

1. Export the detailed Working Group membership CSV from the [eCOST platform](https://e-services.cost.eu/action/CA24148)
2. Open the private **EEG101 Members: eCOST Export** Google Sheet
3. Go to the **Raw eCOST export** tab
4. Select all existing content and paste the new export over it (including the header row)
5. Select **EEG101 Members > Validate and publish** from the custom menu

The publish action validates the data, geocodes any new institutions, obfuscates email addresses, and commits the updated `network-map.json` to the website repository. The site then rebuilds automatically.

For full details, see `docs/members-ecost-paste-workflow.md`.

---

## Update partners

**File to edit:** `_data/partners.yml`

**Image folder:** `assets/images/partners/`

Each partner has a `name`, `url`, `logo` (path to the logo image), and `description`. Add new partner logos to the image folder (recommended: 200x80px, transparent PNG).

---

## Update page content

Each page on the site corresponds to a Markdown (`.md`) or HTML (`.html`) file in the repository root. The content below the front matter (the `---` block at the top) is the page body.

| Page | File | Notes |
|------|------|-------|
| Homepage | `index.md` | Uses the `home` layout. Hero text comes from `_data/content.yml` |
| Team | `coordination.md` | Pulls from `_data/people.yml` |
| Members | `members.html` | Map and directory. Data from `assets/data/network-map.json` |
| Working Groups | `working-groups.md` | Pulls from `_data/working_groups.yml` |
| Grants | `grants.md` | Pulls from `_data/grants.yml` |
| Events | `events.md` | Merges `_events/` (one file per event) and `_data/news.yml` |
| Calendar | `calendar.md` | Pulls from `_events/` and `_dates/` (other calendar dates); multi-day events fill their whole span. Core group and MC members can also add an internal Google Calendar behind a passphrase — see `docs/internal-calendar.md` |
| Spotlight | `spotlight.html` | Pulls from `_spotlights/`; each page is laid out by `_layouts/spotlight.html` |
| Resources | `resources.md` | Plain Markdown with resource cards |
| Library | `library.md` | Pulls from `_data/library.yml` |
| Video Hub | `video-hub.md` | Pulls from `_data/video_hub.yml` |
| Partners | `partners.md` | Pulls from `_data/partners.yml` |
| Join | `join.md` | Plain Markdown |
| Privacy | `privacy.md` | Plain Markdown |
| Contact | `contact.md` | Plain Markdown |
| Graphical Charter | `logos.md` | Logo downloads and usage guidance |
| Code of Conduct | `code-of-conduct.md` | Plain Markdown |
| 404 page | `404.html` | Custom branded error page |

To edit a page, open the corresponding file, change the content below the `---` front matter, and push.

---

## Where to place images and files

| What you are adding | Folder | Recommended size |
|---------------------|--------|-----------------|
| Team photos | `assets/images/people/` | 400x400px square, JPEG, under 100KB |
| News images | `assets/images/news/` | 800x450px (16:9), JPEG or WebP, under 200KB |
| Event images | `assets/images/events/` | 800x450px (16:9), JPEG or WebP, under 200KB |
| Library paper screenshots | `assets/images/hub/` | ~800x450px, JPEG, under 200KB |
| Spotlight photos | `assets/images/spotlights/` | Portrait or landscape, JPEG, under 2MB |
| Partner logos | `assets/images/partners/` | 200x80px, transparent PNG |
| EEG101 logos | `assets/images/logo/` | Keep existing filenames |
| Working Group images | `assets/images/working-groups/` | Keep existing filenames |
| Resource icons | `assets/images/resources/` | Square PNG |
| Hero video | `assets/video/hero.mp4` | H.264 MP4, 1920x1080, loopable |
| PDFs and documents | `assets/docs/` | Any filename |

---

## Previewing locally (optional)

You do not need to preview locally. Every push to `main` builds and deploys the site. But if you want to check changes before pushing:

```bash
# First time only
bundle install

# Start the local server
bundle exec jekyll serve

# Open http://localhost:4000 in your browser
```

Requires Ruby and Bundler installed on your computer.

---

## What to do when the build fails

If the site does not update after you push, the build may have failed. Here is how to check and fix it.

1. Go to the repository on GitHub: [eeg101-costaction/website](https://github.com/eeg101-costaction/website)
2. Click the **Actions** tab
3. Click the most recent workflow run
4. Read the error message. Common causes:

| Error | Cause | Fix |
|-------|-------|-----|
| YAML syntax error with a line number | A formatting mistake in a `.yml` file | Open the file, go to the line number, check for missing quotes, wrong indentation, or tabs |
| Content validation failed | An event, date or Spotlight has a problem | The message names the file and the field. An issue labelled `content-check` is also opened automatically after an editor save |
| Liquid syntax error | A template file has a formatting issue | This usually means an `.html` file was edited incorrectly. Revert the change or fix the Liquid tag |

If you cannot fix the error, revert your last commit on GitHub (or ask someone with Git experience to help). The previous version of the site remains live until a successful build replaces it.

---

## Full site structure

```
_config.yml                    # Jekyll build configuration (rarely needs editing)
_data/                         # All editable content as YAML files
  site.yml                     #   Site-wide settings (title, contact, social links, analytics)
  navigation.yml               #   Header and footer menu items
  content.yml                  #   Homepage text blocks
  people.yml                   #   Team member profiles
  working_groups.yml            #   Working Group descriptions
  grants.yml                   #   Grant scheme details
  news.yml                     #   News items
  video_hub.yml                #   YouTube videos for the Video Hub
  library.yml                  #   Papers for the Library
  resources.yml                #   Resource cards
  partners.yml                 #   Partner organisations
_events/                       # One file per event (edited in Pages CMS; filename = event id)
_dates/                        # One file per other calendar date: deadlines, calls (Pages CMS)
_spotlights/                   # One file per Spotlight story (Pages CMS)
.pages.yml                     # The website editor's forms (Pages CMS); see docs/pages-cms-setup.md
_includes/                     #   Reusable HTML components (cards, modals, navigation)
_layouts/                      #   Page templates (home, page, default, spotlight)
assets/
  css/style.css                #   All visual styling
  js/network-map.js            #   Members map and directory JavaScript
  data/network-map.json        #   Generated member data (do not edit directly)
  images/                      #   All images, organised by type
  video/                       #   Hero video
scripts/                       #   Automation and validation scripts
  validate_event_booking.py    #     Checks events, other dates and Spotlights
  check_cms_config.py          #     Checks the editor config (.pages.yml) still matches the content
  optimise_images.py           #     Shrinks and tidies pictures uploaded through the editor
  normalise_front_matter.cjs   #     Rewrites editor-saved front matter so Jekyll reads it as typed
  sync_network_map.py          #     Converts eCOST export to map data
  google-apps-script/          #     Apps Script source for booking and Members publishing
docs/                          #   Internal documentation and validation records
.github/workflows/pages.yml   #   GitHub Actions deployment workflow
*.md / *.html                  #   Individual page files
```

---

## Licence

Content: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Code: MIT.
