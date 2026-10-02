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

1. **Create or choose the Google Calendar** holding internal events. In Google
   Calendar, open **Settings → <your calendar> → Integrate calendar** and copy
   the **Calendar ID**. If the calendar belongs to someone else, share it with
   the account that will run the script, with at least "See all event details".

2. **Create the Apps Script project** at [script.google.com](https://script.google.com),
   under an account that can see that calendar. Replace the contents of `Code.gs`
   with the repository file `scripts/google-apps-script/internal-calendar.gs`.
   Keep this separate from the event-booking project: a separate project means a
   calendar change can never disturb event registrations.

3. **Add two Script Properties** (**Project Settings → Script Properties**):

   | Property | Value |
   | --- | --- |
   | `EEG101_INTERNAL_CALENDAR_ID` | the Calendar ID from step 1 |
   | `EEG101_CALENDAR_PASSPHRASE` | the shared passphrase |

   Neither is ever committed or published. Choose a passphrase of at least four
   unrelated words.

4. **Deploy** with **Deploy → New deployment → Web app**, **Execute as: Me**,
   **Who has access: Anyone**. "Anyone" is correct here: the passphrase, not the
   deployment setting, is what gates the data. Run `unlockInternalCalendar` once
   from the editor first to grant the Calendar authorisation.

5. **Publish the web-app URL** in `_data/site.yml`:

   ```yaml
   internal_calendar_endpoint: "https://script.google.com/macros/s/…/exec"
   ```

   This URL is public and contains no credential. While it is empty, the Calendar
   page shows public events only and no unlock control appears at all, so the
   feature is invisible until it is ready.

6. **Tell the committee the passphrase** through a channel that is not the
   website — e-COST, or the usual coordination mailing list.

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

To confirm nothing leaks into the built site, search the published page:

```bash
curl -s https://www.eeg101.eu/calendar/ | grep -ci "internal-"
```

The only matches should be the element IDs of the unlock control itself. No
event title from the internal calendar should ever appear.
