#!/usr/bin/env python3
"""Tests for export_drafts.py: drafts are copied for the drafts page, live items are not."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import yaml

SCRIPT = Path(__file__).with_name("export_drafts.py")
SPEC = importlib.util.spec_from_file_location("export_drafts", SCRIPT)
EXPORT = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(EXPORT)


class ExportDrafts(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        for folder in ("_events", "_dates", "_spotlights", "_data"):
            (self.root / folder).mkdir()
        (self.root / "_data" / "site.yml").write_text(
            'content_reviewers:\n  - name: "A Reviewer"\n    github: "@areviewer"\n')
        (self.root / "_events" / "live-talk-2026.md").write_text("---\npublished: true\ntitle: Live\n---\n")
        (self.root / "_events" / "draft-talk-2026.md").write_text(
            '---\npublished: false\nready_for_review: true\ntitle: Draft\ntime: 09:00\nsummary: "1,200"\n---\n')
        (self.root / "_spotlights" / "no-tick.md").write_text("---\ntitle: No tick at all\n---\n")

    def run_export(self):
        review = self.root / "review.json"
        EXPORT.sys.argv = ["export_drafts.py", "--root", str(self.root), "--review-json", str(review)]
        self.assertEqual(EXPORT.main(), 0)
        return (self.root / "_data" / "drafts.yml").read_text(), json.loads(review.read_text())

    def test_only_drafts_are_copied_and_a_missing_tick_counts_as_draft(self):
        text, _ = self.run_export()
        data = yaml.safe_load(text)
        self.assertEqual([e["id"] for e in data["events"]], ["draft-talk-2026"])
        self.assertEqual([s["id"] for s in data["spotlights"]], ["no-tick"])
        self.assertEqual(data["spotlights"][0]["url"], "/drafts/#spotlights-no-tick")
        self.assertIn("edit/_events%2Fdraft-talk-2026.md", data["events"][0]["edit_url"])

    def test_values_survive_jekylls_yaml_reader(self):
        text, _ = self.run_export()
        self.assertIn('time: "09:00"', text)        # not the number 540
        self.assertIn('summary: "1,200"', text)     # Jekyll would read 1,200 as 1200

    def test_review_list_and_reviewers(self):
        _, review = self.run_export()
        self.assertEqual(review["reviewers"], [{"name": "A Reviewer", "github": "areviewer"}])
        ready = [i["key"] for i in review["items"] if i["ready"] and not i["published"]]
        self.assertEqual(ready, ["events/draft-talk-2026"])
        self.assertTrue(any(i["key"] == "events/live-talk-2026" and i["published"] for i in review["items"]))

    def test_running_twice_changes_nothing(self):
        first, _ = self.run_export()
        target = self.root / "_data" / "drafts.yml"
        before = target.stat().st_mtime_ns
        second, _ = self.run_export()
        self.assertEqual(first, second)
        self.assertEqual(before, target.stat().st_mtime_ns)


if __name__ == "__main__":
    unittest.main()
