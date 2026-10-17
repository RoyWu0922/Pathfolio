# HANDOFF — implement Pathfolio, do not re-plan

**Date locked:** 2026-10-09  
**Profile:** hoshino  
**Repo:** `/Users/nothing/Hackathon_Project`  
**Product name:** Pathfolio  
**Hackathon track:** 4. Future Work & Enterprises  
**UI / agent language:** English  
**Master (user):** CityU student. Terse follow-ups. Wants working artefacts, not option lists.

If you are a later model in this profile: **do not restart research or redesign the product.** The plan is approved. Your job is to implement the MVP described in `PLAN.md` until a judge can click through the demo in `DEMO_SCRIPT.md`.

## Goal of the MVP

A local web app where a graduate pastes (or loads a sample) profile, the system proposes **3 career tracks**, each with:

1. Track-fit score 0–100 (deterministic formula in `QUANT_MODELS.md`)
2. Resume 7-second scan score 0–100
3. NACE competency coverage
4. STAR story bank with 1–5 BARS scores
5. Interview strategy (likely questions, 7-day plan, positioning one-liner)
6. On-screen HTML report + browser-print PDF

Built-in LLM is required. LLM **extracts and drafts**. Python **computes every number**. User **accepts / edits / discards** every AI sentence before it enters the portfolio.

## Build order (do not skip)

All ten slices are implemented. For what comes next, work from `docs/ROADMAP.md` — it is ordered by
judge value and each item carries an acceptance test. Do not start P1/P2 work before the P0 items:
the four unwired LLM calls are the largest credibility risk in the current build.

The original slice order, for reference:

1. Scaffold `apps/web` (Vite React TS) and `apps/api` (FastAPI). One `docker-compose` is optional; `uvicorn` + `npm run dev` is enough.
2. Implement `packages/scoring` with unit tests against the formulas. No network.
3. Seed `data/samples/cityu_graduate.json` and `data/tracks/*.json` (skill banks).
4. API: `POST /v1/profile/parse` (LLM JSON) → `POST /v1/tracks/recommend` (scoring + optional LLM labels) → `POST /v1/stories/star` → `POST /v1/strategy` → `GET /v1/report/:id`.
5. Web: onboarding → track cards → track workspace (resume scan, STAR, plan) → export.
6. Ethics footer + Personal Information Collection Statement on first run.
7. Demo dry-run with the sample profile. Screenshot/PDF in `data/demo-output/` once it works.

## Hard constraints

- Do not scrape job boards or auto-apply.
- Do not send raw name/email/phone to the LLM. Strip identifiers; restore on the client (same pattern FirstResume describes, adapted for PDPO).
- Do not claim ATS-pass rates, interview-rate multipliers, or “we predict job performance”.
- Do not use TheLadders / NACE / WEF numbers as if they were our experiment. Cite them in the UI as “based on …”.
- Do not train on user data. Session-first; localStorage optional; delete control required.
- FirstResume is a **UX reference**, not a design clone. No copied copy, logos, or screenshots in the product.

## Stack (pinned)

| Layer | Choice | Why |
| --- | --- | --- |
| Web | Vite 5 + React 18 + TypeScript | Fast hackathon UI, print CSS for PDF |
| API | FastAPI + Pydantic v2 + Python 3.11 | DS teammates; `/usr/local/bin/python3` is 3.11.5 on this machine |
| Scoring | Pure Python in `packages/scoring` | Testable, no hallucinations in the numbers |
| LLM | OpenAI-compatible Chat Completions, `response_format: json_object` | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| Persist | In-memory dict + optional local JSON for demo | Avoid a database in MVP |
| PDF | HTML report + `@media print` + `window.print()` | No extra native deps. Optional later: Playwright PDF |

If an env key is missing, the UI must still run on **sample fixtures** so the demo never dies.

## Definition of done

A stranger can, in under 4 minutes:

1. Click “Load CityU sample”.
2. See three named tracks with three different scores.
3. Open one track, see a STAR story scored 1–5 with S/T/A/R highlighted.
4. Accept one resume bullet rewrite.
5. Export / print an HTML report that includes the ethics disclaimer.

Plus: `packages/scoring` tests pass; README at repo root tells how to start both servers.

## Files you may create

Application code under `apps/`, `packages/`, `data/`.  
Do **not** rewrite the docs in `docs/` unless a formula is wrong; patch `QUANT_MODELS.md` and keep the citation numbers stable.

## Files you must not touch

- `/Users/nothing/.hermes/skills/` (default profile)
- Another Hermes profile’s skills / memories
- The source interim `.docx`

## Master communication

After implementation work, report in short Chinese, call him 主人, one finished-task line. Specs stay English.
