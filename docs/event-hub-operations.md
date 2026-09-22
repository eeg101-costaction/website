# EEG101 event booking organiser guide

## Operating model

The existing **News & Events** feed is the only public list of EEG101 events. It already draws every event from `_data/events.yml`. A booking-enabled event displays a **Register** button directly on its News & Events card and in its calendar popover. There is no separate event list or Event Hub page to maintain.

GitHub Pages serves the public event information only. The booking action opens the Google Apps Script registration form inside the existing EEG101 page, avoiding a cross-origin request that could not reliably report success or failure. The script writes the registration to the private EEG101 workbook and sends the confirmation email. The private spreadsheet and the Apps Script editor provide the organiser-only administration environment. This keeps attendee information out of the public repository and prevents a publicly accessible website route from exposing the registration ledger.

## One-time activation

The registration workbook is named **EEG101 Event Hub Registrations**. Registrations for each event are kept on that event's own tab. The Apps Script must be deployed by a Google account that has Editor access to this workbook. If the script is deployed through `faisalmushtaq@gmail.com`, share the workbook with that address as an Editor before deployment.

Create or open an Apps Script project at [script.google.com](https://script.google.com) under the account that will administer registrations. Replace the contents of `Code.gs` with the repository file `scripts/google-apps-script/event-hub.gs`, then open **Project Settings** and add the Script property `EEG101_EVENT_BOOKING_SHEET_ID` with the private registration workbook's ID as its value. This keeps the workbook identifier out of the public website repository. Save the project and select **Deploy → New deployment → Web app**. Choose **Execute as: Me** and set access to **Anyone**. The embedded form uses the script's authenticated server-side function and reports a verified success or failure message back to the EEG101 page. The script blocks a duplicate email registration for the same Event ID, uses a lock to prevent concurrent capacity oversubscription, and stores later registrations on the waiting list when capacity is reached.

Before the first deployment, run `installPendingEmailTrigger` once to create the hourly trigger that sends queued emails. This asks for authorisation the first time it runs. If columns are later added to the script, run `updateLedgerHeaders` to add the new headers to every event tab. After authorising the deployment, copy the resulting web-app URL. When the script changes later, paste the new version into the editor and use **Deploy → Manage deployments → Edit → New version**, which keeps the same web-app URL. In `_data/site.yml`, set `event_booking_endpoint` to that URL. This is a public endpoint URL, not a secret. The web-app does not contain credentials in the Jekyll repository. Commit and push the website update on `main`; GitHub Pages will rebuild the site.

## Add an event with booking

Add the event once to `_data/events.yml` using the established event fields and include the booking fields below. The `id` must be unique and should remain stable because it links the News & Events card, calendar popover, registration, calendar invitation, and Sheet records.

```yaml
- id: wg2-training-october-2026
  short_name: "WG2 training"
  title: "EEG101 WG2 Training Session"
  start_date: 2026-10-15
  end_date: 2026-10-15
  time: "14:00"
  end_time: "16:00"
  timezone: "Europe/London"
  location: "Online"
  format: "online"
  category: "Events"
  summary: "A practical EEG101 training session for Working Group 2 members."
  booking_enabled: true
  booking_status: "open"
  capacity: 60
  tags:
    - WG2
    - training
    - online
```

Set `booking_status` to `closed` when registrations should stop. Omit the booking fields for an event that does not require registration. The site validation step rejects any incomplete or contradictory booking configuration before the website can publish, including a bookable event that lacks the private Apps Script endpoint. Later registrants are added to the waiting list once the private Sheet contains the configured number of confirmed places.

## Registration administration

Each event has its own tab in the registration workbook, named from its `short_name` and date, for example **WG2 training (2026-10-15)**. The tab is created automatically when the first person registers. If `short_name` is omitted, the title is used instead. Tabs can be renamed or reordered freely because the script tracks them by their internal ID.

The registration form asks for first name, last name, institution, country, email address, whether the attendee is under 40 (Young Researcher and Innovator status) and gender (Male, Female or Prefer not to say). Attendees must tick a recording consent (being recorded and the recording being published online) and the privacy consent before they can book. Each registration is written to the ledger before any email is attempted, and the attendee immediately sees an on-screen confirmation with an **Add to calendar (.ics)** download. Waiting-list registrants see a waiting-list confirmation without a calendar file.

Google limits a personal Gmail account to 100 email recipients a day. When that limit is reached, bookings continue normally and the **Email status** column records **Email pending**. The hourly trigger sends queued emails in registration order once quota is available again, and the menu item **Send pending emails now** does the same on demand. Attendees are never shown the queued state.

The script adds an **EEG101 Event Booking** menu to the private Sheet. Use **Promote the next waiting-list attendee** after a confirmed attendee cancels. The script changes the earliest waiting-list entry for that event to confirmed and sends a promotion email.

The same menu provides **Delete records older than 12 months**. This action includes a confirmation step and permanently removes qualifying records. Before using it, check whether University of Leeds or COST Action procedures require any longer retention period for a particular event.

## Pre-publication checks

Before announcing a bookable event, confirm that the GitHub Pages build has completed, the **Register** button appears on the relevant News & Events card and calendar popover, the capacity and time zone are correct, and the privacy link resolves. Submit a genuine test registration from a non-organiser email address. Confirm that the private Sheet receives the row, that the confirmation message arrives, and that the `.ics` attachment opens in a calendar application. Delete the test row after completing the check.

## Privacy and access controls

The public website contains no attendee list or organiser interface. Attendee fields are collected only after an explicit consent checkbox and are described in `/privacy/`. Limit spreadsheet sharing to authorised organisers and review access when responsibilities change. Do not place the App Script deployment URL, registration workbook ID, or attendee data in public news posts or web-page content.
