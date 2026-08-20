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

News items appear on the [News & Events](https://www.eeg101.eu/news/) page. Add a new entry at the **top** of the file so the newest item is first.

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

**File to edit:** `_data/events.yml`

**Image folder:** `assets/images/events/`

Events appear on both the [News & Events](https://www.eeg101.eu/news/) page and the [Calendar](https://www.eeg101.eu/calendar/) page. The website automatically sorts events into **Upcoming**, **Recent** (last 30 days), and **Past** based on the date. You do not need to set a status field.

```yaml
- id: your-event-id
  title: "Your Event Title"
  start_date: 2026-11-15
  end_date: 2026-11-16
  location: "City, Country"
  format: "in-person"
  category: "Events"
  summary: >
    A short description of the event.
  image: "/assets/images/events/your-image.jpg"
  alt: "Descriptive alt text"
  registration_url: ""
  programme_url: ""
  recording_url: ""
  slides_url: ""
  related_wg: ""
  tags:
    - community
    - in-person
```

| Field | What to put | Required? |
|-------|-------------|-----------|
| `id` | A unique lowercase identifier with dashes, e.g. `mc2-lisbon-2027` | Yes |
| `title` | Event name in quotes | Yes |
| `start_date` | Start date as YYYY-MM-DD | Yes |
| `end_date` | End date as YYYY-MM-DD (same as start for single-day events) | Yes |
| `location` | Where it takes place, or `"Online"` | Yes |
| `format` | One of: `in-person`, `online`, `hybrid` | Yes |
| `category` | One of: `Events`, `Announcement`, `Grants` | Yes |
| `time` | Optional time string, e.g. `"14:00-17:00 CET"` | No |
| `summary` | A short description. Use `>` then indent | Yes |
| `image` | Path to an image (800x450px). Leave as `""` for a placeholder | No |
| `alt` | Image description for accessibility | Yes |
| `registration_url` | External registration link, or `""` | No |
| `programme_url` | Link to the programme, or `""` | No |
| `recording_url` | Link to recordings after the event, or `""` | No |
| `slides_url` | Link to slides, or `""` | No |
| `related_wg` | Working group ID if relevant, e.g. `wg2`, or `""` | No |
| `tags` | A list of tags | No |

---

## Enable event booking (registration)

If you want people to register for an event directly on the website (rather than linking to an external registration page), add these extra fields to the event entry in `_data/events.yml`:

```yaml
- id: your-bookable-event
  title: "Your Bookable Event"
  start_date: 2026-11-15
  end_date: 2026-11-15
  location: "Online"
  format: "online"
  category: "Events"
  time: "14:00-16:00 CET"
  summary: >
    Description of the event.
  image: ""
  alt: "Event image"
  booking_enabled: true
  booking_status: "open"
  capacity: 50
  timezone: "CET"
  end_time: "16:00"
  registration_url: ""
  programme_url: ""
  recording_url: ""
  slides_url: ""
  related_wg: ""
  tags:
    - online
```

| Booking field | What to put | Required for booking? |
|---------------|-------------|----------------------|
| `booking_enabled` | `true` to activate the Register button on this event | Yes |
| `booking_status` | `"open"` to accept registrations, `"closed"` to stop | Yes |
| `capacity` | Maximum number of registrants (integer). Excess registrations go on a waiting list | Yes |
| `timezone` | Timezone abbreviation, e.g. `"CET"`, `"BST"` | Yes |
| `end_time` | End time as `"HH:MM"` for the calendar invitation | Yes |

**Important:** Do not set `registration_url` on the same event. The website will show an error if both an external registration link and internal booking are active on the same event.

**To close registration:** Change `booking_status` from `"open"` to `"closed"`. The event stays visible but the Register button disappears.

**To remove booking entirely:** Delete the five booking fields or set `booking_enabled: false`.

> **Note:** The booking system requires a configured Google Apps Script endpoint. See `docs/event-hub-operations.md` for the one-time setup. Without it, the registration form will not submit, but the rest of the website works normally.

---

## Add a YouTube video

**File to edit:** `_data/video_hub.yml`

Videos appear on the [Video Hub](https://www.eeg101.eu/video-hub/) page. Add a new entry at the top of the file.

```yaml
- id: abc123XYZ
  title: "Title of the video -- Speaker Name"
  duration: "12:30"
  series: "WG2 Mini-Symposium"
  tags: [WG2, Invited talk, Data harmonisation]
```

| Field | What to put | Required? |
|-------|-------------|-----------|
| `id` | The YouTube video ID. This is the part after `?v=` in the YouTube URL. For example, if the URL is `https://www.youtube.com/watch?v=abc123XYZ`, the ID is `abc123XYZ` | Yes |
| `title` | Video title in quotes | Yes |
| `duration` | Length as `"MM:SS"` | Yes |
| `series` | The series name, e.g. `"WG2 Mini-Symposium"` | No |
| `tags` | A list of tags in square brackets. These become the filter buttons on the Video Hub page. Use existing tags where possible | Yes |

**Current tag categories used on the Video Hub:** `WG2`, `Introduction`, `Invited talk`, `Flash talks`, `#EEGManyLabs`, `Data harmonisation`, `Open Science`.

The Video Hub automatically generates a thumbnail from YouTube. You do not need to provide an image.

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
| `theme` | A broad theme. Current themes: `History`, `Reporting standards`, `Community`, `Software`, `Data harmonisation` | Yes |
| `image` | Path to a screenshot from the paper (title page or a key figure). Take a screenshot, crop it to roughly 800x450px, save as JPEG | Yes |
| `tags` | A list of tags for filtering | Yes |

**Important:** Take a screenshot directly from the paper itself for the image. Do not use AI-generated or placeholder images.

---

## Add a Spotlight story

Spotlights highlight people and their work supported by EEG101 funding (STSMs, Virtual Mobility Grants, Conference Grants). Each Spotlight has a data entry and a detail page.

### Step 1: Add the data entry

**File to edit:** `_data/spotlights.yml`

Add a new block. The archive page automatically sorts entries from newest to oldest using the `sort_date` field.

```yaml
- slug: stsm-2027-firstname-lastname
  featured: true
  title: "A descriptive title for this Spotlight"
  short_title: "Short version for cards"
  type: "Mobility and exchange"
  status: "Completed"
  date_range: "1-15 March 2027"
  sort_date: "2027-03-15"
  year: 2027
  working_groups:
    - "WG2"
  tags:
    - "Data harmonisation"
    - "Open Science"
  lead: "First Last"
  lead_role: "EEG101 STSM grantee"
  host_institution: "University of Example"
  location: "City, Country"
  image: "/assets/images/spotlights/lastname-stsm-2027.jpg"
  image_alt: "Description of the image"
  summary: "A 2-3 sentence summary of what happened and why it mattered."
  impact: "A sentence about the broader impact."
  collaborators:
    - "Person A, Institution"
    - "Person B, Institution"
  outcomes:
    - "First key outcome"
    - "Second key outcome"
  follow_up:
    - "Planned next step"
  links:
    - label: "Related page"
      url: "/working-groups/#wg2"
  url: "/spotlights/stsm-2027-firstname-lastname/"
```

| Field | What to put | Required? |
|-------|-------------|-----------|
| `slug` | URL-safe identifier: `{type}-{year}-{firstname}-{lastname}`, e.g. `stsm-2027-jane-smith` or `virtual-mobility-2027-john-doe` | Yes |
| `type` | The grant type: `"Mobility and exchange"` for STSMs, `"Virtual Mobility"` for VMGs, `"Conference Grant"` for conference grants | Yes |
| `sort_date` | The end date as YYYY-MM-DD. Used to order the archive (newest first) | Yes |
| `date_range` | Human-readable date range, e.g. `"1-15 March 2027"` or `"May-August 2027"` | Yes |
| `url` | Must match the permalink in the detail page: `/spotlights/{slug}/` | Yes |
| All other fields | See the example above. Copy an existing entry and change the values | Yes |

### Step 2: Add the photo

Upload the person's photo to `assets/images/spotlights/`. Name it descriptively, e.g. `lastname-stsm-2027.jpg`.

### Step 3: Create the detail page

Create a new file in the `spotlights/` folder. Name it to match the slug, e.g. `spotlights/stsm-2027-firstname-lastname.html`.

The easiest approach is to copy an existing Spotlight detail page (e.g. `spotlights/stsm-2026-anne-sophie-dubarry.html`) and change:

1. The `title`, `subtitle`, `category`, and `permalink` in the front matter at the top
2. The `slug` value in the `assign` line (line 9)
3. The section headings and descriptive paragraphs to match the new story
4. The acknowledgement line at the bottom to match the grant type

The detail page pulls all structured data (outcomes, collaborators, follow-up, links) from the YAML entry automatically. You only need to write the narrative paragraphs.

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
| About | `about.md` | Plain Markdown |
| Team | `coordination.md` | Pulls from `_data/people.yml` |
| Members | `members.html` | Map and directory. Data from `assets/data/network-map.json` |
| Working Groups | `working-groups.md` | Pulls from `_data/working_groups.yml` |
| Grants | `grants.md` | Pulls from `_data/grants.yml` |
| News & Events | `news.md` | Merges `_data/events.yml` and `_data/news.yml` |
| Calendar | `calendar.md` | Pulls from `_data/events.yml` |
| Spotlight | `spotlight.html` | Pulls from `_data/spotlights.yml` |
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
| Event booking validation failed | A bookable event has incomplete fields | Check `_data/events.yml` for any event with `booking_enabled: true` and make sure `booking_status`, `capacity`, `timezone`, and `end_time` are all present |
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
  events.yml                   #   Events (with optional booking fields)
  video_hub.yml                #   YouTube videos for the Video Hub
  library.yml                  #   Papers for the Library
  spotlights.yml               #   Spotlight stories for funded activities
  resources.yml                #   Resource cards
  partners.yml                 #   Partner organisations
_includes/                     #   Reusable HTML components (cards, modals, navigation)
_layouts/                      #   Page templates (home, page, default)
assets/
  css/style.css                #   All visual styling
  js/network-map.js            #   Members map and directory JavaScript
  data/network-map.json        #   Generated member data (do not edit directly)
  images/                      #   All images, organised by type
  video/                       #   Hero video
spotlights/                    #   Individual Spotlight detail pages
scripts/                       #   Automation and validation scripts
  validate_event_booking.py    #     Runs on every build to check event data
  sync_network_map.py          #     Converts eCOST export to map data
  google-apps-script/          #     Apps Script source for booking and Members publishing
docs/                          #   Internal documentation and validation records
.github/workflows/pages.yml   #   GitHub Actions deployment workflow
*.md / *.html                  #   Individual page files
```

---

## Licence

Content: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Code: MIT.
