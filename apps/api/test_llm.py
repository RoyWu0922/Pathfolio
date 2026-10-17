"""Tests for the LLM layer: switches, redaction and the fact-check.

Run: python3 apps/api/test_llm.py
No network and no key required — the switches are pure environment reads.
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))

import llm  # noqa: E402

PROFILE = json.loads((ROOT / "data" / "samples" / "cityu_graduate.json").read_text())


class EnvGuard(unittest.TestCase):
    def setUp(self):
        self.saved = {k: os.environ.get(k) for k in ("PATHFOLIO_FIXTURE_MODE", "PATHFOLIO_LLM_TASKS", "OPENAI_API_KEY")}
        for k in self.saved:
            os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self.saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class TestSwitches(EnvGuard):
    def test_default_is_fixtures_only(self):
        status = llm.task_status()
        self.assertEqual(set(status.values()), {"fixture"}, status)
        self.assertFalse(llm.task_enabled("suggest"))

    def test_key_alone_keeps_extract_only(self):
        os.environ["OPENAI_API_KEY"] = "sk-test"
        os.environ["PATHFOLIO_FIXTURE_MODE"] = "false"
        self.assertTrue(llm.task_enabled("extract"))
        self.assertFalse(llm.task_enabled("suggest"), "an old .env must not start spending on every task")

    def test_explicit_task_list(self):
        os.environ["OPENAI_API_KEY"] = "sk-test"
        os.environ["PATHFOLIO_FIXTURE_MODE"] = "false"
        os.environ["PATHFOLIO_LLM_TASKS"] = "extract,suggest,stories"
        self.assertTrue(llm.task_enabled("suggest"))
        self.assertTrue(llm.task_enabled("stories"))
        self.assertFalse(llm.task_enabled("strategy"))
        self.assertFalse(llm.task_enabled("tracks"))

    def test_fixture_mode_beats_everything(self):
        os.environ["OPENAI_API_KEY"] = "sk-test"
        os.environ["PATHFOLIO_LLM_TASKS"] = "extract,suggest,stories,strategy,tracks"
        os.environ["PATHFOLIO_FIXTURE_MODE"] = "true"
        self.assertEqual(set(llm.task_status().values()), {"fixture"})

    def test_no_key_means_no_llm_even_when_listed(self):
        os.environ["PATHFOLIO_FIXTURE_MODE"] = "false"
        os.environ["PATHFOLIO_LLM_TASKS"] = "stories"
        self.assertFalse(llm.task_enabled("stories"))

    def test_unknown_task_names_are_ignored(self):
        os.environ["OPENAI_API_KEY"] = "sk-test"
        os.environ["PATHFOLIO_FIXTURE_MODE"] = "false"
        os.environ["PATHFOLIO_LLM_TASKS"] = "suggest,not_a_task"
        self.assertEqual(llm.enabled_tasks(), {"suggest"})


class TestRedaction(unittest.TestCase):
    def test_strips_email_phone_link_and_name(self):
        raw = "Alex Chan\n+852 9123 4567\nalex.chan@example.edu\nhttps://linkedin.com/in/alex\nBuilt dashboards."
        clean, kinds = llm.strip_identifiers(raw)
        self.assertNotIn("alex.chan@example.edu", clean)
        self.assertNotIn("9123", clean)
        self.assertNotIn("linkedin.com", clean)
        self.assertNotIn("Alex Chan", clean)
        self.assertEqual(set(kinds), {"email", "phone", "link", "display_name"})

    def test_plain_text_untouched(self):
        raw = "Built weekly dashboards for three squads."
        clean, kinds = llm.strip_identifiers(raw)
        self.assertEqual(clean, raw)
        self.assertEqual(kinds, [])

    def test_strip_profile_drops_name_and_contact(self):
        safe = llm.strip_profile(PROFILE)
        self.assertNotIn("display_name", safe)
        self.assertNotIn("contact", safe)
        self.assertEqual(safe["school"], PROFILE["school"])
        # must be a copy, not a view
        safe["skills"].append("mutated")
        self.assertNotIn("mutated", PROFILE["skills"])


class TestFactCheck(unittest.TestCase):
    def test_accepts_text_built_from_the_profile(self):
        text = "Built weekly dashboards tracking activation and retention for three product squads, saving six hours per week."
        ok, problems = llm.check_grounded(text, PROFILE)
        self.assertTrue(ok, problems)

    def test_rejects_invented_metric(self):
        text = "Built weekly dashboards that lifted retention by 37 percent across five squads."
        ok, problems = llm.check_grounded(text, PROFILE)
        self.assertFalse(ok)
        self.assertTrue(any(p.startswith("new_number:") for p in problems), problems)

    def test_rejects_invented_employer(self):
        text = "Ran the reporting cycle at Goldman Sachs for the trading desk."
        ok, problems = llm.check_grounded(text, PROFILE)
        self.assertFalse(ok)
        self.assertTrue(any(p.startswith("new_org:") for p in problems), problems)

    def test_known_employer_passes(self):
        ok, problems = llm.check_grounded("Automated a reporting flow at Helix Studio.", PROFILE)
        self.assertTrue(ok, problems)

    def test_track_keyword_may_be_mentioned(self):
        # naming the target role's tooling is legitimate in a rewrite draft
        ok, problems = llm.check_grounded("Rebuilt the weekly cohort view in Tableau.", PROFILE, allow={"tableau"})
        self.assertTrue(ok, problems)

    def test_story_check_covers_all_four_parts(self):
        story = {
            "situation": "At Helix Studio the squad disagreed.",
            "task": "I had to settle it.",
            "action": "I pulled cohorts and built a chart.",
            "result": "Something impossible: 88 percent uplift.",
        }
        ok, problems = llm.check_story_grounded(story, PROFILE)
        self.assertFalse(ok)
        self.assertTrue(any("88" in p for p in problems), problems)


if __name__ == "__main__":
    unittest.main(verbosity=2)
