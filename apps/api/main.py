"""Pathfolio API. FastAPI app.

Design rule: scoring is local and deterministic. The LLM drafts text only, and if
it is unavailable or unconfigured the API falls back to data/samples fixtures so
the demo never dies.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages"))

from scoring import (  # noqa: E402
    ALL_COMPETENCIES,
    SEVEN,
    interview_readiness,
    plan_seven,
    resume_scan,
    score_track,
    star_score,
    story_coverage,
)

DATA = ROOT / "data"
SAMPLES = DATA / "samples"
TRACKS = DATA / "tracks"

FIXTURE_MODE = os.environ.get("PATHFOLIO_FIXTURE_MODE", "true").lower() != "false"
FIXTURES = json.loads((SAMPLES / "fixtures_llm.json").read_text(encoding="utf-8"))

app = FastAPI(title="Pathfolio API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5180",
        "http://127.0.0.1:5180",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, dict[str, Any]] = {}
# Why the last LLM attempt for a task fell back. Surfaced by /healthz so a silent
# fixture mode is diagnosable instead of mysterious.
LAST_LLM_ERRORS: dict[str, str] = {}


@app.middleware("http")
async def _llm_credentials(request: Request, call_next):
    """Let the browser bring its own model credentials for this one request.

    The key arrives in a header, lives in a ContextVar for the duration of the
    request only, and is never logged or written to the session.
    """
    try:
        from llm import set_request_config

        key = (request.headers.get("x-llm-key") or "").strip()
        set_request_config(
            {
                "key": key,
                "base": (request.headers.get("x-llm-base") or "").strip(),
                "model": (request.headers.get("x-llm-model") or "").strip(),
            }
            if key
            else None
        )
    except Exception:
        pass
    return await call_next(request)


# ---------------------------------------------------------------- models


class SessionCreate(BaseModel):
    pass


class ParseRequest(BaseModel):
    session_id: str
    raw_text: str = ""
    # True loads the default sample; a string loads data/samples/<name>.json.
    use_sample: bool | str = False


class Experience(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    org: str = ""
    start: str = ""
    end: str | None = None
    current: bool = False
    bullets: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class Education(BaseModel):
    school: str = ""
    degree: str = ""
    field: str = ""
    end_year: int | None = None


class Profile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    display_name: str = ""
    school: str = ""
    degree: str = ""
    field: str = ""
    grad_year: int | None = None
    location_preference: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    experiences: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    session_id: str
    profile: Profile


class TrackRequest(BaseModel):
    session_id: str


class SuggestRequest(BaseModel):
    session_id: str
    track_id: str


class StoryRequest(BaseModel):
    session_id: str
    track_id: str


class StoryScoreRequest(BaseModel):
    story: dict[str, Any]


class DecisionRequest(BaseModel):
    session_id: str
    item_id: str
    status: str  # accepted | dismissed | pending
    user_text: str | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path) -> Any:
    # Explicit encoding: on Windows the default is the ANSI code page (GBK here),
    # which cannot read the UTF-8 data files.
    return json.loads(path.read_text(encoding="utf-8"))


def _session(session_id: str) -> dict[str, Any]:
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail={"code": "session_not_found", "message": "Unknown session."})
    return SESSIONS[session_id]


_TRACK_META_FILES = {"wef_rising.json", "aliases.json"}

# The offline draft set in fixtures_llm.json was written for this one sample.
DEFAULT_SAMPLE = "cityu_graduate"
_SAMPLE_META_FILES = {"fixtures_llm.json", "scoring_cases.json"}

# How many scored tracks go to the model as a shortlist, and how many are shown.
SHORTLIST_SIZE = 5
SHOW_TRACKS = 3


def _all_tracks() -> list[dict[str, Any]]:
    """Every track definition in data/tracks/.

    Drop a new json in that directory and it joins the scoring run — no code
    change. Files that are reference data rather than tracks are skipped.
    """
    out: list[dict[str, Any]] = []
    for path in sorted(TRACKS.glob("*.json")):
        if path.name in _TRACK_META_FILES:
            continue
        data = _load_json(path)
        if isinstance(data, dict) and data.get("id") and data.get("keywords"):
            out.append(data)
    return out


def _track_config(track_id: str) -> dict[str, Any]:
    """Load a track definition, 404 for anything outside the library.

    Validating against the library instead of just checking the file exists also
    stops a track_id like '../../api/main' from escaping data/tracks/.
    """
    for track in _all_tracks():
        if track.get("id") == track_id:
            return track
    raise HTTPException(
        status_code=404,
        detail={"code": "unknown_track", "message": f"No career track named '{track_id}'."},
    )


def _sample_files() -> list[Path]:
    return sorted(p for p in SAMPLES.glob("*.json") if p.name not in _SAMPLE_META_FILES)


def _sample_id(value: bool | str) -> str | None:
    """Resolve a `use_sample` value to a sample name, or None when unknown."""
    if value is True:
        return DEFAULT_SAMPLE
    name = str(value).strip()
    if not name or name.lower() in ("true", "1", "yes"):
        return DEFAULT_SAMPLE
    path = SAMPLES / (name if name.endswith(".json") else f"{name}.json")
    if path.exists() and path.name not in _SAMPLE_META_FILES:
        return path.stem
    return None


def _rising() -> dict[str, list[str]]:
    return _load_json(TRACKS / "wef_rising.json")


def _aliases() -> dict[str, str]:
    return _load_json(TRACKS / "aliases.json")


# ---------------------------------------------------------------- routes


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "fixture_mode": FIXTURE_MODE,
        "llm_enabled": (not FIXTURE_MODE) and bool(os.environ.get("OPENAI_API_KEY")),
        "llm_tasks": _llm_task_status(),
        "llm_last_errors": dict(LAST_LLM_ERRORS),
        "sessions": len(SESSIONS),
    }


@app.post("/v1/session")
def create_session(_: SessionCreate | None = None) -> dict[str, str]:
    sid = str(uuid.uuid4())
    SESSIONS[sid] = {"id": sid, "created_at": _now(), "profile": None, "sample_id": None, "tracks": {}, "suggestions": {}, "stories": {}, "strategies": {}, "decisions": {}}
    return {"session_id": sid}


@app.get("/v1/samples")
def list_samples() -> dict[str, Any]:
    """The sample profiles on disk, so the UI can offer all of them."""
    out: list[dict[str, Any]] = []
    for path in _sample_files():
        data = _load_json(path)
        out.append(
            {
                "id": path.stem,
                "display_name": data.get("display_name") or path.stem,
                "school": data.get("school") or "",
                "degree": data.get("degree") or "",
                "field": data.get("field") or "",
                "experiences": len(data.get("experiences") or []),
                "skills": len(data.get("skills") or []),
                # Offline rewrites and STAR drafts were written for the default sample.
                "has_offline_draft": path.stem == DEFAULT_SAMPLE,
            }
        )
    return {"samples": out, "default": DEFAULT_SAMPLE}


@app.post("/v1/profile/parse")
def parse_profile(req: ParseRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    drafted_by = "sample" if req.use_sample else "fixture"
    sample: str | None = None
    if req.use_sample:
        sample = _sample_id(req.use_sample)
        if sample is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "sample_not_found", "message": f"No sample profile named {req.use_sample}."},
            )
        profile = _load_json(SAMPLES / f"{sample}.json")
    elif _llm_on("extract"):
        try:
            from llm import extract_profile  # imported lazily; optional dependency

            profile = extract_profile(req.raw_text)
            drafted_by = "llm"
        except Exception as exc:  # noqa: BLE001
            _note_llm_failure("extract", exc)
            profile = _fixture_profile()
    else:
        profile = _fixture_profile()
    session["profile"] = profile
    session["sample_id"] = sample
    return {
        "profile": profile,
        "stripped_fields": ["display_name", "email", "phone"],
        "drafted_by": drafted_by,
        "sample_id": sample,
    }


@app.put("/v1/profile")
def update_profile(req: ProfileUpdate) -> dict[str, Any]:
    session = _session(req.session_id)
    session["profile"] = req.profile.model_dump()
    session["sample_id"] = None  # edited by hand: the offline draft set no longer applies
    session["tracks"] = {}
    return {"profile": session["profile"]}


@app.post("/v1/tracks/recommend")
def recommend_tracks(req: TrackRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    profile = session.get("profile")
    if not profile:
        raise HTTPException(status_code=400, detail={"code": "no_profile", "message": "Parse or load a profile first."})

    rising, aliases = _rising(), _aliases()
    scored: list[dict[str, Any]] = []
    for track in _all_tracks():
        item = score_track(profile, track, rising, aliases)
        scan = resume_scan(profile, track)
        stories = session.get("stories", {}).get(track["id"], [])
        item["resume_scan"] = scan["score"]
        item["interview_readiness"] = interview_readiness(item["track_fit"], scan["score"], stories)
        item["rationale"], item["positioning"] = _track_copy(track["id"], item)
        scored.append(item)

    # Three of the four components are direction-blind: NACE coverage, WEF
    # alignment and most of evidence transfer describe the profile, not the
    # direction — so a direction with zero overlap still collects a base score
    # and can outrank a relevant one. Order by "touches something you actually
    # have" first, then score, then matched skills, then id, so a tie never
    # depends on directory order. The fallback keeps three rows for a profile
    # that is thin enough to have fewer than three relevant directions.
    def _relevant(item: dict[str, Any]) -> bool:
        return bool(item.get("matched_skills")) or float((item.get("components") or {}).get("evidence_transfer") or 0) > 0

    relevant = [t for t in scored if _relevant(t)]
    pool = relevant if len(relevant) >= SHOW_TRACKS else scored
    pool.sort(key=lambda t: (-float(t["track_fit"]), -len(t.get("matched_skills") or []), str(t["id"])))
    considered = len(scored)
    shortlist = pool[:SHORTLIST_SIZE]

    # Local default: the three best-scoring tracks. Deterministic, and it is what
    # runs with no key at all. The model may re-pick from this shortlist below,
    # but it never sees a formula and never returns a number.
    picked = shortlist[:SHOW_TRACKS]
    picked_by = "ranking"
    pick_notes: dict[str, str] = {}

    if _llm_on("pick_tracks") and len(shortlist) > SHOW_TRACKS:
        try:
            from llm import pick_tracks

            allowed = {t["id"]: t for t in shortlist}
            ids: list[str] = []
            for entry in (pick_tracks(profile, shortlist) or {}).get("picks") or []:
                tid = str((entry or {}).get("id") or "").strip()
                if tid not in allowed or tid in ids:
                    continue
                ids.append(tid)
                why = str((entry or {}).get("why") or "").strip()
                ok, _ = check_grounded(why, profile) if why else (True, [])
                if why and ok:
                    pick_notes[tid] = why
            if len(ids) == SHOW_TRACKS:
                picked = [allowed[tid] for tid in ids]
                picked_by = "llm"
            else:
                _note_llm_failure("pick_tracks", RuntimeError(f"needed {SHOW_TRACKS} ids, got {ids}"))
        except Exception as exc:  # noqa: BLE001
            _note_llm_failure("pick_tracks", exc)
            picked = shortlist[:SHOW_TRACKS]
            picked_by = "ranking"

    for item in picked:
        if item["id"] in pick_notes:
            item["picked_why"] = pick_notes[item["id"]]

    drafted_by = "fixture"

    if _llm_on("tracks"):
        try:
            from llm import label_tracks

            labels = label_tracks(picked) or {}
            hits = 0
            for item in picked:
                got = labels.get(item["id"]) or {}
                rationale, positioning = str(got.get("rationale") or "").strip(), str(got.get("positioning") or "").strip()
                if not rationale and not positioning:
                    continue
                ok_r, _ = check_grounded(rationale, profile) if rationale else (True, [])
                ok_p, _ = check_grounded(positioning, profile) if positioning else (True, [])
                if rationale and ok_r:
                    item["rationale"] = rationale
                if positioning and ok_p:
                    item["positioning"] = positioning
                hits += 1
            if hits:
                drafted_by = "llm"
        except Exception as exc:  # noqa: BLE001
            _note_llm_failure("tracks", exc)
            drafted_by = "fixture"

    session["tracks"] = {t["id"]: t for t in picked}
    return {
        "tracks": picked,
        "drafted_by": drafted_by,
        "picked_by": picked_by,
        "considered": considered,
        "shortlist": [t["id"] for t in shortlist],
    }


@app.post("/v1/resume/scan")
def resume_scan_route(req: SuggestRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    track = _track_for(session, req.track_id)
    return {"scan": resume_scan(session["profile"], _track_config(req.track_id), _scan_flags(session))}


@app.post("/v1/resume/suggest")
def suggest_bullets(req: SuggestRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    profile = session["profile"]
    track = _track_config(req.track_id)

    # The offline draft set was written against one specific sample. Showing it for
    # any other profile would mean rewriting sentences the person never wrote, so
    # it is scoped to that sample; everything else needs the model.
    offline = FIXTURES["suggestions"].get(req.track_id, {}) if session.get("sample_id") == DEFAULT_SAMPLE else {}

    # One candidate per real bullet. The rewrite is filled in by the offline set
    # or by the model; a bullet that neither touches is left out rather than shown
    # as an empty suggestion.
    entries: list[dict[str, Any]] = []
    for exp in profile.get("experiences", []):
        for idx, bullet in enumerate(exp.get("bullets", [])):
            if not str(bullet).strip():
                continue
            spec = offline.get(f"{exp['id']}:{idx}") or {}
            entries.append(
                {
                    "id": f"sug-{exp['id']}-{idx}",
                    "experience_id": exp["id"],
                    "before": bullet,
                    "after": str(spec.get("after") or ""),
                    "reason": str(spec.get("reason") or ""),
                    "status": "pending",
                    "grounded_in": spec.get("grounded_in", []),
                    "drafted_by": "fixture",
                    "insufficient_evidence": False,
                }
            )

    drafted_by = "fixture"
    if _llm_on("suggest"):
        try:
            from llm import check_grounded, rewrite_bullets

            allow = set(track.get("keywords") or [])
            by_before = {str(e["before"]).strip(): e for e in entries}
            merged = 0
            for cand in rewrite_bullets(profile, track) or []:
                target = by_before.get(str(cand.get("before") or "").strip())
                if target is None:
                    continue
                after = str(cand.get("after") or "").strip()
                if not after:
                    continue
                ok, problems = check_grounded(after, profile, allow=allow)
                if ok:
                    target["after"] = after
                    target["reason"] = str(cand.get("reason") or target["reason"])
                    target["drafted_by"] = "llm"
                    merged += 1
                else:
                    # The model tried and invented something. Keep whatever the
                    # offline set had (it may be nothing) and mark the row so the
                    # UI can say why that draft was refused.
                    target["insufficient_evidence"] = True
                    target["grounding_problems"] = problems
            if merged:
                drafted_by = "llm"
        except Exception as exc:  # noqa: BLE001
            _note_llm_failure("suggest", exc)
            drafted_by = "fixture"

    suggestions = [e for e in entries if e["after"]]
    session["suggestions"][req.track_id] = suggestions
    return {
        "suggestions": suggestions,
        "track_id": req.track_id,
        "drafted_by": drafted_by,
        "offline_draft_available": bool(offline),
    }


@app.post("/v1/stories/generate")
def generate_stories(req: StoryRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    profile = session.get("profile") or {}
    track = _track_config(req.track_id)

    # The offline STAR drafts belong to the default sample. Any other profile gets
    # empty skeletons built from this direction's own prompts, so the model has
    # something to fill — and with no model there is simply nothing to show rather
    # than somebody else's experiences.
    offline = session.get("sample_id") == DEFAULT_SAMPLE
    if offline:
        raw_stories = FIXTURES["stories"].get(req.track_id, [])
    elif _llm_on("stories"):
        raw_stories = [
            {
                "id": f"{req.track_id}-{i}",
                "competency": SEVEN[i % len(SEVEN)],
                "prompt": prompt,
                "situation": "",
                "task": "",
                "action": "",
                "result": "",
            }
            for i, prompt in enumerate(track.get("star_prompts") or [])
        ]
    else:
        raw_stories = []

    drafted_by = "fixture"
    if _llm_on("stories"):
        try:
            from llm import check_story_grounded, draft_star

            allow = set(track.get("keywords") or [])
            exp_by_id = {e["id"]: e for e in profile.get("experiences", [])}
            llm_stories: list[dict[str, Any]] = []
            for i, raw in enumerate(raw_stories):
                exp = exp_by_id.get(raw.get("experience_id")) or (profile.get("experiences") or [{}])[i % max(1, len(profile.get("experiences") or [{}]))]
                got = draft_star(exp, raw.get("competency", "communication"), track) or {}
                candidate = {
                    "id": raw.get("id"),
                    "competency": raw.get("competency"),
                    "prompt": raw.get("prompt"),
                    "situation": str(got.get("situation") or ""),
                    "task": str(got.get("task") or ""),
                    "action": str(got.get("action") or ""),
                    "result": str(got.get("result") or ""),
                }
                ok, problems = check_story_grounded(candidate, profile)
                if ok and candidate["action"]:
                    candidate["drafted_by"] = "llm"
                    candidate["insufficient_evidence"] = False
                    llm_stories.append(candidate)
                else:
                    fixture = dict(raw)
                    fixture["drafted_by"] = "fixture"
                    fixture["insufficient_evidence"] = bool(problems)
                    fixture["grounding_problems"] = problems
                    llm_stories.append(fixture)
            if any(s.get("drafted_by") == "llm" for s in llm_stories):
                raw_stories = llm_stories
                drafted_by = "llm"
            elif llm_stories:
                # nothing survived the fact-check: keep the drafts but say so
                raw_stories = llm_stories
        except Exception as exc:  # noqa: BLE001
            _note_llm_failure("stories", exc)
            drafted_by = "fixture"

    out: list[dict[str, Any]] = []
    for raw in raw_stories:
        story = dict(raw)
        story["track_id"] = req.track_id
        story.update(star_score(story))
        story["status"] = "pending"
        story.setdefault("drafted_by", "fixture")
        out.append(story)
    session["stories"][req.track_id] = out
    return {
        "stories": out,
        "track_id": req.track_id,
        "drafted_by": drafted_by,
        "offline_draft_available": offline,
    }


@app.post("/v1/stories/score")
def score_story(req: StoryScoreRequest) -> dict[str, Any]:
    return star_score(req.story)


@app.post("/v1/strategy")
def strategy(req: StoryRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    profile = session.get("profile") or {}
    track = _track_config(req.track_id)
    scan = resume_scan(profile, track, _scan_flags(session))
    stories = session.get("stories", {}).get(req.track_id, [])
    # Only the three original directions have a hand-written question bank. Every
    # track definition carries its own `star_prompts`, so build a small set from
    # those when there is no bank rather than showing an empty list.
    questions = FIXTURES["questions"].get(req.track_id) or _questions_from_prompts(track)
    drafted_by = "fixture"

    if _llm_on("strategy"):
        try:
            from llm import check_grounded, draft_questions

            got = draft_questions(profile, track, 8) or []
            cleaned: list[dict[str, Any]] = []
            for i, q in enumerate(got[:12]):
                text = str(q.get("text") or "").strip()
                if not text:
                    continue
                ok, _ = check_grounded(text + " " + str(q.get("why_asked") or ""), profile)
                if not ok:
                    continue
                cleaned.append(
                    {
                        "id": str(q.get("id") or f"q-llm-{i}"),
                        "text": text,
                        "kind": str(q.get("kind") or "behavioural"),
                        "competency": str(q.get("competency") or "communication"),
                        "why_asked": str(q.get("why_asked") or ""),
                        "drafted_by": "llm",
                    }
                )
            if len(cleaned) >= 8:
                questions = cleaned
                drafted_by = "llm"
        except Exception as exc:  # noqa: BLE001
            _note_llm_failure("strategy", exc)
            drafted_by = "fixture"

    return {
        "track_id": req.track_id,
        "questions": questions,
        "plan7": plan_seven(scan, stories),
        "scan": scan,
        "drafted_by": drafted_by,
    }


@app.post("/v1/decision")
def decide(req: DecisionRequest) -> dict[str, Any]:
    session = _session(req.session_id)
    if req.status not in ("accepted", "dismissed", "pending", "edited"):
        raise HTTPException(status_code=400, detail={"code": "bad_status", "message": "Unsupported status."})
    session["decisions"][req.item_id] = {"status": req.status, "user_text": req.user_text, "at": _now()}
    for buckets in (session["suggestions"], session["stories"]):
        for items in buckets.values():
            for item in items:
                if item.get("id") == req.item_id or f"sug-{item.get('id')}" == req.item_id:
                    item["status"] = req.status
                    if req.user_text:
                        item["user_text"] = req.user_text
    return {"ok": True, "decisions": len(session["decisions"])}


@app.get("/v1/export/{session_id}/{track_id}")
def export_report(session_id: str, track_id: str) -> dict[str, Any]:
    session = _session(session_id)
    profile = session.get("profile") or {}
    track_cfg = _track_config(track_id)
    scored = session.get("tracks", {}).get(track_id) or score_track(profile, track_cfg, _rising(), _aliases())
    scan = resume_scan(profile, track_cfg, _scan_flags(session))

    accepted = [
        s for s in session.get("suggestions", {}).get(track_id, []) if s.get("status") in ("accepted", "edited")
    ]
    stories = [
        s for s in session.get("stories", {}).get(track_id, []) if s.get("status") in ("accepted", "edited")
    ]
    return {
        "generated_at": _now(),
        "profile": {k: v for k, v in profile.items() if k != "contact"},
        "track": scored,
        "scan": scan,
        "accepted_suggestions": accepted,
        "accepted_stories": stories,
        "questions": FIXTURES["questions"].get(track_id, []),
        "plan7": plan_seven(scan, stories),
        "readiness": interview_readiness(scored.get("track_fit", 0), scan["score"], stories),
        "story_coverage": story_coverage(stories),
        "disclaimer": FIXTURES["disclaimer"],
        "pending_only_note": "Only accepted suggestions and stories are exported.",
    }


@app.delete("/v1/session/{session_id}")
def delete_session(session_id: str) -> dict[str, bool]:
    SESSIONS.pop(session_id, None)
    return {"ok": True}


# ---------------------------------------------------------------- helpers


def _note_llm_failure(task: str, exc: Exception) -> None:
    """Record why a drafting task fell back, so a silent fixture is diagnosable."""
    try:
        import traceback

        detail = f"{type(exc).__name__}: {exc}"
        LAST_LLM_ERRORS[task] = detail[-300:]
        print(f"[pathfolio] llm task '{task}' fell back to fixtures -> {detail}", flush=True)
        traceback.print_exc()
    except Exception:
        pass


def _llm_task_status() -> dict[str, str]:
    """Which drafting tasks would call the model right now (llm) vs the fixtures."""
    try:
        from llm import task_status

        return task_status()
    except Exception:
        return {t: "fixture" for t in ("extract", "suggest", "stories", "strategy", "tracks")}


def _llm_on(task: str) -> bool:
    """Should this task call the model? False on any doubt, so the demo never depends on it."""
    try:
        from llm import task_enabled

        return task_enabled(task)
    except Exception:
        return False


def check_grounded(text: str, profile: dict[str, Any], allow: set[str] | None = None) -> tuple[bool, list[str]]:
    """Thin wrapper so routes can fact-check without importing llm.py at module load."""
    try:
        from llm import check_grounded as _cg

        return _cg(text, profile, allow=allow)
    except Exception:
        return True, []


def _fixture_profile() -> dict[str, Any]:
    return _load_json(SAMPLES / "cityu_graduate.json")


def _track_for(session: dict[str, Any], track_id: str) -> dict[str, Any]:
    if not session.get("tracks"):
        recommend_tracks(TrackRequest(session_id=session["id"]))
    if track_id not in session["tracks"]:
        raise HTTPException(status_code=404, detail={"code": "track_not_found", "message": "Unknown track."})
    return session["tracks"][track_id]


def _scan_flags(session: dict[str, Any]) -> dict[str, Any]:
    profile = session.get("profile") or {}
    return {
        "name_present": bool(profile.get("display_name")),
        "has_section_headers": True,
        "has_photo": False,
    }


def _questions_from_prompts(track: dict[str, Any]) -> list[dict[str, Any]]:
    """A usable question set for a direction that has no written bank.

    Every track definition carries `star_prompts`; turning those into questions
    keeps the workspace populated for directions added after the fixtures were
    written, and it never claims more than the direction itself declares.
    """
    prompts = [str(p).strip() for p in (track.get("star_prompts") or []) if str(p).strip()]
    out: list[dict[str, Any]] = []
    for i, prompt in enumerate(prompts):
        text = prompt if prompt.endswith("?") else f"Tell me about {prompt}."
        out.append(
            {
                "id": f"{track.get('id')}-q{i + 1}",
                "text": text[0].upper() + text[1:],
                "kind": "behavioural",
                "competency": SEVEN[i % len(SEVEN)],
                "why_asked": "Drawn from the situations this direction screens for.",
                "drafted_by": "fixture",
            }
        )
    return out


def _track_copy(track_id: str, item: dict[str, Any]) -> tuple[str, str]:
    """Fixture copy for the three original tracks, a neutral fallback for the rest.

    Tracks added after the fixtures were written have no hand-written line, and
    that is fine: the fallback only reports what matched, so it cannot claim
    anything the profile does not support.
    """
    copy = FIXTURES.get("track_copy", {}).get(track_id, {})
    matched = ", ".join(item.get("matched_skills", [])[:3]) or "your campus evidence"
    rationale = (copy.get("rationale") or "{matched} are the signals this track screens for.").replace("{matched}", matched)
    positioning = copy.get("positioning") or ""
    if not positioning:
        n = len(item.get("matched_skills") or [])
        positioning = f"{n} matching signal{'s' if n != 1 else ''} already in the profile, with the gaps listed below."
    return rationale, positioning


# ---------------------------------------------------------------- static web
#
# Set PATHFOLIO_WEB_DIST to a built frontend and this process also serves the UI,
# so a deployment needs one service on one port. Registered last on purpose: every
# /v1 route above wins, and this only catches what is left (including client-side
# routes, which fall back to index.html).

_web_dist = os.environ.get("PATHFOLIO_WEB_DIST")

if _web_dist and Path(_web_dist).is_dir():
    _dist = Path(_web_dist)
    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> Any:
        candidate = (_dist / full_path).resolve()
        if full_path and candidate.is_file() and str(candidate).startswith(str(_dist.resolve())):
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
