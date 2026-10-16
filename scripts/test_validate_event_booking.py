#!/usr/bin/env python3
"""Regression tests for the EEG101 single-source event-booking validator."""

import datetime as dt
import importlib.util
import pathlib
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate_event_booking.py")
SPEC = importlib.util.spec_from_file_location("validate_event_booking", SCRIPT)
VALIDATOR = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(VALIDATOR)


def event(**overrides):
    value = {
        "id": "wg2-training-october-2026", "title": "EEG101 WG2 Training", "start_date": "2026-10-15",
        "end_date": "2026-10-15", "time": "14:00", "end_time": "16:00", "timezone": "Europe/London",
        "location": "Online", "format": "online", "category": "Events", "summary": "A practical EEG101 training session.",
        "capacity": 60, "booking_enabled": True, "booking_status": "open", "registration_url": "",
    }
    value.update(overrides)
    return value


class EventBookingValidationTests(unittest.TestCase):
    def setUp(self):
        self.today = dt.date(2026, 8, 18)
        self.site = {"event_booking_endpoint": "https://script.google.com/macros/s/example/exec"}

    def test_complete_bookable_event_passes(self):
        self.assertEqual(VALIDATOR.validate([event()], self.site, self.today), [])

    def test_bookable_event_requires_private_endpoint(self):
        errors = VALIDATOR.validate([event()], {"event_booking_endpoint": ""}, self.today)
        self.assertTrue(any("event_booking_endpoint" in error for error in errors))

    def test_duplicate_ids_are_rejected(self):
        errors = VALIDATOR.validate([event(), event(title="Repeated ID")], self.site, self.today)
        self.assertTrue(any("duplicated" in error for error in errors))

    def test_incomplete_booking_and_external_url_are_rejected(self):
        errors = VALIDATOR.validate([event(end_time="", registration_url="https://example.org/register")], self.site, self.today)
        self.assertTrue(any("end_time" in error for error in errors))
        self.assertTrue(any("registration_url" in error for error in errors))

    def test_booking_left_filled_after_turning_bookings_off_is_only_a_warning(self):
        """Unticking "Take bookings" in the editor leaves the status and places behind."""
        off = event(booking_enabled=False)
        self.assertEqual(VALIDATOR.validate([off], self.site, self.today), [])
        self.assertTrue(any("bookings are off" in n for n in VALIDATOR.advisories([off], self.today)))

    def test_one_day_bookable_event_needs_no_last_day_or_places(self):
        """The editor says to leave the last day empty for one day; blank places means no limit."""
        one_day = event()
        del one_day["end_date"], one_day["capacity"]
        self.assertEqual(VALIDATOR.validate([one_day], self.site, self.today), [])
        self.assertEqual(VALIDATOR.validate([event(end_date="", capacity=None)], self.site, self.today), [])

    def test_any_event_ending_before_it_starts_is_rejected(self):
        errors = VALIDATOR.validate([event(booking_enabled=False, booking_status="", capacity=0,
                                           end_date="2026-10-01")], self.site, self.today)
        self.assertTrue(any("before the first day" in error for error in errors))

    def test_links_must_be_web_addresses_or_site_pages(self):
        plain = dict(booking_enabled=False, booking_status="", capacity=0)
        for good in ("https://example.org/a?b=1", "/video-hub/", ""):
            self.assertEqual(VALIDATOR.validate([event(**plain, programme_url=good)], self.site, self.today), [], good)
        for bad in ("javascript:alert(1)", "zenodo.org/records/1", "//evil.example", "/a b", 'https://x.org/"onmouseover="x'):
            errors = VALIDATOR.validate([event(**plain, recording_url=bad)], self.site, self.today)
            self.assertTrue(any("recording_url" in e for e in errors), bad)


    # -- Pages CMS writes every field, blank or not --------------------------------

    def test_an_ordinary_event_saved_by_the_editor_passes(self):
        """Every field present, booking ones left at the editor's blank defaults."""
        blank = event(id="lecture-series-2026", booking_enabled=False, booking_status="", capacity=0,
                      joining_link="", registration_url="https://example.org/register")
        self.assertEqual(VALIDATOR.validate([blank], self.site, self.today), [])

    def test_a_time_zone_on_a_non_bookable_event_is_fine(self):
        """The Calendar converts any event's time, so these are not booking-only any more."""
        timed = event(booking_enabled=False, booking_status="", capacity=0, timezone="Europe/Brussels", end_time="16:00")
        self.assertEqual(VALIDATOR.validate([timed], self.site, self.today), [])

    def test_a_past_event_left_open_is_a_warning_not_a_failure(self):
        past = event(start_date="2026-01-10", end_date="2026-01-10")
        self.assertEqual(VALIDATOR.validate([past], self.site, self.today), [])
        self.assertTrue(VALIDATOR.advisories([past], self.today))

    # -- other calendar dates and Spotlights -----------------------------------------

    def test_dates(self):
        ok = {"id": "round-2-deadline", "title": "Round 2 deadline", "start_date": "2026-11-30", "time": "17:00", "link": "/grants/"}
        self.assertEqual(VALIDATOR.validate_dates([ok]), [])
        self.assertTrue(VALIDATOR.validate_dates([{**ok, "title": ""}]))
        self.assertTrue(VALIDATOR.validate_dates([{**ok, "end_date": "2026-11-01"}]))
        self.assertTrue(VALIDATOR.validate_dates([{**ok, "time": "5pm"}]))
        self.assertTrue(VALIDATOR.validate_dates([{**ok, "link": "grants page"}]))

    def test_spotlights(self):
        ok = {"id": "stsm-x", "title": "T", "type": "Virtual Mobility", "summary": "S", "image": "/a.jpg",
              "image_alt": "A", "date": "2026-04-18", "links": [{"label": "L", "url": "/x/"}]}
        self.assertEqual(VALIDATOR.validate_spotlights([ok]), [])
        self.assertTrue(VALIDATOR.validate_spotlights([{**ok, "image_alt": ""}]))
        self.assertTrue(VALIDATOR.validate_spotlights([{**ok, "date": ""}]))
        self.assertTrue(VALIDATOR.validate_spotlights([{**ok, "links": [{"label": "L", "url": ""}]}]))
        self.assertTrue(VALIDATOR.validate_spotlights([{**ok, "links": [{"label": "L", "url": "javascript:alert(1)"}]}]))
        self.assertTrue(VALIDATOR.validate_spotlights([{**ok, "figures": [{"heading": "H", "image": ""}]}]))
        self.assertTrue(VALIDATOR.validate_spotlights([{**ok, "why": {"text": "[x](JavaScript:alert(1))"}}]))
        self.assertTrue(VALIDATOR.validate_dates([{"id": "d", "title": "T", "start_date": "2026-11-30", "link": "/\"onmouseover=\"x"}]))

    # -- files ---------------------------------------------------------------------------

    def test_filenames_are_the_ids(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            d = pathlib.Path(tmp)
            (d / "good-event-2026.md").write_text("---\ntitle: A\n---\n")
            (d / "Bad Name.md").write_text("---\ntitle: B\n---\n")
            (d / "2026-11-05-dated.md").write_text("---\ntitle: C\n---\n")
            (d / "mismatch.md").write_text("---\nid: something-else\ntitle: D\n---\n")
            (d / "broken.md").write_text("no front matter here")
            (d / "reserved.md").write_text("---\ntitle: E\nurl: /grants/\nnext: x\n---\n")
            items, errors = VALIDATOR.load_items(d)
            self.assertIn("good-event-2026", [i["id"] for i in items])
            joined = "\n".join(errors)
            self.assertIn("Bad Name.md", joined)
            self.assertIn("must not start with a date", joined)
            self.assertIn("mismatch.md", joined)
            self.assertIn("broken.md", joined)
            self.assertIn("'url' is reserved", joined)
            self.assertIn("'next' is reserved", joined)
            self.assertNotIn("good-event-2026.md", joined)

    def test_unquoted_times_read_as_typed(self):
        """YAML 1.1 reads 09:00 as 540; the validator turns it back into the time that was typed."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            d = pathlib.Path(tmp)
            (d / "timed-event.md").write_text("---\ntitle: A\ntime: 09:00\nend_time: 17:30:00\n---\n")
            items, errors = VALIDATOR.load_items(d)
            self.assertEqual(errors, [])
            self.assertEqual((items[0]["time"], items[0]["end_time"]), ("09:00", "17:30"))
        self.assertEqual(VALIDATOR.clock(0), "00:00")
        self.assertEqual(VALIDATOR.clock("14:00"), "14:00")
        self.assertEqual(VALIDATOR.clock(""), "")


if __name__ == "__main__":
    unittest.main()
