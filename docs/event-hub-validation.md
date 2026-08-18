# EEG101 Event Hub validation record

## Unified event-booking validation

The Jekyll production build and the booking-data validator run together before the GitHub Pages site is published. The validation script treats `_data/events.yml` as the single source of truth. A bookable event must contain a complete schedule, event details, capacity, `booking_enabled: true`, and a booking state of `open` or `closed`. It also rejects duplicate event IDs, an external registration URL on a bookable event, a past event marked open, and a missing private booking endpoint.

The public News & Events card and calendar popover each use the same event ID and booking fields. A **Register** control appears only where `booking_enabled: true` and `booking_status: open` are present in that one record. No separate event page or secondary list needs updating.

The shared booking modal was exercised locally with an in-memory bookable event, rather than by adding fabricated programme content. It opened from the News & Events page, identified the selected event correctly, and exposed the expected pre-activation message while the private Apps Script endpoint remains intentionally unset.

The calendar page was also verified locally. It includes the same shared booking controller and registration modal as News & Events, allowing an event marked bookable in `_data/events.yml` to expose the identical booking flow from its calendar popover.

## Registration activation requirements

An organiser must add `booking_enabled: true`, `booking_status: open`, and the event-specific capacity, time and timezone fields to the relevant entry in `_data/events.yml`. The public Apps Script web-app URL must then be added to `_data/site.yml` as `event_booking_endpoint`.

The private registration workbook needs to be shared with the Gmail account that deploys the Apps Script as an Editor. The script uses that account's authorisation to append private registrations and send event messages. The spreadsheet remains private and no attendee information is placed in the GitHub Pages repository.

## Manual organiser controls

The Apps Script adds an **EEG101 Event Booking** menu to the private Sheet. It provides manual promotion of the next waiting-list registration and a confirmation-gated deletion process for records older than 12 months. The stated 12-month retention rule should be checked against the University of Leeds and COST Action data-governance requirements before activation.
