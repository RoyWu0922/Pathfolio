"""Scoring tests. Run: python3 packages/scoring/tests/test_scoring.py -v

Uses unittest only, so no pytest install is needed.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages"))

from scoring import (  # noqa: E402
    SEVEN,
    evidence_transfer,
    interview_readiness,
    nace_coverage,
    plan_seven,
    resume_scan,
    score_track,
    skill_overlap,
    star_score,
    story_coverage,
    track_fit,
    wef_align,
)

SAMPLES = ROOT / "data" / "samples"
TRACKS = ROOT / "data" / "tracks"
CASES = json.loads((SAMPLES / "scoring_cases.json").read_text())


def load(name: str):
    return json.loads((TRACKS / name).read_text())


class TestSkillOverlap(unittest.TestCase):
    def test_jaccard_pinned(self):
        case = CASES["jaccard_analytics_cityu"]
        got = skill_overlap(set(case["profile_skills"]), set(case["track_keywords"]))
        self.assertAlmostEqual(got, case["expected_overlap"], delta=case["tolerance"])

    def test_empty_sets_are_zero(self):
        self.assertEqual(skill_overlap(set(), {"sql"}), 0.0)
        self.assertEqual(skill_overlap({"sql"}, set()), 0.0)


class TestTrackFit(unittest.TestCase):
    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(__import__("scoring").WEIGHTS.values()), 1.0, places=6)

    def test_max_components_give_100(self):
        perfect = {k: 1.0 for k in ("skill_overlap", "nace_coverage", "evidence_transfer", "wef_align")}
        self.assertEqual(track_fit(perfect), 100.0)

    def test_relabels_rows_in_right_order(self):
        # Components must be matched to their own weights, not by position.
        self.assertEqual(track_fit({"skill_overlap": 1.0}), 40.0)
        self.assertEqual(track_fit({"nace_coverage": 1.0}), 30.0)
        self.assertEqual(track_fit({"evidence_transfer": 1.0}), 20.0)
        self.assertEqual(track_fit({"wef_align": 1.0}), 10.0)


class TestNace(unittest.TestCase):
    def test_capped_at_five(self):
        raw = {c: 99 for c in SEVEN}
        self.assertEqual(nace_coverage(raw), 1.0)

    def test_empty_is_zero(self):
        self.assertEqual(nace_coverage({}), 0.0)


class TestEvidenceTransfer(unittest.TestCase):
    def test_half(self):
        exps = [
            {"title": "Data Intern", "org": "Helix", "bullets": ["built sql dashboards"]},
            {"title": "Barista", "org": "Cafe", "bullets": ["made coffee quickly"]},
        ]
        self.assertEqual(evidence_transfer(exps, {"sql"}), 0.5)

    def test_no_experience(self):
        self.assertEqual(evidence_transfer([], {"sql"}), 0.0)


class TestWefAlign(unittest.TestCase):
    def test_half(self):
        rising = {"ai_big_data": ["sql", "python"], "creative_thinking": ["design"]}
        self.assertEqual(wef_align({"sql", "excel"}, rising), 0.5)

    def test_capped_at_one(self):
        rising = {"g": ["sql", "python"]}
        self.assertEqual(wef_align({"sql", "python"}, rising), 1.0)


class TestStarScore(unittest.TestCase):
    def test_full_quantified_is_five(self):
        got = star_score(CASES["star_full_quantified"])
        self.assertEqual(got["score"], 5, got)

    def test_we_only_is_capped_at_two(self):
        got = star_score(CASES["star_we_only"])
        self.assertLessEqual(got["score"], 2, got)
        self.assertIn("no_first_person", got["breakdown"]["caps"])

    def test_missing_result_capped_at_three(self):
        got = star_score(CASES["star_no_result"])
        self.assertLessEqual(got["score"], 3, got)
        self.assertIn("no_result", got["breakdown"]["caps"])

    def test_empty_story_is_zero(self):
        self.assertEqual(star_score({})["score"], 0)

    def test_short_attempt_is_one(self):
        got = star_score({"situation": "We had a problem in the team last term and it was hard."})
        self.assertEqual(got["score"], 1, got)

    def test_word_share_keys(self):
        got = star_score(CASES["star_full_quantified"])
        self.assertEqual(set(got["word_share"]), {"s", "t", "a", "r"})


class TestResumeScan(unittest.TestCase):
    def setUp(self):
        self.profile = json.loads((SAMPLES / "cityu_graduate.json").read_text())
        self.analytics = load("analytics.json")

    def test_full_profile_is_high(self):
        got = resume_scan(self.profile, self.analytics)
        self.assertEqual(got["six_point"]["total"], 60, got)
        self.assertGreaterEqual(got["score"], 60, got)

    def test_missing_dates_lowers_score(self):
        profile = json.loads(json.dumps(self.profile))
        for exp in profile["experiences"]:
            exp["start"] = ""
            exp["end"] = ""
            exp["current"] = False
        got = resume_scan(profile, self.analytics)
        self.assertLess(got["six_point"]["total"], 60)
        self.assertIn("missing_dates", got["flags"])
        baseline = resume_scan(self.profile, self.analytics)["score"]
        self.assertLess(got["score"], baseline)

    def test_photo_flag_costs_layout(self):
        got = resume_scan(self.profile, self.analytics, {"has_photo": True})
        self.assertLess(got["layout"], 15)
        self.assertIn("photo_pulls_gaze", got["flags"])

    def test_no_bullets_penalised(self):
        profile = json.loads(json.dumps(self.profile))
        for exp in profile["experiences"]:
            exp["bullets"] = []
        got = resume_scan(profile, self.analytics)
        self.assertLess(got["layout"], 15)
        baseline = resume_scan(self.profile, self.analytics)
        self.assertLess(got["score"], baseline["score"])


class TestReadiness(unittest.TestCase):
    def test_story_coverage(self):
        stories = [
            {"competency": "communication", "score": 4},
            {"competency": "teamwork", "score": 3},
        ]
        self.assertAlmostEqual(story_coverage(stories), 2 / 7, places=4)

    def test_empty_stories_zero(self):
        self.assertEqual(story_coverage([]), 0.0)

    def test_composite_bounds(self):
        stories = [{"competency": c, "score": 5} for c in SEVEN]
        value = interview_readiness(100.0, 100.0, stories)
        self.assertAlmostEqual(value, 100.0, delta=0.2)

    def test_no_stories_still_computed(self):
        self.assertGreater(interview_readiness(80.0, 80.0, []), 0.0)


class TestPlanSeven(unittest.TestCase):
    def test_seven_rows(self):
        scan = {"six_point": {"total": 60}}
        self.assertEqual(len(plan_seven(scan, [])), 7)

    def test_mandatory_day_one_when_weak_resume(self):
        scan = {"six_point": {"total": 40}}
        plan = plan_seven(scan, [])
        self.assertTrue(plan[0].get("mandatory"))


class TestScoreTrack(unittest.TestCase):
    def setUp(self):
        self.profile = json.loads((SAMPLES / "cityu_graduate.json").read_text())

    def test_three_tracks_have_different_scores(self):
        rising = json.loads((TRACKS / "wef_rising.json").read_text())
        aliases = json.loads((TRACKS / "aliases.json").read_text())
        scores = {}
        for name in ("analytics.json", "product_ops.json", "commercial.json"):
            track = load(name)
            scores[track["id"]] = score_track(self.profile, track, rising, aliases)["track_fit"]
        self.assertEqual(len(scores), 3)
        self.assertEqual(len(set(scores.values())), 3, scores)

    def test_bounds(self):
        rising = json.loads((TRACKS / "wef_rising.json").read_text())
        got = score_track(self.profile, load("analytics.json"), rising, {})
        self.assertGreaterEqual(got["track_fit"], 0.0)
        self.assertLessEqual(got["track_fit"], 100.0)
        self.assertEqual(set(got["components"]), set(__import__("scoring").WEIGHTS))


if __name__ == "__main__":
    unittest.main(verbosity=2)
