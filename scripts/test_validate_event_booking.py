#!/usr/bin/env python3
"""Regression tests for the EEG101 single-source event-booking validator."""

import datetime as dt
import importlib.util
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

    def test_non_bookable_event_cannot_carry_booking_state(self):
        errors = VALIDATOR.validate([event(booking_enabled=False)], self.site, self.today)
        self.assertTrue(any("booking fields are present" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
