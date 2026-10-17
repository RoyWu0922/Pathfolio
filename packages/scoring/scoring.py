"""Pathfolio scoring engine.

Pure Python. No network, no LLM. Every number shown in the UI is computed here.
Formulas and citations: docs/QUANT_MODELS.md
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Mapping, Sequence

# ---------------------------------------------------------------- constants

# NACE defines eight career-readiness competencies. Equity & Inclusion is kept
# out of the numeric score because NACE currently flags it as under legal
# review; it may still be used to tag a story.
SEVEN: tuple[str, ...] = (
    "career_self_development",
    "communication",
    "critical_thinking",
    "leadership",
    "professionalism",
    "teamwork",
    "technology",
)

ALL_COMPETENCIES: tuple[str, ...] = SEVEN + ("equity_inclusion",)

STAR_CAPS: tuple[str, ...] = ("action_share", "no_first_person", "no_result")

WEIGHTS: dict[str, float] = {
    "skill_overlap": 0.40,
    "nace_coverage": 0.30,
    "evidence_transfer": 0.20,
    "wef_align": 0.10,
}

READINESS_WEIGHTS: dict[str, float] = {
    "star": 0.35,
    "track_fit": 0.25,
    "resume_scan": 0.20,
    "story_coverage": 0.20,
}

RESUME_SIX_POINT_KEYS: tuple[str, ...] = (
    "name",
    "title",
    "org",
    "dates",
    "previous",
    "education",
)

_ACTION_VERBS = frozenset(
    """
    built build ran run led lead created create designed design wrote write
    analysed analyzed analysis automated developed develop coordinated
    coordinate organised organized managed manage presented present
    researched research trimmed trimmed launched launch improved improve
    reduced reduce increased increase grew grow saved save documented
    document tested test shipped ship migrated migrate trained train
    negotiated negotiate recruited recruit fixed fix
    """.split()
)

_RESULT_CUES = frozenset(
    "increased decreased saved reduced grew growth improved raised cut dropped".split()
)

_TOKEN_RE = re.compile(r"[a-z0-9+#]+")


# ---------------------------------------------------------------- helpers


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall((text or "").lower())


def _word_count(text: str) -> int:
    return len(tokenize(text))


def _alias_map(aliases: Mapping[str, str] | None) -> dict[str, str]:
    return {k.lower(): v.lower() for k, v in (aliases or {}).items()}


def normalize_skills(skills: Iterable[str], aliases: Mapping[str, str] | None = None) -> set[str]:
    amap = _alias_map(aliases)
    out: set[str] = set()
    for raw in skills:
        s = (raw or "").strip().lower()
        if not s:
            continue
        out.add(amap.get(s, s))
    return out


def _experience_text(exp: Mapping[str, Any]) -> str:
    parts = [str(exp.get("title") or ""), str(exp.get("org") or "")]
    parts.extend(str(b) for b in (exp.get("bullets") or []))
    parts.extend(str(t) for t in (exp.get("tags") or []))
    return " ".join(parts).lower()


_KW_RE_CACHE: dict[str, re.Pattern[str]] = {}


def keyword_hit(text: str, keyword: str) -> bool:
    """Whole-token match for a track keyword.

    Plain substring matching is wrong here and it was quietly corrupting the
    scores: `hr` matches "three", `api` matches "rapid", `ab` matches "table".
    Each of those made an unrelated direction look like it had evidence behind
    it. Boundaries are checked against alphanumerics rather than \\b so phrases
    containing punctuation ("a/b") still match.
    """
    key = str(keyword or "").lower().strip()
    if not key:
        return False
    pat = _KW_RE_CACHE.get(key)
    if pat is None:
        # Optional plural so "stakeholders" still matches "stakeholder", while
        # "three" still does not match "hr" and "rapid" does not match "api".
        pat = re.compile(r"(?<![a-z0-9])" + re.escape(key) + r"(?:s|es)?(?![a-z0-9])")
        _KW_RE_CACHE[key] = pat
    return bool(pat.search(text))


# ---------------------------------------------------------------- TrackFit


def skill_overlap(profile_skills: set[str], track_keywords: set[str]) -> float:
    """Jaccard between profile skills and track keywords. Empty sets -> 0.0."""
    if not profile_skills or not track_keywords:
        return 0.0
    union = profile_skills | track_keywords
    if not union:
        return 0.0
    return len(profile_skills & track_keywords) / len(union)


def nace_coverage(raw_by_competency: Mapping[str, int]) -> float:
    """Mean of min(5, raw)/5 over the seven scored competencies. Missing -> 0."""
    if not SEVEN:
        return 0.0
    total = 0.0
    for comp in SEVEN:
        raw = int(raw_by_competency.get(comp, 0) or 0)
        total += min(5, max(0, raw)) / 5.0
    return total / len(SEVEN)


_COMPETENCY_CUES: dict[str, tuple[str, ...]] = {
    "career_self_development": (
        "self-taught", "certificate", "course", "learning", "feedback",
        "mentor me", "trained myself", "shadowed",
    ),
    "communication": (
        "presented", "wrote", "script", "documented", "explained", "story",
        "board", "slides", "workshop", "visuali", "reported",
    ),
    "critical_thinking": (
        "analysis", "analysed", "analyzed", "cohort", "experiment", "priority",
        "trade-off", "tradeoff", "came to", "root cause", "debug", "hypothesis",
    ),
    "leadership": (
        "led", "lead", "committee", "mentored", "recruited", "organised",
        "organized", "coordinated", "captain", "chair", "managed a team",
    ),
    "professionalism": (
        "deadline", "on time", "quality", "stakeholder", "client", "manager",
        "hours per week", "documented", "handover",
    ),
    "teamwork": (
        "team", "group", "collaborat", "squad", "pair", "with design",
        "with engineering", "committee",
    ),
    "technology": (
        "sql", "python", "excel", "tableau", "looker", "powerbi", "dashboard",
        "automated", "jira", "notion", "git", "model",
    ),
}


def _cue_hits(text: str, cues: tuple[str, ...]) -> int:
    return sum(1 for cue in cues if cue in text)


def nace_raw_from_profile(profile: Mapping[str, Any]) -> dict[str, int]:
    """Evidence strength per competency.

    Explicit `tags` on an experience count as declared evidence. In addition,
    each experience bullet is scanned for competency cues (an analyst bullet
    that mentions a dashboard is technology evidence even if nobody tagged it).
    A competency never scores below its declared evidence, so tags always help.
    """
    declared: dict[str, int] = {c: 0 for c in SEVEN}
    inferred: dict[str, int] = {c: 0 for c in SEVEN}

    for exp in profile.get("experiences") or []:
        bullets = [str(b) for b in (exp.get("bullets") or []) if str(b).strip()]
        n_bullets = len(bullets)
        for tag in exp.get("tags") or []:
            key = str(tag).strip().lower()
            if key in declared and n_bullets:
                declared[key] = min(5, declared[key] + 1 + n_bullets)
        if not n_bullets:
            continue
        text = " ".join(
            [str(exp.get("title") or "").lower()] + [b.lower() for b in bullets]
        )
        for comp, cues in _COMPETENCY_CUES.items():
            if _cue_hits(text, cues) >= 1:
                inferred[comp] = min(5, inferred[comp] + 1)

    raw = {c: min(5, max(declared[c], inferred[c])) for c in SEVEN}
    for story in profile.get("stories") or []:
        key = str(story.get("competency") or "").strip().lower()
        if key in raw:
            raw[key] = min(5, raw[key] + 2)
    return raw


def evidence_transfer(experiences: Sequence[Mapping[str, Any]], track_keywords: set[str]) -> float:
    """Share of experiences that mention at least one track keyword."""
    if not experiences:
        return 0.0
    hits = 0
    for exp in experiences:
        text = _experience_text(exp)
        if any(keyword_hit(text, kw) for kw in track_keywords):
            hits += 1
    return hits / max(1, len(experiences))


def wef_align(profile_skills: set[str], rising: Mapping[str, Sequence[str]]) -> float:
    """Share of profile skills that hit at least one WEF rising-skill group."""
    if not profile_skills:
        return 0.0
    groups = [set(str(s).lower() for s in (v or [])) for v in rising.values()]
    hits = 0
    for skill in profile_skills:
        if any(skill in g for g in groups):
            hits += 1
    return min(1.0, hits / len(profile_skills))


def track_fit(components: Mapping[str, float]) -> float:
    """100 * weighted sum. Round to 1 dp."""
    total = 0.0
    for key, weight in WEIGHTS.items():
        total += weight * float(components.get(key, 0.0) or 0.0)
    return round(100.0 * total, 1)


def score_track(
    profile: Mapping[str, Any],
    track: Mapping[str, Any],
    rising: Mapping[str, Sequence[str]] | None = None,
    aliases: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Full deterministic TrackScore for one track."""
    skills = normalize_skills(profile.get("skills") or [], aliases)
    keywords = set(str(k).lower() for k in (track.get("keywords") or []))
    experiences = list(profile.get("experiences") or [])

    components = {
        "skill_overlap": round(skill_overlap(skills, keywords), 4),
        "nace_coverage": round(nace_coverage(nace_raw_from_profile(profile)), 4),
        "evidence_transfer": round(evidence_transfer(experiences, keywords), 4),
        "wef_align": round(wef_align(skills, rising or {}), 4),
    }
    fit = track_fit(components)

    matched = sorted(skills & keywords)
    missing = sorted(keywords - skills)

    return {
        "id": track.get("id"),
        "title": track.get("title"),
        "track_fit": fit,
        "components": components,
        "matched_skills": matched,
        "missing_skills": missing[:8],
        "nace_raw": nace_raw_from_profile(profile),
    }


# ---------------------------------------------------------------- resume scan


def resume_scan(
    profile: Mapping[str, Any],
    track: Mapping[str, Any],
    flags: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """SixPoint (60) + Keyword (25) + Layout (15). See docs/QUANT_MODELS.md §3."""
    flags = dict(flags or {})
    experiences = list(profile.get("experiences") or [])
    education = list(profile.get("education") or [])
    skills = normalize_skills(profile.get("skills") or [])

    six: dict[str, int] = {k: 0 for k in RESUME_SIX_POINT_KEYS}
    if profile.get("display_name") or flags.get("name_present"):
        six["name"] = 10

    current = None
    for exp in experiences:
        if exp.get("current") or (exp.get("end") in (None, "", "present", "Present")):
            current = exp
            break
    if current is None and experiences:
        current = experiences[0]

    if current:
        if str(current.get("title") or "").strip():
            six["title"] = 10
        if str(current.get("org") or "").strip():
            six["org"] = 10
        start = str(current.get("start") or "").strip()
        end = current.get("end")
        end_str = "present" if end in (None, "", "Present", "present") else str(end).strip()
        if start and end_str:
            six["dates"] = 10
        prev = [e for e in experiences if e is not current]
        if prev:
            if any(str(e.get("title") or "").strip() and str(e.get("org") or "").strip() for e in prev):
                six["previous"] = 10
    if education:
        edu = education[0]
        if str(edu.get("school") or "").strip() and str(edu.get("degree") or "").strip():
            six["education"] = 10

    six_total = sum(six.values())

    keywords = set(str(k).lower() for k in (track.get("keywords") or []))
    resume_text = " ".join(
        [str(profile.get("degree") or ""), str(profile.get("field") or "")]
        + [b for exp in experiences for b in (exp.get("bullets") or [])]
    ).lower()
    hits = sum(1 for kw in keywords if keyword_hit(resume_text, kw))
    threshold = max(5.0, 0.5 * len(keywords)) if keywords else 5.0
    keyword_score = 25.0 * min(1.0, hits / threshold)

    layout = 15
    bullets = [b for exp in experiences for b in (exp.get("bullets") or [])]
    if any(len(tokenize(b)) > 40 for b in bullets):
        layout -= 5
    if not bullets:
        layout -= 5
    if not flags.get("has_section_headers", True):
        layout -= 3
    if flags.get("has_photo"):
        layout -= 5
    layout = max(0, layout)

    total = round(six_total + keyword_score + layout)
    scan_flags: list[str] = []
    if six["dates"] == 0:
        scan_flags.append("missing_dates")
    if six["education"] == 0:
        scan_flags.append("missing_education")
    if hits == 0:
        scan_flags.append("no_track_keywords")
    if flags.get("has_photo"):
        scan_flags.append("photo_pulls_gaze")

    return {
        "track_id": track.get("id"),
        "score": min(100, total),
        "six_point": {**six, "total": six_total},
        "keyword": round(keyword_score, 1),
        "keyword_hits": hits,
        "layout": layout,
        "flags": scan_flags,
    }


# ---------------------------------------------------------------- STAR score


def _story_text(value: Any) -> str:
    """A STAR field must be text. Anything else counts as absent.

    str({'x': 1}) contains a digit, which the result check would read as a
    quantified outcome — so coercing objects invents evidence.
    """
    return value.strip() if isinstance(value, str) else ""


def star_score(story: Mapping[str, Any]) -> dict[str, Any]:
    """1-5 BARS score with diagnostic caps. Deterministic."""
    situation = _story_text(story.get("situation"))
    task = _story_text(story.get("task"))
    action = _story_text(story.get("action"))
    result = _story_text(story.get("result"))

    combined_words = sum(_word_count(x) for x in (situation, task, action, result))

    s = 1 if _word_count(situation) >= 8 and (
        re.search(r"\b(19|20)\d{2}\b", situation)
        or re.search(r"\b(term|semester|at|in|during|when)\b", situation.lower())
    ) else 0
    t = 1 if re.search(r"\b(i|my)\b", task.lower()) else 0
    action_verbs = sum(1 for w in tokenize(action) if w in _ACTION_VERBS)
    a = 1 if action_verbs >= 2 else 0
    r = 1 if result else 0
    r_quant = bool(r and (re.search(r"\d", result) or any(c in result.lower() for c in _RESULT_CUES)))
    q = 1 if r_quant else 0

    base = s + t + a + r + q
    if combined_words >= 20 and base == 0:
        base = 1
    if combined_words == 0:
        base = 0

    word_shares = _star_word_shares(situation, task, action, result)
    caps: list[str] = []
    score = base

    if score > 0:
        # MIT CAPD's spoken-answer guide puts Action at ~60% of the words; 35% is
        # the pass mark here so a tight but clear answer is not punished.
        if word_shares["a"] < 0.35 and action:
            score = min(score, 3)
            caps.append("action_share")
        action_lower = action.lower()
        has_i = bool(re.search(r"\bi\b", action_lower))
        has_we = bool(re.search(r"\bwe\b", action_lower))
        if action and not has_i and has_we:
            score = min(score, 2)
            caps.append("no_first_person")
        if not result:
            score = min(score, 3)
            caps.append("no_result")

    score = max(1, min(5, score)) if combined_words > 0 else 0

    diagnostics: list[str] = []
    if _word_count(situation + " " + task + " " + action + " " + result) > 220:
        diagnostics.append("likely_too_long_[heuristic]")

    return {
        "score": score,
        "breakdown": {"s": s, "t": t, "a": a, "r": r, "q": q, "caps": caps},
        "word_share": word_shares,
        "diagnostics": diagnostics,
    }


def _star_word_shares(situation: str, task: str, action: str, result: str) -> dict[str, float]:
    counts = {
        "s": _word_count(situation),
        "t": _word_count(task),
        "a": _word_count(action),
        "r": _word_count(result),
    }
    total = sum(counts.values())
    if total == 0:
        return {k: 0.0 for k in counts}
    return {k: round(v / total, 3) for k, v in counts.items()}


# ---------------------------------------------------------------- readiness


def story_coverage(stories: Sequence[Mapping[str, Any]]) -> float:
    if not stories:
        return 0.0
    scored = {
        str(s.get("competency") or "").strip().lower()
        for s in stories
        if int(s.get("score") or 0) > 0
    }
    return min(1.0, len(scored & set(SEVEN)) / len(SEVEN))


def interview_readiness(
    track_fit_score: float,
    resume_scan_score: float,
    stories: Sequence[Mapping[str, Any]],
) -> float:
    """0-100 composite. See docs/QUANT_MODELS.md §5."""
    scores = [int(s.get("score") or 0) for s in stories]
    star_mean = (sum(scores) / len(scores)) if scores else 0.0
    value = (
        READINESS_WEIGHTS["star"] * (star_mean / 5.0) * 100.0
        + READINESS_WEIGHTS["track_fit"] * float(track_fit_score or 0.0)
        + READINESS_WEIGHTS["resume_scan"] * float(resume_scan_score or 0.0)
        + READINESS_WEIGHTS["story_coverage"] * story_coverage(stories) * 100.0
    )
    return round(value, 1)


# ---------------------------------------------------------------- five-day plan


def plan_seven(scan: Mapping[str, Any], stories: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Deterministic 7-day checklist. Day 1-2 are mandatory when SixPoint < 60."""
    six_total = int((scan.get("six_point") or {}).get("total", 0) or 0)
    gaps = sorted(
        SEVEN,
        key=lambda c: sum(1 for s in stories if str(s.get("competency")) == c),
    )
    weak = gaps[0] if gaps else "communication"
    weak2 = gaps[1] if len(gaps) > 1 else weak

    plan = [
        {"day": 1, "title": "Fix resume six-point misses", "done": False},
        {"day": 2, "title": "Rewrite bullets that failed keyword overlap", "done": False},
        {"day": 3, "title": f"Draft a STAR story for {weak.replace('_', ' ')}", "done": False},
        {"day": 4, "title": f"Draft a STAR story for {weak2.replace('_', ' ')}", "done": False},
        {"day": 5, "title": "Rehearse Action-heavy versions out loud", "done": False},
        {"day": 6, "title": "Answer the generated questions in writing", "done": False},
        {"day": 7, "title": "Print the report and run a timed 4-question mock", "done": False},
    ]
    if six_total < 60:
        plan[0]["mandatory"] = True
    if not stories:
        plan[2]["mandatory"] = True
    return plan
