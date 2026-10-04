# The internal calendar on the Calendar page

The [Calendar](https://www.eeg101.eu/calendar/) page draws every public event
from `_data/events.yml` automatically — the same source the Events page uses, so
anything added there appears in both places with no extra step. A multi-day
event fills every square it runs across.

Core group and Management Committee members can additionally pull an **internal**
Google Calendar into the same month grid, behind a shared passphrase. This page
explains how that works, what it does and does not protect, and how to set it up.

## Why the internal events are not in this repository

The website is a static site built by GitHub Pages. Everything it is built from
is public: the repository is public, and anything the browser can fetch, anyone
can fetch. **A password check written in JavaScript protects nothing** — the data
it is guarding has already been downloaded by the time the check runs.

So the internal events are never synced into the site. They stay in Google
Calendar and are fetched, on demand, by a Google Apps Script web app that will
only return them once the caller has supplied the passphrase. If nobody unlocks
it, the internal events never leave Google.

The passphrase is typed into an iframe served by Google, not into a form on
eeg101.eu, so it is sent straight to Google. The events the script returns are
handed to the page with `postMessage` and held in memory only: changing month
keeps them, reloading the page asks again. Nothing internal is written to
`localStorage`, to the repository, or to the built site.

## What this does and does not protect

| | |
| --- | --- |
| Protects against | A member of the public reading internal events. Search engines indexing them. Anything appearing in the repository or page source. |
| Does **not** protect against | Anyone who has the passphrase, including after they leave the committee. It is a shared secret, not a per-person login: it cannot be revoked for one person, and the script cannot tell who used it. |

Treat it as "not public", not as "confidential". Change the passphrase when the
committee changes, and keep anything genuinely sensitive out of the calendar
entries themselves. Wrong guesses are slowed to roughly one every 1.5 seconds and
stop entirely after ten failures in fifteen minutes.

If you need per-person access instead, the alternative is to deploy the web app
with **Who has access: Anyone with a Google account** and check
`Session.getActiveUser().getEmail()` against a list of committee addresses. That
is genuinely revocable, but Google's sign-in page refuses to load inside an
iframe, so the calendar would have to open in its own tab rather than appear in
the month grid. Ask if you would prefer that trade.

## Setting it up

Allow about twenty minutes. Steps 1–7 are done in Google; step 8 is the only
change to this repository, and I can make it for you once you have the URL from
step 7.

You need a Google account that can see the internal calendar. It does not have
to be your own — a shared coordination account is often better, because the web
app keeps running as whoever deployed it, so it should not be an account that
might be closed when someone leaves.

### 1. Decide which calendar holds the internal events

Either use an existing Google Calendar or make one (**Other calendars → + →
Create new calendar**, name it something like "EEG101 internal"). Everything on
this calendar becomes visible to anyone with the passphrase, so do not point it
at a personal calendar.

### 2. Copy the Calendar ID

1. Open [calendar.google.com](https://calendar.google.com) on a computer.
2. In the left sidebar, hover the calendar's name, click the **⋮** that appears,
   and choose **Settings and sharing**.
3. Scroll to **Integrate calendar**.
4. Copy **Calendar ID**. It looks like
   `c_a1b2c3d4e5f6@group.calendar.google.com`, or simply your email address if
   it is your main calendar.

Keep this on the clipboard or in a scratch note — it is needed in step 5.

> If the calendar belongs to somebody else, they must share it with the account
> you are about to deploy from: same **Settings and sharing** page, **Share with
> specific people or groups → Add people**, permission **See all event
> details**. Without this, step 6 fails with "calendar could not be opened".

### 3. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com), signed in as the
   deploying account.
2. Click **New project** (top left).
3. Click the project name, "Untitled project", and rename it
   **EEG101 internal calendar**.

Make this a **new project**. Do not add it to the event-booking script: they
need different Google permissions, and a change to one should never be able to
disturb the other.

### 4. Paste in the code

1. In the editor, select everything in `Code.gs` and delete it.
2. Open `scripts/google-apps-script/internal-calendar.gs` from this repository,
   copy the whole file, and paste it in.
3. Press **Ctrl/Cmd + S**.

### 5. Add the two Script Properties

1. Click the **⚙ Project Settings** cog in the left sidebar.
2. Scroll to **Script Properties** and click **Edit script properties**.
3. **Add script property** twice:

   | Property | Value |
   | --- | --- |
   | `EEG101_INTERNAL_CALENDAR_ID` | the Calendar ID from step 2 |
   | `EEG101_CALENDAR_PASSPHRASE` | the passphrase the committee will use |

4. Click **Save script properties**.

Spelling matters, including the capitals. For the passphrase use four or more
unrelated words — length beats punctuation, and people have to type it on
phones. Neither value is ever committed to this repository or sent to the
website.

### 6. Authorise it once

Google will not let a script read a calendar until a human has approved it.

1. Go back to the **Editor** (`< >` in the sidebar).
2. In the function dropdown at the top, choose **unlockInternalCalendar**.
3. Click **Run**.
4. **Review permissions → choose the account → Advanced → Go to EEG101 internal
   calendar (unsafe) → Allow.** The "unsafe" wording is what Google shows for
   any script that has not been through its review process; it is your own code.
5. The run then fails with **"That passphrase was not recognised."** in the
   execution log. **That is the correct result** — it was called with no
   passphrase. What matters is that it got far enough to be refused, which means
   the authorisation went through.

If instead it says the calendar could not be opened, the Calendar ID is wrong or
the calendar is not shared with this account: revisit steps 2 and 5.

### 7. Deploy it as a web app

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and pick **Web app**.
3. Fill in:
   - **Description**: anything, e.g. "v1".
   - **Execute as**: **Me (your address)**.
   - **Who has access**: **Anyone**.
4. **Deploy**, then **Authorize access** if prompted.
5. Copy the **Web app URL**. It ends in `/exec`.

**"Anyone" is correct and is not the hole it looks like.** It means anyone may
*call* the script; it does not mean anyone may read the calendar. The script
returns nothing at all until it has been given the passphrase. If you set this
to "Anyone with a Google account" instead, Google puts a sign-in page in front
of it — and Google's sign-in page refuses to load inside an iframe, so the
calendar would stop appearing on the page.

### 8. Tell the website where it is

In `_data/site.yml`:

```yaml
internal_calendar_endpoint: "https://script.google.com/macros/s/AKfy…/exec"
```

Commit and push to `main`; GitHub Pages rebuilds in a minute or two. This URL is
public and holds no secret — the passphrase is what gates the data.

While this line is empty, the Calendar page shows public events only and the
unlock control is not rendered at all, so nothing half-built is ever on display.

### 9. Give the committee the passphrase

Send it through e-COST or the coordination mailing list — not on the website,
and not in this repository.

## Changing it later

* **New passphrase:** edit the Script Property. Nothing needs redeploying and the
  site needs no change.
* **Different calendar:** edit `EEG101_INTERNAL_CALENDAR_ID`. If it is on a
  different account, re-run `unlockInternalCalendar` from the editor to
  re-authorise.
* **Script changes:** paste the new file in and use **Deploy → Manage deployments
  → Edit → New version**, which keeps the same URL.
* **Turning it off:** set `internal_calendar_endpoint` back to `""`, or archive
  the deployment. Either removes the unlock control.

## Checking it works

With the endpoint configured, open `/calendar/`:

* Public events show with no unlock, as before.
* **Show internal calendar** opens a passphrase box; a wrong answer says so and
  nothing is added.
* A correct answer closes the box, adds the internal events to the grid in navy,
  shows the **Internal** key, and changes the message to a count.
* **Hide internal events** removes them, and reloading the page asks again.
* An internal event's popover shows its title, dates, location and description,
  and no Register or Share controls.
* Internal events follow the **Times in** picker like public ones: the script
  sends each event's own time zone along with its wall-clock time, so changing
  the picker re-times them, and an all-day entry stays put.

To confirm nothing leaks into the built site, search the published page:

```bash
curl -s https://www.eeg101.eu/calendar/ | grep -ci "internal-"
```

The only matches should be the element IDs of the unlock control itself. No
event title from the internal calendar should ever appear.
