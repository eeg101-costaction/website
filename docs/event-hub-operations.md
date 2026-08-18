# EEG101 Event Hub organiser guide

## Operating model

The Event Hub is part of the existing `www.eeg101.eu` GitHub Pages website. The public interface is available at `/events/` and uses the same site navigation, styles, privacy page, and event data as the rest of EEG101.

GitHub Pages serves the public page only. The Event Hub opens the Google Apps Script registration form inside the EEG101 page, avoiding a cross-origin request that could not reliably report success or failure. The script writes the registration to the private EEG101 workbook and sends the confirmation email. The private spreadsheet and the Apps Script editor provide the organiser-only administration environment. This keeps attendee information out of the public repository and prevents a publicly accessible website route from exposing the registration ledger.

## One-time activation

The registration workbook is named **EEG101 Event Hub Registrations** and has a tab titled **Registration ledger**. The Apps Script must be deployed by a Google account that has Editor access to this workbook. If the script is deployed through `faisalmushtaq@gmail.com`, share the workbook with that address as an Editor before deployment.

Create or open an Apps Script project at [script.google.com](https://script.google.com) under the account that will administer registrations. Replace the contents of `Code.gs` with the repository file `scripts/google-apps-script/event-hub.gs`, then open **Project Settings** and add the Script property `EEG101_EVENT_HUB_SHEET_ID` with the private registration workbook's ID as its value. This keeps the workbook identifier out of the public website repository. Save the project and select **Deploy → New deployment → Web app**. Choose **Execute as: Me** and set access to **Anyone**. The embedded form uses the script's authenticated server-side function and reports a verified success or failure message back to the EEG101 page. The script blocks a duplicate email registration for the same Event ID, uses a lock to prevent concurrent capacity oversubscription, and stores later registrations on the waiting list when capacity is reached.

After authorising the deployment, copy the resulting web-app URL. In `_data/site.yml`, set `event_hub_endpoint` to that URL. This is a public endpoint URL, not a secret. The web-app does not contain credentials in the Jekyll repository. Commit and push the website update on `main`; GitHub Pages will rebuild the site.

## Add an event open for registration

Add the event to `_data/events.yml` using the established event fields and include the Event Hub fields below. The `id` must be unique and should remain stable because it links registrations, the calendar invitation, and Sheet records.

```yaml
- id: wg2-training-october-2026
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
  registration_enabled: true
  registration_status: "open"
  capacity: 60
  tags:
    - WG2
    - training
    - online
```

Set `registration_status` to `closed` when registrations should stop. Remove `registration_enabled` or set it to `false` to keep an event listed in the programme without a registration form. The Event Hub displays capacity information and automatically adds later registrants to the waiting list once the private Sheet contains the configured number of confirmed places.

## Registration administration

The script adds an **EEG101 Event Hub** menu to the private Sheet. Use **Promote the next waiting-list attendee** after a confirmed attendee cancels. The script changes the earliest waiting-list entry for that event to confirmed and sends a promotion email.

The same menu provides **Delete records older than 12 months**. This action includes a confirmation step and permanently removes qualifying records. Before using it, check whether University of Leeds or COST Action procedures require any longer retention period for a particular event.

## Pre-publication checks

Before announcing a registration link, confirm that the GitHub Pages build has completed, the Event Hub displays the event, the capacity and time zone are correct, and the privacy link resolves. Submit a genuine test registration from a non-organiser email address. Confirm that the private Sheet receives the row, that the confirmation message arrives, and that the `.ics` attachment opens in a calendar application. Delete the test row after completing the check.

## Privacy and access controls

The public website contains no attendee list or organiser interface. Attendee fields are collected only after an explicit consent checkbox and are described in `/privacy/`. Limit spreadsheet sharing to authorised organisers and review access when responsibilities change. Do not place the App Script deployment URL, registration workbook ID, or attendee data in public news posts or web-page content.
