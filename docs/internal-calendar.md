# The EEG101 Google Calendar on the Calendar page

The [Calendar](https://www.eeg101.eu/calendar/) page shows three things in one
month grid:

* events from `_events/` (the same source as the Events page);
* other dates from `_dates/` (deadlines, calls...);
* every event on the **EEG101 Google Calendar**, shown in navy with the key
  **EEG101 calendar**.

The Google Calendar events are **public**: anyone visiting the page sees them.
Only add things to that calendar that are fine for the world to see.

## How it works

The Google Calendar events are not built into the site. Each time someone
opens the Calendar page, it asks a small Google Apps Script web app
(`scripts/google-apps-script/internal-calendar.gs`) for the events, so an edit
in Google Calendar shows on the site within about five minutes, with no rebuild
and no commit.

For each event the script sends only the **title, dates, times, time zone and
location**, with any web links removed from the location. **Descriptions are
never sent**, so meeting links and passcodes kept in the description stay
private. A Zoom or Teams link pasted into the *title* would be published, so
keep links out of titles.

If an event is on the Google Calendar **and** on the website already (same
title, same start date), it is shown once, the website's way, with its Register
and Share buttons.

If the script is down or slow, the page shows the website's own events as
normal.

## Setting it up

You need a Google account that can **see all event details** of the calendar
(free/busy access is not enough). The web app keeps running as whoever deploys
it, so use an account that will not be closed when someone leaves.

1. **Calendar ID.** In [calendar.google.com](https://calendar.google.com) on a
   computer, hover the calendar's name in the left sidebar → **⋮** →
   **Settings and sharing** → **Integrate calendar** → copy **Calendar ID**.
2. **Project.** At [script.google.com](https://script.google.com) → **New
   project**, named *EEG101 internal calendar*. Keep it separate from the
   booking and grants scripts. Replace `Code.gs` with
   `scripts/google-apps-script/internal-calendar.gs` and save.
3. **Script Property.** ⚙ **Project Settings → Script Properties** → add
   `EEG101_INTERNAL_CALENDAR_ID` = the Calendar ID.
4. **Check it.** In the editor pick **testCalendarFeed** → **Run**, allow the
   permissions (**Advanced → Go to … (unsafe) → Allow**; "unsafe" only means
   Google has not reviewed your own script). The log says how many events it
   found, or that the calendar could not be opened (wrong ID, or the account
   cannot see the calendar).
5. **Deploy.** **Deploy → New deployment → ⚙ Web app**, **Execute as: Me**,
   **Who has access: Anyone** → **Deploy**, and copy the URL ending `/exec`.
6. **Website.** In `_data/site.yml` set `internal_calendar_endpoint` to that URL,
   commit and push to `main`.

Use a private browser window if script.google.com says *"Sorry, unable to open
the file at present"*: that is Google getting confused by several signed-in
accounts. Visitors to the Calendar page are not affected, because the page
fetches the events without anyone's Google sign-in.

## Changing it later

* **Different calendar:** edit `EEG101_INTERNAL_CALENDAR_ID`. Nothing needs
  redeploying.
* **Script changes:** paste the new file in and use **Deploy → Manage
  deployments → pencil → New version → Deploy**, which keeps the same URL.
* **Turning it off:** set `internal_calendar_endpoint` back to `""`.

An older version of this script had a passphrase. If the Script Properties still
hold `EEG101_CALENDAR_PASSPHRASE`, it is no longer used and can be deleted.
