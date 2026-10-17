# Pathfolio

**Designing personalised interview strategies for fresh graduates.**

One profile in, three career directions out — each with a fit score you can explain, a résumé
check, grounded rewrite suggestions, a STAR story bank, likely interview questions and a seven-day
preparation plan.

Built for **Track 4 — Future Work & Enterprises**.

**Live demo:** <http://106.55.39.223:8080> — no login, no key. Press *Load the CityU sample*.

---

## At a glance

| | |
| --- | --- |
| **Who it is for** | Final-year students, recent graduates, internship and graduate-programme applicants |
| **What goes in** | Education, experiences, skills — typed, pasted, or one of four built-in samples |
| **What comes out** | Three scored directions, a résumé scan, rewrites, STAR stories, likely questions, a seven-day plan, a printable report |
| **What is deterministic** | Every score. The formula is public and the engine runs locally |
| **What the model does** | Drafts prose only — and every draft is fact-checked before you see it |
| **What it will not do** | Apply for you, rank candidates, or claim a score predicts an offer |

## The problem

Graduates do not fail to find work because they lack qualifications. They fail at the step where
those qualifications have to be explained out loud: relating coursework to a job, choosing which of
several plausible directions to pursue, and answering "tell me about a time…" with evidence rather
than adjectives.

Hong Kong's market has made that step harder. Entry-level roles fell to **30,798 in 2025, a 55% drop
from 68,728**, while the average graduate salary moved just +0.5%. Students respond by sending one
generic résumé to everything, which is why it lands nowhere.

Existing help is either generic or expensive. University workshops cover everyone at once; career
coaching costs more than a student can justify; and the newest wave of AI résumé tools generates
confident text nobody can check. Pathfolio takes the opposite position: **the engine scores, the
model only writes**, and every number is traceable to a formula you can read.

## What it does

1. **Chooses the directions.** Eight career tracks are scored against the profile — data/insights,
   product/operations, commercial, finance/audit, user research, HR, technology delivery, public
   sector. The top five become a shortlist; the model picks three and explains why, or the local
   ranking decides when no model is configured.
2. **Checks the résumé.** A 100-point skim built on the six data points recruiters read in the first
   seconds, plus keyword coverage and layout penalties.
3. **Rewrites the bullets.** Each suggestion may only rephrase facts already in the profile. Accept,
   edit or dismiss — nothing is applied automatically.
4. **Builds the story bank.** STAR answers scored 1–5 against behavioural anchors, with diagnostic
   caps that explain *why* a story is weak ("action is under 35% of the words", "no first-person
   ownership").
5. **Prepares for the interview.** Likely questions with the employer's reason for asking, and a
   seven-day plan whose first two days are mandatory while the résumé is incomplete.
6. **Exports what was accepted.** A printable report — the student's document, not ours.

The interface is bilingual (English / 繁體中文). Drafted material stays in English by design: that is
the language the interview will be in.

## Why the scores can be trusted

- **Every number comes from `packages/scoring`** — pure Python, no network, no model. Same input,
  same output, every time.
- **The model never returns a number.** It drafts prose; the score is computed before it is called.
- **Every draft passes a fact-check.** A suggestion containing a number or organisation that is not
  in the profile is rejected, and shown as rejected rather than quietly shipped.
- **The student decides.** Accept / edit / dismiss on every rewrite and every story.
- **No key, no crash.** With no API key the whole flow runs on offline fixtures.

## How a fit score is computed

| Component | Weight | What it measures |
| --- | --- | --- |
| Skill overlap | 40% | Jaccard similarity between the profile's skills and the track's keyword bank |
| NACE coverage | 30% | Evidence strength across the seven scored NACE career-readiness competencies |
| Evidence transfer | 20% | Share of experiences whose text mentions at least one track keyword |
| WEF alignment | 10% | Share of skills that hit a WEF 2025 rising-skill group |

Interview readiness then combines STAR quality, track fit, résumé scan and story coverage. Keyword
matching is whole-token, not substring — a detail that matters, because naive substring matching
makes `hr` match "three" and quietly inflates the wrong track.

## Evaluation — measured, and still owed

The interim report commits to four measures: user satisfaction, recommendation relevance, usability
and self-reported confidence. Two kinds of verification exist today; the four human ones do not.

**Measured now, enforced by tests:** 29 scoring tests, 35 end-to-end API checks, 15 tests covering
the model switch, identifier redaction and the fact-check gate, and 25 checks against a mock model
server. The four sample profiles produce identical scores on every run, and the picker is asserted
to choose only from the scored shortlist.

**Not yet measured:** no usability session, no satisfaction survey, no before/after confidence
measure has been run. `docs/EVALUATION.md` holds the protocol we would run next — five to eight
participants, three scripted tasks, SUS, relevance ratings, and failure conditions written down in
advance. Until it runs, the report's evaluation claims remain a plan, not a result.

## Run it locally

Requires Python 3.11+ and Node 18+.

```bash
# terminal 1 — API on :8000
cd apps/api
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000

# terminal 2 — web on :5180
cd apps/web
npm install
npx vite --host 127.0.0.1 --port 5180
```

Open <http://127.0.0.1:5180> and press **Load the CityU sample**.

To let a real model draft (optional), copy `apps/api/.env.example` to `.env`, set `OPENAI_API_KEY`,
export `PATHFOLIO_FIXTURE_MODE=false`, and list the tasks it may handle:

```bash
export PATHFOLIO_LLM_TASKS=extract,suggest,stories,strategy,tracks,pick_tracks
```

Anything not listed uses the offline fixtures, and every response reports which one it used
(`drafted_by`). `/healthz` shows the per-task state and why the last attempt fell back.

### Bring your own key (visitor mode)

The deployed demo runs without a key, so its drafts come from the offline set. Press **AI** in the
header and paste any OpenAI-compatible key to draft with the model instead — ordinary chat
completions, so a DeepSeek or OpenRouter key works if you also set the base URL.

The key is stored in that browser's `localStorage` and sent as `X-LLM-Key`, `X-LLM-Base` and
`X-LLM-Model` headers. On the server it lives in a request-scoped context variable: it is never
written to a session, never logged, and never appears in an error message. One click clears it. Use
a key you can revoke. Scores are identical either way — the engine computes them before the model is
called.

## Sample profiles

Four profiles ship in `data/samples/`. Switching between them is the fastest way to see that the
directions follow the content:

| Sample | Background | Top three |
| --- | --- | --- |
| `cityu_graduate` | BBA, four cross-functional experiences | analytics 66 · commercial 64 · product_ops 63 |
| `cityu_engineer` | BSc Computer Science | tech_delivery 68 · analytics 42 · user_research 40 |
| `cityu_marketer` | BBA Marketing | commercial 69 · analytics 38 · finance_audit 38 |
| `cityu_researcher` | BSocSc Public Policy | user_research 54 · public_social 49 · hr_people 45 |

The offline rewrite and STAR sets were written for `cityu_graduate`; the other three need a model
key for drafts, while scoring, scanning and planning work for all four with no key at all.

## Tests

```bash
python3 packages/scoring/tests/test_scoring.py   # 29 scoring tests
python3 apps/api/smoke_test.py                   # 35 end-to-end API checks
python3 apps/api/test_llm.py                     # 15 tests: switches, redaction, fact-check
python3 apps/api/test_llm_live.py                # 25 checks against a mock model server
cd apps/web && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

## Architecture

```
apps/web/            Vite + React + TypeScript, bilingual UI
apps/api/            FastAPI, prompts, offline fixtures
packages/scoring/    Pure-Python scoring — no network, no model
data/samples/        Four demo profiles, scoring cases, offline drafts
data/tracks/         Eight direction definitions, aliases, WEF rising-skill groups
docs/                Plan, quantitative models, data models, ethics, evaluation, sources
```

The API can also serve the built frontend (`PATHFOLIO_WEB_DIST`), so a deployment is one process on
one port.

## How it differs from existing tools

A review of comparable AI résumé and interview platforms (written up in
`docs/COMPETITIVE_POSITIONING.md`) lists five recurring failures: keyword stuffing, fabricated
metrics, rigid templates, free-tier caps and blind spots in specialised fields. Pathfolio answers
four of them structurally — rewrites may only restate existing facts, every draft passes a
fact-check, there are no templates to be trapped by, and scoring is local and unmetered — and admits
the fifth: eight curated directions are not every career.

> Every tool in that review is either guessing at the candidate's evidence or charging per guess.
> This one computes the fit locally and refuses drafts it cannot ground.

## Design principles

- **The model writes; the engine scores.** A score nobody can reproduce is a score nobody can defend.
- **Fact-check or discard.** Invented metrics and employers are rejected and shown as rejected.
- **Human in the loop.** No auto-apply, no bulk export, no decisions taken for the student.
- **Never break because of the model.** No key, a timeout or malformed JSON all fall back cleanly.
- **No leaderboards, no psychometrics, no employer-side screening.** This is a tool for the candidate.

## Privacy

Personal identifiers (name, email, phone, links) are stripped before any request leaves the machine.
Sessions live in memory and can be deleted from the UI. A visitor-supplied key stays in that browser
and is held server-side only for the lifetime of one request. The design follows the six Data
Protection Principles of Hong Kong's PDPO; see `docs/ETHICS_PDPO.md`.

## Limitations

- The eight directions are hand-curated keyword banks, not live labour-market data.
- A score measures how complete and structured the material is — not the probability of an offer.
- Directions with no skill overlap are ranked below ones that do have overlap; the score itself is
  not adjusted for that.
- Offline drafts exist for the default sample only.
- Interface copy is bilingual; drafted content is English-only.
- Mock interviews, progress tracking and integration with university career services — all named as
  future work in the interim report — are not built. Multilingual support, also future work there,
  is done: the interface ships in English and Chinese.
- No user study has been run. See `docs/EVALUATION.md` for the protocol and its status.

## What we deliberately do not do

The interim report scopes the project to interview preparation and career readiness. The build
respects that boundary in code, not just in slides:

- No job application is submitted on the user's behalf.
- No recruitment decision, ranking or candidate screening is offered to employers.
- No claim that preparation causes an offer.
- No replacement for a careers adviser — the output is a document the student takes *to* one.

## Sources

The scoring weights and the résumé scan rest on published work: NACE career-readiness competencies,
the WEF *Future of Jobs Report 2025*, the Ladders eye-tracking study, MIT CAPD's STAR guidance, and
Hong Kong graduate employment data. Numbered citations are in `docs/SOURCES.md`.

## License

Not licensed yet — add a `LICENSE` file (MIT is the usual choice) before making the repository public.
