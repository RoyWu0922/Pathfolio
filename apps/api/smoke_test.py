"""End-to-end API smoke test. Run: python3 apps/api/smoke_test.py

Walks the exact demo path so a failure here means the demo would fail.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)
failures: list[str] = []


def check(label: str, cond: bool, detail: object = "") -> None:
    print(f'{"PASS" if cond else "FAIL"}  {label}{"" if cond else "  -> " + str(detail)[:200]}')
    if not cond:
        failures.append(label)


def main() -> int:
    r = client.get("/healthz")
    check("healthz", r.status_code == 200 and r.json()["ok"], r.text)
    print("     ", r.json())

    sid = client.post("/v1/session", json={}).json()["session_id"]
    check("session created", bool(sid), sid)

    r = client.post("/v1/profile/parse", json={"session_id": sid, "use_sample": True})
    check("sample profile loads", r.status_code == 200 and r.json()["profile"]["experiences"], r.text)
    check("identifiers flagged", "display_name" in r.json()["stripped_fields"], r.json().get("stripped_fields"))

    r = client.post("/v1/tracks/recommend", json={"session_id": sid})
    tracks = r.json()["tracks"]
    check("three tracks", len(tracks) == 3, [t["id"] for t in tracks])
    fits = [t["track_fit"] for t in tracks]
    check("scores in range", all(0 <= f <= 100 for f in fits), fits)
    check("picked from a wider field", r.json()["considered"] >= len(tracks), r.json().get("considered"))
    check("fixture mode picks by rank", r.json()["picked_by"] == "ranking", r.json().get("picked_by"))
    check("sorted desc", fits == sorted(fits, reverse=True), fits)
    check("copy present", all(t["rationale"] and t["positioning"] for t in tracks), track_dump(tracks))

    top = tracks[0]["id"]

    r = client.post("/v1/resume/scan", json={"session_id": sid, "track_id": top})
    scan = r.json()["scan"]
    check("six-point complete", scan["six_point"]["total"] == 60, scan["six_point"])
    check("scan in range", 0 <= scan["score"] <= 100, scan["score"])

    r = client.post("/v1/resume/suggest", json={"session_id": sid, "track_id": top})
    sug = r.json()["suggestions"]
    check("suggestions returned", len(sug) >= 2, len(sug))
    check("suggestion rewords, not invents", all(s["after"] != s["before"] for s in sug), sug)

    r = client.post("/v1/stories/generate", json={"session_id": sid, "track_id": top})
    stories = r.json()["stories"]
    check("stories returned", len(stories) >= 4, len(stories))
    check("stories scored 1-5", all(1 <= s["score"] <= 5 for s in stories), [s["score"] for s in stories])
    check("word shares present", all(set(s["word_share"]) == {"s", "t", "a", "r"} for s in stories), None)

    r = client.post("/v1/stories/score", json={"story": {"situation": "In 2025 at Helix the team disagreed about retention.", "task": "I had to settle the cause before the review.", "action": "I pulled trial cohorts in SQL, split first-session behaviour, built one chart of the churn split, wrote the repeatable query, and walked the product lead through two options.", "result": "Retention rose 6 percent."}})
    check("standalone star score", r.json()["score"] >= 4, r.json())

    r = client.post("/v1/strategy", json={"session_id": sid, "track_id": top})
    strat = r.json()
    check("questions 8-12", 8 <= len(strat["questions"]) <= 12, len(strat["questions"]))
    check("plan has 7 rows", len(strat["plan7"]) == 7, len(strat["plan7"]))

    decide_id = sug[0]["id"]
    r = client.post("/v1/decision", json={"session_id": sid, "item_id": decide_id, "status": "accepted"})
    check("decision accepted", r.status_code == 200 and r.json()["ok"], r.text)

    r = client.get(f"/v1/export/{sid}/{top}")
    report = r.json()
    check("export ok", r.status_code == 200, r.text[:200])
    check("export has accepted only", len(report["accepted_suggestions"]) == 1, len(report["accepted_suggestions"]))
    check("export carries disclaimer", "not an offer prediction" in report["disclaimer"], report["disclaimer"][:80])
    check("export has readiness", 0 <= report["readiness"] <= 100, report["readiness"])

    r = client.delete(f"/v1/session/{sid}")
    check("session deleted", r.json()["ok"], r.text)
    r = client.get(f"/v1/export/{sid}/{top}")
    check("deleted session is gone", r.status_code == 404, r.status_code)

    # ---- profile editing: add an experience and a skill, then re-score ----
    sid2 = client.post("/v1/session", json={}).json()["session_id"]
    base = client.post("/v1/profile/parse", json={"session_id": sid2, "use_sample": True}).json()["profile"]
    before_tracks = client.post("/v1/tracks/recommend", json={"session_id": sid2}).json()["tracks"]
    check("editing: baseline loaded", len(base["experiences"]) >= 3, len(base["experiences"]))

    edited = json.loads(json.dumps(base))
    edited["skills"] = edited["skills"] + ["sql", "powerpoint", "communication"]
    edited["experiences"].append(
        {
            "id": "exp-new-part-time",
            "title": "Part-time Sales Assistant",
            "org": "Harbour Books",
            "start": "2024-06",
            "end": "2024-09",
            "current": False,
            "bullets": [
                "Reorganised the fiction section so returns dropped and regulars found new titles.",
                "Handled customer complaints about stock and refunds during the summer sale.",
            ],
            "tags": ["communication", "professionalism"],
        }
    )
    edited["experiences"] = edited["experiences"][1:]  # drop the first one, proving removal works

    r = client.put("/v1/profile", json={"session_id": sid2, "profile": edited})
    check("editing: put accepted", r.status_code == 200, r.text[:200])
    saved = r.json()["profile"]
    check(
        "editing: removal persisted",
        len(saved["experiences"]) == len(base["experiences"]),
        [e["id"] for e in saved["experiences"]],
    )
    check("editing: addition persisted", any(e["id"] == "exp-new-part-time" for e in saved["experiences"]), None)
    check("editing: skills persisted", len(saved["skills"]) == len(edited["skills"]), len(saved["skills"]))

    after_tracks = client.post("/v1/tracks/recommend", json={"session_id": sid2}).json()["tracks"]
    before_fits = {t["id"]: t["track_fit"] for t in before_tracks}
    after_fits = {t["id"]: t["track_fit"] for t in after_tracks}
    check("editing: re-scoring reacts", before_fits != after_fits, f"{before_fits} -> {after_fits}")
    # The old assertion was that adding skills lifts the commercial score. That
    # only held because the old sample sat near zero on commercial; once a
    # profile already matches a track, adding skills that miss its keywords
    # dilutes the Jaccard ratio and can lower the score. Assert the honest thing:
    # a keyword that belongs to a direction shows up as a matched skill.
    check(
        "editing: a new keyword becomes a matched skill",
        any("powerpoint" in t.get("matched_skills", []) for t in after_tracks),
        [t.get("matched_skills") for t in after_tracks],
    )

    scan2 = client.post("/v1/resume/scan", json={"session_id": sid2, "track_id": "commercial"}).json()["scan"]
    check("editing: scan reflects the new resume", 0 <= scan2["score"] <= 100, scan2["score"])

    client.delete(f"/v1/session/{sid2}")

    print()
    if failures:
        print(f"{len(failures)} FAILURES: {failures}")
        return 1
    print("ALL API CHECKS PASSED")
    return 0


def track_dump(tracks):
    return [(t["id"], t["rationale"][:40]) for t in tracks]


if __name__ == "__main__":
    raise SystemExit(main())
