# EEG101 Event Hub validation record

## Local static-site validation

The Jekyll production build completed successfully on 18 August 2026 after the Event Hub was added at `/events/`. The browser preview confirmed that the page inherits the existing EEG101 header, footer, typography, navigation, and colour system. The Event Hub correctly presents an empty state when no forthcoming event is marked as open for registration.

The browser console was also clear after the Event Hub page and its registration JavaScript loaded. A live registration test remains dependent on the manual Apps Script deployment and a genuine forthcoming event being marked as open in `_data/events.yml`.

## Registration activation requirements

An organiser must add `registration_enabled: true`, `registration_status: open`, and the event-specific capacity, time and timezone fields to the relevant entry in `_data/events.yml`. The public Apps Script web-app URL must then be added to `_data/site.yml` as `event_hub_endpoint`.

The private registration workbook needs to be shared with the Gmail account that deploys the Apps Script as an Editor. The script uses that account's authorisation to append private registrations and send event messages. The spreadsheet remains private and no attendee information is placed in the GitHub Pages repository.

## Manual organiser controls

The Apps Script adds an **EEG101 Event Hub** menu to the private Sheet. It provides manual promotion of the next waiting-list registration and a confirmation-gated deletion process for records older than 12 months. The stated 12-month retention rule should be checked against the University of Leeds and COST Action data-governance requirements before activation.
