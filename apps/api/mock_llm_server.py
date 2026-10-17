"""A fake OpenAI-compatible endpoint, so the LLM path can be tested without a key.

It answers POST /chat/completions with a canned JSON body chosen from the system
prompt. Every request it receives is appended to a log file so tests can assert
that no identifier ever left the process.

Run: python3 apps/api/mock_llm_server.py --port 8010 --log /tmp/mock_llm.log
"""

from __future__ import annotations

import argparse
import json
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG_PATH = "/tmp/mock_llm.log"

# A rewrite that stays inside the profile's facts.
GOOD_AFTER = (
    "Built the weekly dashboard three product squads used to review activation, and walked "
    "stakeholders through the cohort split in a repeatable Monday review."
)
# A rewrite that invents a metric — the fact-check must reject this one.
BAD_AFTER = "Automated the rebuild in Python, cutting it by 37 percent across five squads."

# The exact bullets they rewrite, so the route can match them to the profile.
BULLET_DASHBOARD = (
    "Built the weekly dashboard three product squads used to review activation, and walked "
    "stakeholders through the cohort split every Monday."
)
BULLET_AUTOMATION = "Automated the rebuild in Python, cutting it from six hours a week to a scheduled run."


def _answer(system: str, user: str) -> dict | str:
    s = system.lower()

    if "extract a graduate profile" in s or "extract_profile" in s:
        return {
            "id": "mock-profile",
            "display_name": "",
            "school": "City University of Hong Kong",
            "degree": "BBA",
            "field": "Business Analysis",
            "grad_year": 2026,
            "location_preference": ["Hong Kong"],
            "skills": ["excel", "sql", "python"],
            "languages": ["English"],
            "experiences": [
                {
                    "id": "exp-helix",
                    "title": "Data Intern",
                    "org": "Helix Studio",
                    "start": "2025-05",
                    "end": None,
                    "current": True,
                    "bullets": ["Built weekly dashboards tracking activation and retention for three product squads."],
                    "tags": ["analytics"],
                }
            ],
            "education": [{"school": "City University of Hong Kong", "degree": "BBA", "field": "Business Analysis", "end_year": 2026}],
        }

    if "write english copy for tracks" in s or "label_tracks" in s:
        return {
            "tracks": {
                "analytics": {
                    "rationale": "Your SQL and dashboard work is the reporting an analyst graduate is hired to do.",
                    "positioning": "CityU business-analysis graduate who has shipped weekly reporting three squads used.",
                },
                "product_ops": {
                    "rationale": "You coordinated a committee and a cross-faculty partnership.",
                    "positioning": "CityU graduate who turns messy requests into a sequence a team can run.",
                },
                "commercial": {
                    "rationale": "You grew membership through partnerships.",
                    "positioning": "CityU business graduate who can present numbers to a non-technical room.",
                },
            }
        }

    if "you choose which three career tracks" in s or "pick_tracks" in s:
        # Take the first two candidates and the last one, so the test proves the
        # model's choice is what ships and that it can differ from the local
        # ranking. The `why` deliberately contains no number and no "at <Org>",
        # so it passes the fact-check.
        try:
            payload = json.loads(user)
            ids = [c.get("id") for c in (payload.get("candidates") or []) if c.get("id")]
        except Exception:
            ids = []
        picks = [
            {"id": tid, "why": "The skills and bullets this profile already lists point at this kind of work."}
            for tid in (ids[:2] + ids[-1:])
        ]
        return {"picks": picks}

    if "rewrite resume bullets" in s or "rewrite_bullets" in s:
        return {
            "suggestions": [
                {
                    "experience_id": "exp-helix",
                    "before": BULLET_DASHBOARD,
                    "after": GOOD_AFTER,
                    "reason": "States the scope and what the number changed.",
                },
                {
                    "experience_id": "exp-helix",
                    "before": BULLET_AUTOMATION,
                    "after": BAD_AFTER,
                    "reason": "INVENTED METRIC — must be rejected.",
                },
            ]
        }

    if "fill situation, task, action, result" in s or "draft_star" in s:
        return {
            "situation": "At Helix Studio last year the squad could not agree why week-two retention dropped.",
            "task": "I was asked to find a cause the product lead could act on within one week.",
            "action": (
                "I pulled the trial cohorts in SQL, split them by first-session behaviour, checked the split "
                "against two earlier months, built one chart of the churn split, wrote the query so the squad "
                "could rerun it every Monday, and walked the product lead through two options."
            ),
            "result": "The team took the simpler onboarding fix and retention recovered about 6 percent.",
        }

    if "propose 8-12 interview questions" in s or "draft_questions" in s:
        # Deliberately returns only three: too few, so the route must keep the fixture set.
        return {
            "questions": [
                {"id": "q-mock-1", "text": "Walk me through a time messy data changed a decision.", "kind": "behavioural", "competency": "critical_thinking", "why_asked": "Analyst work happens in incomplete data."},
                {"id": "q-mock-2", "text": "How would you explain a retention drop to a marketing lead?", "kind": "technical", "competency": "communication", "why_asked": "Analysts are judged on whether the room acts."},
                {"id": "q-mock-3", "text": "Describe a dashboard you built and who used it.", "kind": "behavioural", "competency": "technology", "why_asked": "Separates shipping from studying."},
            ]
        }

    return {"note": "unrecognised system prompt", "echo": user[:120]}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8", "replace")
        with open(LOG_PATH, "a") as fh:
            fh.write(raw + "\n")

        try:
            body = json.loads(raw)
            messages = body.get("messages") or []
            system = next((m.get("content", "") for m in messages if m.get("role") == "system"), "")
            user = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")
        except Exception:
            system, user = "", ""

        answer = _answer(system, user)

        # One endpoint, one deliberately invalid JSON reply, to prove the retry path.
        if re.search(r"\bFAIL_JSON\b", user):
            content = "this is not json {"
        else:
            content = json.dumps(answer)

        payload = {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.get("model", "mock-model") if isinstance(body, dict) else "mock-model",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
        }
        out = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *args):  # keep the console quiet
        pass


def main() -> None:
    global LOG_PATH

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8010)
    ap.add_argument("--log", default=LOG_PATH)
    args = ap.parse_args()

    LOG_PATH = args.log
    HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
