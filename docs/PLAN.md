# Pathfolio — product and implementation plan

Locked 2026-10-09. Implement this. Do not replace it with a chatbot or a FirstResume replica.

## 1. Problem (one sentence)

Fresh graduates in a shrinking Hong Kong entry-level market cannot translate one academic life into **role-specific, scorable interview evidence**, and generic AI tools hide that gap behind fluent but unpersonalised text.

## 2. Product

**Pathfolio** is a browser agent that:

- Ingests a graduate profile (education, projects, internships, campus roles, skills, target constraints).
- Proposes **three diversified tracks** (example: Graduate Data Analyst / Product Analyst / Management Trainee — actual names come from the profile, not this example).
- Scores each track with a published formula.
- Builds a **portfolio pack** per track: positioning line, resume scan, suggested bullet rewrites (accept/reject), STAR stories, likely questions, 7-day plan.
- Renders the pack as a web workspace and a printable HTML/PDF.

Primary users: final-year students, recent graduates, internship and graduate-trainee applicants.  
Paying clients (story for judges, not built): university career centres, later a student subscription.

Boundaries (also in the interim report): no job guarantee, no counsellor replacement, no recruitment, no hiring decisions, no live job scraping, no auto-apply.

## 3. User journey (MVP)

1. **Welcome** — English. One paragraph of purpose. PICS / privacy notice. “Load sample” and “Paste profile”.
2. **Profile** — structured form pre-filled from paste or sample. Fields: name (stays client-side), school, degree, grad year, experiences (title, org, dates, bullets), skills, languages, constraints (HK / GBA / remote, industries they refuse).
3. **Tracks** — three cards. Each: title, one-line why, TrackFit 0–100, top 3 matched skills, top 2 gaps. User can pin 1–3 tracks (default all three).
4. **Workspace** (tabbed, one track at a time)
   - Overview: positioning statement (AI draft, editable).
   - Resume scan: six Ladders data-points checklist + keyword overlap + layout flags.
   - Stories: 4–6 STAR drafts mapped to NACE competencies; 1–5 score; S/T/A/R colour spans; accept/edit/discard.
   - Interview plan: 8–12 questions (behavioural + role-specific), mapped competency, why they ask it; 7-day checklist.
5. **Export** — HTML report in a new route, print to PDF. Filename `pathfolio-{track-slug}.pdf` via the browser.

No account system in MVP. Session id in memory. “Download JSON” for the portfolio so the user leaves with their data.

## 4. Information architecture

```
/                     welcome + PICS
/profile              editor
/tracks               three cards
/tracks/:id           workspace
/tracks/:id/report    printable report
/ethics               longer disclaimer (linked from footer)
```

Visual language (inspired by FirstResume, not copied): light background, one accent colour, large numeric scores, suggestion diffs (old bullet / new bullet / Accept). Dense but calm. Desktop-first; mobile readable.

## 5. Architecture

```
[Browser: Vite React]
    | JSON
[FastAPI]
    |-- packages/scoring   (pure functions)
    |-- llm.py             (strip PII → JSON schema → restore ids)
    |-- track_bank.py      (static skill banks + WEF rising skills)
    `-- session_store.py   (dict)
```

### 5.1 API

All JSON. CORS open for localhost.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/session` | `{}` | `{ session_id }` |
| POST | `/v1/profile/parse` | `{ session_id, raw_text }` | `{ profile }` (Pydantic) |
| PUT | `/v1/profile` | `{ session_id, profile }` | `{ profile }` |
| POST | `/v1/tracks/recommend` | `{ session_id }` | `{ tracks: TrackScore[3] }` |
| POST | `/v1/resume/scan` | `{ session_id, track_id }` | `{ scan: ResumeScan }` |
| POST | `/v1/resume/suggest` | `{ session_id, track_id }` | `{ suggestions: Diff[] }` |
| POST | `/v1/stories/generate` | `{ session_id, track_id }` | `{ stories: StarStory[] }` |
| POST | `/v1/stories/score` | `{ story }` | `{ score, breakdown }` (no LLM) |
| POST | `/v1/strategy` | `{ session_id, track_id }` | `{ questions, plan7 }` |
| GET | `/v1/export/:session_id/:track_id` | | `{ report }` |
| DELETE | `/v1/session/:id` | | `{ ok: true }` |

Error shape: `{ "error": { "code": "...", "message": "..." } }`.

When LLM is down: parse/suggest/generate/strategy return HTTP 503 with `code=llm_unavailable`. Recommend and score endpoints must still work on the sample profile using fixtures in `data/samples/fixtures_llm.json`.

### 5.2 LLM contract

One helper: `complete_json(system, user, schema_name) -> dict`.

Rules:

- Strip `name`, `email`, `phone`, `linkedin` before the request. Replace with `CANDIDATE`.
- Temperature 0.3 for extraction, 0.5 for drafts.
- Max 3 retries on invalid JSON.
- Every drafted sentence must be grounded in the profile. If evidence is missing, return `"insufficient_evidence": true` instead of inventing internships.
- Prompts live in `apps/api/prompts/*.md`. Do not bury them in code.

Prompt jobs:

1. `extract_profile` — raw text → Profile JSON.
2. `label_tracks` — given scored tracks, write 1-sentence rationale and positioning (does not change scores).
3. `rewrite_bullets` — old bullet + track keywords → new bullet + reason. No new facts.
4. `draft_star` — experience + target competency + track → S/T/A/R fields. No new facts.
5. `draft_questions` — track skill bank + profile gaps → questions with `why_asked`.

### 5.3 Scoring

See `QUANT_MODELS.md`. Import from `packages/scoring`. The API never asks the LLM for a number.

## 6. Track bank (MVP, three families always available)

The recommender **scores all families** against the profile and returns the top 3. Families can be renamed by the LLM labeler but ids stay stable.

| id | Display default | Typical HK graduate roles |
| --- | --- | --- |
| `analytics` | Data / Insights Analyst | graduate analyst, BI intern, research exec |
| `product_ops` | Product / Operations | junior PM, ops graduate, project coord |
| `commercial` | Commercial / Marketing / MT | marketing exec, management trainee, BD |

Each family JSON in `data/tracks/{id}.json`:

```json
{
  "id": "analytics",
  "title": "Data / Insights Analyst",
  "keywords": ["sql", "python", "excel", "tableau", "statistics", "ab test", "dashboard"],
  "nace_weights": { "critical_thinking": 1.0, "technology": 1.0, "communication": 0.8, "teamwork": 0.6 },
  "wef_rising": ["ai_big_data", "analytical_thinking", "technological_literacy"],
  "star_prompts": ["messy data", "explained numbers to non-technical", "deadline", "disagreement"]
}
```

Add more families only if the first three work.

## 7. Web pages — component list

- `ScoreRing` — 0–100, colour: <50 muted, 50–74 accent, ≥75 strong.
- `DiffBullet` — minus/plus/accept/dismiss.
- `StarBlock` — four labelled paragraphs, score chip, “Action share” bar.
- `GapList` — NACE competency with empty state CTA “add a story”.
- `PlanSeven` — Mon–Sun checklist, local state.
- `DisclaimerBar` — always visible on workspace and report.

No dark-pattern upsells. No fake “10x interview rate”.

## 8. Implementation slices (each slice must leave the app runnable)

| Slice | Deliverable | Owner hint |
| --- | --- | --- |
| S0 | Empty web + healthz API | platform DS |
| S1 | Scoring library + tests | recsys DS |
| S2 | Sample profile + track JSON | recsys DS |
| S3 | Profile paste + parse (LLM or fixture) | platform DS |
| S4 | Track cards from scoring | recsys + product |
| S5 | Resume scan panel | recsys |
| S6 | STAR generate + score | recsys + platform |
| S7 | Strategy + 7-day plan | product + platform |
| S8 | Accept/reject persistence in session | platform |
| S9 | Printable report | product |
| S10 | PICS, delete session, ethics page | PM + product |

## 9. Test plan

Scoring (pytest):

- Known profile fixture → TrackFit numbers pinned to ±0.5.
- STAR missing Result → score ≤ 3.
- STAR all “we” → score ≤ 2.
- Resume missing dates → six-point component < 60.

API:

- Parse with identifiers stripped (unit test the stripper).
- Delete session removes data.

UI (manual for hackathon):

- Load sample, three different scores, print dialog opens.

## 10. Runbook (write this into root README once code exists)

```bash
cd apps/api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

cd apps/web && npm install && npm run dev
```

`.env.example`:

```
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
PATHFOLIO_FIXTURE_MODE=false
```

`PATHFOLIO_FIXTURE_MODE=true` skips the LLM and uses `data/samples/fixtures_llm.json`.

## 11. Judging map

| Criterion 20% | Where it shows |
| --- | --- |
| Framing | Welcome stats (JIJIS 55% drop, NACE gap) with sources |
| Prototype | Clickable workspace + PDF |
| GenAI | Extract, rewrite, STAR draft, questions — never the scores |
| Feasibility / impact | University-licence story on ethics page; sample is a real CityU-shaped profile |
| Sustainability / ethics | PDPO PICS, delete, human-in-the-loop, limitation copy |

## 12. Explicit non-goals for this hackathon

Voice mock interview, job board, LinkedIn import, accounts, payments, Chinese UI, employer dashboard, fine-tuning, vector DB.
