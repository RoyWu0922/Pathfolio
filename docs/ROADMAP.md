# Pathfolio roadmap

Written 2026-10-09, after the MVP was verified end to end. Read `HANDOFF.md` first; this file
only says what to add next and why.

Ordering rule: judge value first, then demo risk. Every item states its acceptance test, because
"looks done" is not done.

## Where the MVP actually stands

Working: profile (sample or paste) → three scored tracks → per-track workspace (resume six-point
scan, accept/edit/dismiss rewrites, STAR stories scored 1–5, likely questions, seven-day plan) →
printable report → delete session. 29 scoring tests, 26 API checks, clean `tsc`, production build OK.

The honest gap: **the LLM is wired into exactly one route.** `apps/api/llm.py` defines
`label_tracks`, `rewrite_bullets`, `draft_star` and `draft_questions`, and the prompt files exist in
`apps/api/prompts/`, but `main.py` only calls `extract_profile`. Everything else still reads
`data/samples/fixtures_llm.json` even when a key is configured. A judge asking "where is the
generative AI" gets one honest answer and four soft ones.

---

## P0 — do these before the demo

### P0.1 Wire the remaining four LLM calls, with a per-task switch — ✅ DONE

See `docs/ROADMAP_STATUS.md` for what shipped, the test commands and the UI changes. The four routes
now call the model, every payload reports `drafted_by`, and any failure falls back to the fixtures.

The original requirement, kept for reference:

**Why.** Track 4 scores "appropriate technical component" at 20% and asks specifically which model
and technique is implemented. One wired route is thin.

**What.**

- In `main.py`, each of `tracks/recommend`, `resume/suggest`, `stories/generate`, `strategy` tries
  the LLM first and falls back to the fixture on any failure. A failed call must never 500 the demo.
- Replace the single `FIXTURE_MODE` boolean with per-task control, e.g.
  `PATHFOLIO_LLM_TASKS=extract,suggest,stories` (empty or unset = fixtures only). Keep
  `PATHFOLIO_FIXTURE_MODE=true` as the master off switch so nothing existing breaks.
- Return the source in the payload: `{"drafted_by": "llm" | "fixture"}` so the UI can say which it
  used instead of pretending.
- Fact-check before serving: a rewrite or story that introduces an employer, tool, date or metric
  absent from the profile is dropped and replaced by the fixture version, with
  `insufficient_evidence: true` on the record.
- Keep the existing PII stripper in the path for every call. Test it.

**Acceptance.** With a key set and `PATHFOLIO_LLM_TASKS=extract,suggest,stories`,
`smoke_test.py` passes and every payload reports `drafted_by: "llm"`. With the key removed or
`PATHFOLIO_FIXTURE_MODE=true`, the same test passes reporting `"fixture"`. A planted prompt that
tries to invent an employer produces `insufficient_evidence` instead of a fake bullet.

**Effort.** Half a day. **Owner.** Platform DS.

### P0.2 Six real user-test records (three teammates, two profiles each)

**Why.** The judging rubric asks how the prototype was tested with potential users, and the interim
report claims user testing. Right now there is no log.

**What.** Run the sample profile and one hand-written profile with **no internship** (a student with
only coursework and a society role). Per session record: time to first track, whether they could
explain what the fit score meant, whether they accepted or rejected the planted bad rewrite, whether
they noticed the disclaimer, and one verbatim quote. Include at least one planted rewrite that adds a
metric nobody entered — if all three accept it, the fact-check in P0.1 is not working and the whole
human-in-the-loop claim is decorative.

**Acceptance.** Six records in `docs/user-testing.md` with dates and the planted-bullet outcome.
**Effort.** Two hours, not engineering. **Owner.** Business — user research.

### P0.3 Screenshots and a PDF for the deck

**Why.** `demo-script.md` assumes three visuals that do not exist yet.

**What.** Capture the track cards (three different numbers), a resume-scan panel with a failing six
point item, and a STAR story with a cap note visible. Save to `data/demo-output/` (gitignored) and
keep one printed PDF of the report as a projector-failure backup.

**Acceptance.** Three PNGs plus one PDF, all readable at projector size.
**Effort.** One hour. **Owner.** Business — PM.

### P0.4 A logged consent step

**Why.** `ETHICS_PDPO.md` promises a first-run Personal Information Collection Statement and the
Electronic Transactions Ordinance note mentions keeping a timestamped consent record. The notice
exists; the record does not.

**What.** A checkbox on the welcome screen ("I have read the notice") whose acceptance is stored on
the session (`consent: {accepted_at, version}`) and echoed in the export. No signature, no legal
overreach.

**Acceptance.** `GET /v1/export/...` includes the consent timestamp; deleting the session removes it.
**Effort.** Two hours. **Owner.** Business — product.

---

## P1 — high value, still demo-safe

### P1.1 Six track families instead of three

**Why.** The brief is "diversified job directions". Three families from one profile already proves
the mechanism, but breadth is the visible claim.

**What.** Add `engineering`, `finance`, `social_education` JSON files in `data/tracks/` with the same
shape as the existing three: `keywords`, `nace_weights`, `wef_rising`, `star_prompts`. The recommender
already scores every file it finds, so this is data work, not logic work — but verify the top three
still differ and remain sensible for the sample.

**Acceptance.** Six families score without error; the CityU sample still returns analytics first; a
new engineering-flavoured sample fixture returns engineering first.
**Effort.** Half a day (the hard part is writing credible keyword lists, not code). **Owner.** Recsys DS.

### P1.2 Cross-track transferability view

**Why.** This is the most defensible "innovation" on the rubric: the same experience read three ways.
No competitor in the comparison set does it.

**What.** On `/tracks`, for each experience, show which tracks it counts as evidence for, and which of
its bullets carry a keyword for each. Derive it from data already computed — do not add a model call.
Flag the mirror case too: a single experience that only ever supports one track is a concentration
risk worth naming.

**Acceptance.** Every experience appears with at least one track; a bullet with `sql` marks analytics
but not commercial; text matches the underlying scoring inputs byte for byte.
**Effort.** One day. **Owner.** Product + recsys.

### P1.3 Job-description paste

**Why.** Turns generic advice into advice for the job the student is actually applying to, which is
where the interim report says the value sits. FirstResume's whole pitch is per-posting tailoring.

**What.** A textarea on the track workspace. Extract keywords from the pasted JD (the same tokeniser,
plus stopword removal), recompute the keyword half of the resume scan against the JD instead of the
family bank, and append JD-specific questions to the strategy. Do not store the JD beyond the session.
Do not let the model invent requirements the pasted text does not contain.

**Acceptance.** Pasting a real graduate-analyst posting raises keyword hits on the sample profile;
pasting a marketing posting lowers analytics hits and raises commercial ones; nothing from the JD
appears in the export that was not in the pasted text.
**Effort.** One day. **Owner.** Recsys DS.

### P1.4 Server-side PDF

**Why.** Browser print works but produces inconsistent pagination, and "PDF output" is one of the
stated requirements.

**What.** Add a `/v1/export/{session}/{track}.pdf` route using Playwright's Chromium to render the
existing report route. Keep `window.print()` as the zero-dependency fallback.
**Acceptance.** A one-command PDF exists whose page count is stable across two runs.
**Effort.** Half a day plus a heavy dependency — only if the demo machine can install it.
**Owner.** Platform DS.

### P1.5 Session persistence

**Why.** A refresh currently discards a session that may hold ten accepted edits.

**What.** `localStorage` for the session id only; the API stays in-memory. Add a visible "start a new
session" that clears it, and keep the delete endpoint as the real removal.
**Acceptance.** A refresh keeps the accepted suggestions; deleting the session clears local storage.
**Effort.** Two hours. **Owner.** Platform DS.

---

## P2 — differentiators, if time allows

### P2.1 Scoring reliability note

**Why.** The sharpest question a judge can ask is "how do you know the scores mean anything". The
honest answer is a stated, bounded reliability claim.

**What.** Two teammates blind-score 12 STAR answers 1–5 by hand; report agreement with the engine
(percent exact, percent within one point) and list every case where they differed, with the reason.
Publish it as a short appendix, including the failures.

**Acceptance.** A one-page appendix with the raw 12-item table. No invented correlation coefficient.
**Effort.** Half a day. **Owner.** Business — PM + recsys DS.

### P2.2 Chinese UI

**Why.** English-only is a real barrier for some Hong Kong students, and `ETHICS_PDPO.md` already
admits it as a known gap.

**What.** Locale files plus a header toggle. Keep the exported artefact in the language the user chose.
**Acceptance.** Both locales render every screen; the PDF matches the toggle.
**Effort.** One day with a translator. **Owner.** Product.

### P2.3 Deployment

**Why.** "Feasibility" reads better with a URL than with a localhost demo.

**What.** Dockerfile for the API, static hosting for the built web app, an environment variable for the
API base URL. **A public deployment needs a real privacy review first** — the PICS says localhost.
**Acceptance.** A cold URL serves the sample flow end to end with fixture mode on.
**Effort.** Half a day plus review. **Owner.** Platform DS.

### P2.4 GitHub Actions

**Why.** The three verification commands in `README.md` are currently run by hand.

**What.** One workflow running the scoring tests, the API smoke test and `tsc --noEmit` on push.
**Acceptance.** The badge is green on a clean clone.
**Effort.** One hour. **Owner.** Platform DS.

---

## Explicitly out of scope

Do not add these, and say why if asked:

- **Ranking or filtering students for employers.** It inverts the ethical position the project is
  built on, and `ETHICS_PDPO.md` commits us to not serving employers.
- **Self-assessment psychometrics or personality tests.** Scope creep with a bias story attached;
  the NACE gap panel already makes the point from published research.
- **Live application tracking or auto-apply.** It would need the job board and the scraping we
  deliberately excluded, and it moves the product into decisions it should not make.
- **Leaderboards or percentile comparisons between users.** Requires holding peer data, which breaks
  data minimisation for a feature nobody asked for.

## Order of work if only one more day exists

P0.1 (wire the LLM calls) → P0.2 (six test records) → P0.3 (screenshots) → P1.2 (transferability view).

Reason: P0.1 removes the largest credibility risk, P0.2 and P0.3 are cheap, and P1.2 is the only item
that changes what the product *is* rather than how much of it exists.
