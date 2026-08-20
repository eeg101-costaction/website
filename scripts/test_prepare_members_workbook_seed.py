#!/usr/bin/env python3
"""Regression tests for the private Members workbook seed generator."""

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prepare_members_workbook_seed.py"
DATA = ROOT / "assets" / "data" / "network-map.json"


class MembersWorkbookSeedTests(unittest.TestCase):
    def setUp(self):
        self.dataset = json.loads(DATA.read_text(encoding="utf-8"))
        result = subprocess.run(["python3", str(SCRIPT)], check=True, text=True, capture_output=True)
        self.payload = json.loads(result.stdout)

    def test_contains_three_workbook_ranges(self):
        ranges = [entry["range"] for entry in self.payload["data"]]
        self.assertEqual(ranges, ["Read me!A1:B8", f"Location cache!A1:K{self.dataset['site_count'] + 1}", "Publishing log!A1:I1"])

    def test_location_cache_matches_current_site_count(self):
        cache_values = self.payload["data"][1]["values"]
        self.assertEqual(len(cache_values), self.dataset["site_count"] + 1)
        self.assertEqual(cache_values[0][0], "cache_key")
        self.assertEqual(cache_values[1][1], "institution")
        self.assertTrue(cache_values[1][0].startswith("institution|"))

    def test_guidance_requires_unchanged_raw_export(self):
        read_me = self.payload["data"][0]["values"]
        instructions = " ".join(row[-1] for row in read_me)
        self.assertIn("original header row", instructions)
        self.assertIn("Do not rename", instructions)


if __name__ == "__main__":
    unittest.main()
