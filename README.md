# Pathfolio

**One graduate profile in, three career directions you can defend out.**

Pathfolio is a career-strategy agent for fresh graduates. It takes the material a student already
has — coursework, part-time jobs, society roles, a final-year project — and turns it into three
distinct job-search directions, each with a fit score you can explain, a résumé check, grounded
rewrite suggestions, a STAR story bank, a set of likely interview questions and a seven-day plan.

Built for **Track 4 — Future Work & Enterprises**.

**Live demo:** <http://106.55.39.223:8080> — no login, no key needed. Press *Load the CityU sample*.

---

## The problem

Graduate hiring in Hong Kong has tightened sharply: entry-level roles fell to **30,798 in 2025, a 55%
drop from 68,728**, while the average graduate salary moved just +0.5%. Students respond by sending
one generic résumé to everything, which is why it lands nowhere.

The tools that exist fall into two camps. Career sites hand you a black-box score. LLM wrappers
generate confident text that nobody can check. Pathfolio takes the opposite position on both: **the
engine scores, the model only writes**, and every number is traceable to a formula you can read.

## What it does

1. **Choose the directions.** Eight career tracks are scored against the profile — data/insights,
   product/operations, commercial, finance/audit, user research, HR, technology delivery, public
   sector. The top five become a shortlist; the model picks three and explains why, or the local
   ranking decides when no model is configured.
2. **Check the résumé.** A 100-point skim built on the six data points recruiters actually look at
   in the first seconds, plus keyword coverage and layout penalties.
3. **Rewrite the bullets.** Each suggestion may only rephrase facts already in the profile. Accept,
   edit or dismiss — nothing is applied automatically.
4. **Build the story bank.** STAR answers scored 1–5 against behavioural anchors, with diagnostic
   caps that explain why a story is weak.
5. **Prepare.** Likely questions with the employer's reason for asking, and a seven-day plan whose
   first two days are mandatory when the résumé is incomplete.
6. **Export.** A printable report of what the student accepted.

The interface is bilingual (English / 繁體中文). Drafted material stays in English by design — it is
what the student takes into an English-language interview.

## Why the scores can be trusted

- **Every number comes from `packages/scoring`** — pure Python, no network, no model. Same input,
  same output, every time.
- **The model never returns a number.** It drafts prose; the score is computed before it is called.
- **Every draft passes a fact-check.** A suggestion containing a number or organisation that is not
  in the profile is rejected and shown as rejected, not quietly shipped.
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

The deployed demo runs without a key, so its drafts come from the offline set. Press **AI** in
the header and paste any OpenAI-compatible key to draft with the model instead — ordinary chat
completions, so a DeepSeek or OpenRouter key works if you also set the base URL.

The key is stored in that browser's `localStorage` and sent as `X-LLM-Key`, `X-LLM-Base` and
`X-LLM-Model` headers. On the server it lives in a request-scoped context variable: it is never
written to a session, never logged, and never appears in an error message. One click clears it.
Use a key you can revoke. Scores are identical either way — the engine computes them before the
model is called.

## Sample profiles

Four profiles ship in `data/samples/`, and switching between them is the fastest way to see that the
directions follow the content:

| Sample | Background | Top three |
| --- | --- | --- |
| `cityu_graduate` | BBA, four cross-functional experiences | analytics 66 · commercial 64 · product_ops 63 |
| `cityu_engineer` | BSc Computer Science | tech_delivery 68 · analytics 42 · user_research 40 |
| `cityu_marketer` | BBA Marketing | commercial 69 · analytics 38 · finance_audit 38 |
| `cityu_researcher` | BSocSc Public Policy | user_research 54 · public_social 49 · hr_people 45 |

The offline rewrite and STAR sets were written for `cityu_graduate`; the other three need a model key
for drafts, while scoring, scanning and planning work for all four with no key at all.

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
docs/                Plan, quantitative models, data models, ethics, demo script, sources
```

The API can also serve the built frontend (`PATHFOLIO_WEB_DIST`), so a deployment is one process on
one port.

## Design principles

- **The model writes; the engine scores.** A score nobody can reproduce is a score nobody can defend.
- **Fact-check or discard.** Invented metrics and employers are rejected and shown as rejected.
- **Human in the loop.** No auto-apply, no bulk export, no decisions taken for the student.
- **Never break because of the model.** No key, a timeout or malformed JSON all fall back cleanly.
- **No leaderboards, no psychometrics, no employer-side screening.** This is a tool for the candidate.

## Privacy

Personal identifiers (name, email, phone, links) are stripped before any request leaves the machine.
Sessions live in memory and can be deleted from the UI. The design follows the six Data Protection
Principles of Hong Kong's PDPO; see `docs/ETHICS_PDPO.md`.

## Limitations

- The eight directions are hand-curated keyword banks, not live labour-market data.
- A score measures how complete and structured the material is — not the probability of an offer.
- Directions with no skill overlap are ranked below ones that do have overlap; the score itself is
  not adjusted for that.
- Offline drafts exist for the default sample only.
- Interface copy is bilingual; drafted content is English-only.

## Sources

The scoring weights and the résumé scan rest on published work: NACE career-readiness competencies,
the WEF *Future of Jobs Report 2025*, the Ladders eye-tracking study, MIT CAPD's STAR guidance, and
Hong Kong graduate employment data. Numbered citations are in `docs/SOURCES.md`.

## License

Not licensed yet — add a `LICENSE` file (MIT is the usual choice) before making the repository public.
