"""LLM adapter.

Only ever drafts text. Never returns a score. Identifiers are stripped before the
request and the caller keeps the original locally.

Enable by setting PATHFOLIO_FIXTURE_MODE=false and OPENAI_API_KEY. Optional
OPENAI_BASE_URL and OPENAI_MODEL.

Per-task control: `PATHFOLIO_LLM_TASKS` is a comma-separated list of task names.
Only the listed tasks call the model; everything else uses the offline fixtures.
An empty or unset value means fixtures only, except for `extract`, which keeps the
original single-task behaviour so an existing `.env` does not silently start
spending tokens on every route.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

PROMPTS = Path(__file__).resolve().parent / "prompts"

TASKS: tuple[str, ...] = ("extract", "suggest", "stories", "strategy", "tracks", "pick_tracks")

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE_RE = re.compile(r"(?:\+?852[-\s]?)?\d{4}[-\s]?\d{4}")
_URL_RE = re.compile(r"https?://\S+")
_NAME_LINE_RE = re.compile(r"^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}$", re.MULTILINE)
_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?%?")
_AT_ORG_RE = re.compile(r"\bat\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,3})")

# A profile may spell numbers out ("saving six hours per week") while the model
# writes digits ("6 percent"). Treat the two forms as the same fact, or every
# honest rewrite gets rejected.
_NUMBER_WORDS: dict[str, str] = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "twenty": "20", "thirty": "30",
    "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70",
    "eighty": "80", "ninety": "90", "hundred": "100", "half": "50",
}


def known_numbers(profile: dict[str, Any]) -> set[str]:
    """Every number the profile supports, in both digit and spelled-out form."""
    text = _known_text(profile).lower()
    numbers = set(_NUMBER_RE.findall(text))
    numbers |= {v for k, v in _NUMBER_WORDS.items() if re.search(rf"\b{k}\b", text)}
    # percentages stated as words ("forty percent") are covered by the word map
    return numbers


# ---------------------------------------------------------------- switches


def fixture_mode() -> bool:
    """Master off switch. True means never call a model."""
    return os.environ.get("PATHFOLIO_FIXTURE_MODE", "true").lower() != "false"


def enabled_tasks() -> set[str]:
    raw = (os.environ.get("PATHFOLIO_LLM_TASKS") or "").strip()
    if not raw:
        return set()
    return {t.strip().lower() for t in raw.split(",") if t.strip() in TASKS}


def task_enabled(task: str) -> bool:
    """A task runs the model only if the master switch is off, a key exists, and it is listed."""
    if fixture_mode():
        return False
    if not os.environ.get("OPENAI_API_KEY"):
        return False
    if not enabled_tasks():
        return task == "extract"
    return task in enabled_tasks()


def task_status() -> dict[str, str]:
    return {t: ("llm" if task_enabled(t) else "fixture") for t in TASKS}


# ---------------------------------------------------------------- redaction


def strip_identifiers(text: str) -> tuple[str, list[str]]:
    """Replace identifiers with placeholders. Returns (clean_text, stripped_kinds)."""
    stripped: list[str] = []
    out = text

    if _EMAIL_RE.search(out):
        out = _EMAIL_RE.sub("[EMAIL]", out)
        stripped.append("email")
    if _PHONE_RE.search(out):
        out = _PHONE_RE.sub("[PHONE]", out)
        stripped.append("phone")
    if _URL_RE.search(out):
        out = _URL_RE.sub("[LINK]", out)
        stripped.append("link")
    if _NAME_LINE_RE.search(out):
        out = _NAME_LINE_RE.sub("CANDIDATE", out, count=2)
        stripped.append("display_name")

    return out, stripped


def strip_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """A copy safe to send: no name, no contact details."""
    safe = {k: v for k, v in profile.items() if k not in ("contact", "display_name")}
    return json.loads(json.dumps(safe))


# ---------------------------------------------------------------- fact check


def _known_text(profile: dict[str, Any]) -> str:
    parts: list[str] = [
        str(profile.get("school") or ""),
        str(profile.get("degree") or ""),
        str(profile.get("field") or ""),
    ]
    parts.extend(str(s) for s in profile.get("skills") or [])
    for exp in profile.get("experiences") or []:
        parts.append(str(exp.get("title") or ""))
        parts.append(str(exp.get("org") or ""))
        parts.extend(str(b) for b in exp.get("bullets") or [])
    return " ".join(parts)


def _known_words(profile: dict[str, Any]) -> set[str]:
    words: set[str] = set()
    for exp in profile.get("experiences") or []:
        words.update(str(exp.get("org") or "").split())
        words.update(str(exp.get("title") or "").split())
    words.update(str(profile.get("school") or "").split())
    return {w.lower().strip(",.()") for w in words if w}


def check_grounded(
    text: str,
    profile: dict[str, Any],
    *,
    allow: set[str] | None = None,
) -> tuple[bool, list[str]]:
    """Is `text` supported by the profile?

    Two classes of fabrication matter in an interview and are flagged here: a
    number that appears nowhere in the profile, and an organisation introduced
    after "at". Track keywords may be passed in `allow` because naming the
    target role's tooling is legitimate — the user still confirms every line.
    """
    allow_lower = {a.lower() for a in (allow or set())}
    known_text = _known_text(profile)
    known_nums = known_numbers(profile)
    known_words = _known_words(profile)

    problems: list[str] = []

    for num in _NUMBER_RE.findall(text or ""):
        digits = num.rstrip("%")
        if num in known_nums or digits in known_nums or num.lower() in allow_lower:
            continue
        problems.append(f"new_number:{num}")

    for org in _AT_ORG_RE.findall(text or ""):
        head = org.split()[0].lower()
        if head in known_words:
            continue
        if head in allow_lower or org.lower() in known_text.lower():
            continue
        problems.append(f"new_org:{org}")

    return (not problems), problems


def check_story_grounded(story: dict[str, Any], profile: dict[str, Any]) -> tuple[bool, list[str]]:
    text = " ".join(str(story.get(k) or "") for k in ("situation", "task", "action", "result"))
    return check_grounded(text, profile)


# ---------------------------------------------------------------- model call


def _load_prompt(name: str) -> str:
    path = PROMPTS / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return f"You are the Pathfolio {name} helper. Return JSON only."


def _client():  # pragma: no cover - requires network
    from openai import OpenAI

    return OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.environ.get("OPENAI_BASE_URL") or None,
    )


def complete_json(system: str, user: str, retries: int = 3) -> dict[str, Any]:  # pragma: no cover
    """Chat completion forced to JSON. Raises RuntimeError if it never validates."""
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    client = _client()
    last_err: Exception | None = None

    for _ in range(retries):
        try:
            resp = client.chat.completions.create(
                model=model,
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            return json.loads(resp.choices[0].message.content or "{}")
        except Exception as exc:  # noqa: BLE001
            last_err = exc

    raise RuntimeError(f"LLM JSON failed after {retries} attempts: {last_err}")


# ---------------------------------------------------------------- task wrappers
#
# Each raises on failure. The API decides whether to fall back to fixtures so the
# policy lives in exactly one place (main.py).


def extract_profile(raw_text: str) -> dict[str, Any]:  # pragma: no cover
    clean, _ = strip_identifiers(raw_text)
    data = complete_json(_load_prompt("extract_profile"), clean)
    data["display_name"] = ""
    return data


def label_tracks(scored: list[dict[str, Any]]) -> dict[str, dict[str, str]]:  # pragma: no cover
    payload = [
        {
            "id": t["id"],
            "title": t["title"],
            "matched_skills": t["matched_skills"],
            "missing_skills": t["missing_skills"],
        }
        for t in scored
    ]
    data = complete_json(_load_prompt("label_tracks"), json.dumps(payload))
    return data.get("tracks", data)


def rewrite_bullets(profile: dict[str, Any], track: dict[str, Any]) -> list[dict[str, Any]]:  # pragma: no cover
    payload = {
        "track": {"id": track.get("id"), "keywords": track.get("keywords")},
        "experiences": strip_profile(profile).get("experiences", []),
    }
    data = complete_json(_load_prompt("rewrite_bullets"), json.dumps(payload))
    return data.get("suggestions", [])


def draft_star(experience: dict[str, Any], competency: str, track: dict[str, Any]) -> dict[str, Any]:  # pragma: no cover
    payload = {
        "experience": experience,
        "competency": competency,
        "track": {"id": track.get("id"), "keywords": track.get("keywords")},
    }
    return complete_json(_load_prompt("draft_star"), json.dumps(payload))


def draft_questions(profile: dict[str, Any], track: dict[str, Any], n: int = 8) -> list[dict[str, Any]]:  # pragma: no cover
    payload = {
        "track": {"id": track.get("id"), "keywords": track.get("keywords")},
        "skills": profile.get("skills", []),
        "experience_titles": [e.get("title") for e in profile.get("experiences", [])],
        "count": n,
    }
    data = complete_json(_load_prompt("draft_questions"), json.dumps(payload))
    return data.get("questions", [])


def pick_tracks(
    profile: dict[str, Any],
    candidates: list[dict[str, Any]],
    count: int = 3,
) -> dict[str, Any]:  # pragma: no cover
    """Choose which of the already-scored candidates to show the graduate.

    The model never sees a scoring formula and never returns a score: the
    numbers are computed in main.py before this call, and the shortlist it
    receives is already ordered. Its only job is to pick `count` ids and say why
    in the graduate's own terms.
    """
    payload = {
        "profile": {
            "degree": profile.get("degree"),
            "field": profile.get("field"),
            "skills": profile.get("skills"),
            "experiences": [
                {"title": e.get("title"), "org": e.get("org"), "bullets": e.get("bullets")}
                for e in (strip_profile(profile).get("experiences") or [])
            ],
        },
        "candidates": [
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "track_fit": c.get("track_fit"),
                "matched_skills": c.get("matched_skills"),
                "missing_skills": c.get("missing_skills"),
            }
            for c in candidates
        ],
        "count": count,
    }
    return complete_json(_load_prompt("pick_tracks"), json.dumps(payload))
