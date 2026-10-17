# Roadmap status

## P0.7 — Align the build with the interim report and the competitor review — DONE (2026-10-17)

Two source documents arrived after the build: the interim progress report and a review of a
competing AI résumé/interview platform. Where they disagreed with the code, the code was right and
the documents were corrected.

**The report called two things future work; one is already done.** Multilingual support is listed
there as a future enhancement and ships now — the interface runs in English and Traditional
Chinese. The report's scope boundaries (no employment guarantee, no replacement for career
counsellors, no recruitment decisions) already match `docs/ETHICS_PDPO.md` and the on-screen
disclaimer.

**Still not built, and now stated as such:** mock interview simulation, progress tracking, and
integration with university career services. These are named in the README's limitations instead
of being implied away.

**The competitor review's five failure modes** — keyword stuffing, fabricated metrics, rigid
templates, free-tier caps, niche-field blind spots — are mapped in
`docs/COMPETITIVE_POSITIONING.md`. Each row records both what this project does differently and
what it still does not solve, including the honest one: eight curated directions are not every
career.

**Stale ethics copy fixed.** `ETHICS_PDPO.md` still described Chinese as a post-MVP accessibility
item and claimed no key would ever reach the browser. Both stopped being true with the visitor-key
panel; the PDPO table now describes a browser-stored key with a per-request lifetime, and the
accessibility section says bilingual is shipped while Chinese-language *drafts* remain future work.

## P0.6 — Four sample profiles, and two scoring bugs they exposed — DONE (2026-10-10)

`data/samples/` holds four CityU-shaped profiles. `GET /v1/samples` lists them, `POST
/v1/profile/parse` takes `use_sample: true` (default) or a sample id, and the profile page shows all
four as buttons plus a switch row once one is loaded.

| sample | background | top three |
| --- | --- | --- |
| `cityu_graduate` | BBA, four cross-functional experiences | analytics 66 · commercial 64 · product_ops 63 |
| `cityu_engineer` | BSc Computer Science | tech_delivery 68 · analytics 42 · user_research 40 |
| `cityu_marketer` | BBA Marketing | commercial 69 · analytics 38 · finance_audit 38 |
| `cityu_researcher` | BSocSc Public Policy | user_research 54 · public_social 49 · hr_people 45 |

Building them exposed two real bugs, both now fixed:

1. **Substring keyword matching was corrupting scores.** `evidence_transfer` and the resume-scan
   keyword count used `kw in text`, so `hr` matched "three", `api` matched "rapid" and `ab` matched
   "table" — which made `hr_people` look relevant to *any* profile. Replaced with a whole-token regex
   (`(?<![a-z0-9])kw(?:s|es)?(?![a-z0-9])`) that still accepts plurals. Direction scores moved by up
   to 8 points; the table above is post-fix.
2. **The picker ranked direction-blind components.** NACE coverage, WEF alignment and most of evidence
   transfer describe the profile, not the direction, so a zero-overlap direction still collected a base
   score near 40 and could outrank a relevant one (an engineer profile had `hr_people` second).
   Selection now orders by "touches something the profile actually has" first, then score, then matched
   skills, then id.

Offline fixtures were rewritten against the new default sample and are now **scoped**: `session.sample_id`
records what was loaded, and the rewrite/STAR sets apply only to `cityu_graduate`. For any other sample
(or a pasted CV) the model fills the drafts, and with no key those lists are simply empty instead of
showing a stranger's experiences.

## P0.5 — Tracks are chosen from a library, not fixed — DONE (2026-10-10)

Master's rule: *the three tracks must follow what was filled in, with the AI judging which three fit
and scoring them.* The scoring half of that is unchanged on purpose: an LLM that reports its own
number makes a score nobody can defend to a judge, so the split is that the engine scores and the
model only chooses and explains.

**Library** — `data/tracks/` went from 3 directions to 8: analytics, product_ops, commercial,
finance_audit, user_research, hr_people, tech_delivery, public_social. `_all_tracks()` now reads the
directory and skips the two reference files (`wef_rising.json`, `aliases.json`), so adding a direction
is a new json file and nothing else. Each direction carries `keywords`, `nace_weights`, `wef_rising`
and `star_prompts`.

**Selection** — `POST /v1/tracks/recommend` scores every direction, sorts by
`(-track_fit, -len(matched_skills), id)` so a tie never depends on directory order, keeps the top 5
as a shortlist, and picks the best 3 locally. If the new `pick_tracks` task is enabled, the shortlist
plus the profile go to the model, which returns three ids and a one-sentence `why` each; a `why` that
fails the fact-check is dropped, and anything other than exactly three valid ids falls back to the
local top three. The response reports `picked_by: "llm" | "ranking"`, `considered` and `shortlist`.

**What the model still cannot do** — see a formula, compute a score, or introduce a direction that is
not in the library. Every number is still `packages/scoring`.

**UI** — the tracks page gained a "How these three were picked" block (`considered` count, which half
decided, and the explanation) and a "Why this one" line per card when the model supplied one, both
bilingual.

**Tests** — `smoke_test.py` had asserted that the three fit scores all differ; that assertion is
false once the library is wider than three, because two unrelated directions can genuinely tie. It was
replaced with range + `picked_by == "ranking"` + `considered >= 3` + still sorted. `test_llm_live.py`
gained a `pick_tracks` branch in the mock server (returns the first two candidates plus the last, so
the test proves the model's choice is what ships) and three checks.

## P0.1 — Wire the remaining four LLM calls, with a per-task switch — DONE (2026-10-09)

Implemented as specified. What actually shipped:

**Switches** (`apps/api/llm.py`)

- `PATHFOLIO_FIXTURE_MODE=true` is the master off switch; nothing calls a model.
- `PATHFOLIO_LLM_TASKS` lists the tasks allowed to call the model. Valid names:
  `extract,suggest,stories,strategy,tracks`. Empty/unset keeps the previous behaviour
  (only `extract`), so an existing `.env` cannot silently start spending tokens.
- `task_enabled(task)` requires all three: master switch off, an API key present, the task listed.
- `/healthz` now reports `llm_tasks` (per-task `llm`/`fixture`) and `llm_last_errors` (why the last
  attempt for a task fell back), so a silent fixture mode is diagnosable instead of mysterious.

**Routes wired**

| Route | Task | On model success | On any failure |
| --- | --- | --- | --- |
| `POST /v1/profile/parse` | `extract` | profile from the model | sample fixture, `drafted_by: "fixture"` |
| `POST /v1/tracks/recommend` | `tracks` | rationale + positioning per track | fixture copy; **scores never change** |
| `POST /v1/resume/suggest` | `suggest` | rewrite accepted if grounded | per-item `insufficient_evidence` + `grounding_problems` |
| `POST /v1/stories/generate` | `stories` | S/T/A/R drafted per story | fixture story, flagged; scoring still runs |
| `POST /v1/strategy` | `strategy` | questions from the model | fixture question bank |

Every response carries `drafted_by: "llm" | "fixture"`, and each individual item does too, so the UI
can say who wrote what rather than implying everything is generated.

**Fact-check** (`check_grounded`, `check_story_grounded`)

Two kinds of fabrication are refused: a number absent from the profile, and an organisation
introduced after "at". Track keywords are explicitly allowed, because naming the target role's
tooling is legitimate; the user still confirms every accepted line.

The number check compares digits against both digits and spelled-out words in the profile
(`three product squads` → `3`). Without that, an honest rewrite saying "6 percent" against a profile
that says "six hours" is rejected — which is exactly what happened on the first live run.

**Never breaks the demo**: with no key, or with `FAIL_JSON`-style garbage from the model, every route
returns its fixture payload. Verified.

**Tests**

```bash
python3 apps/api/test_llm.py        # 15 tests: switches, redaction, fact-check
python3 apps/api/test_llm_live.py   # 22 checks against a mock OpenAI-compatible server
```

`test_llm_live.py` starts `apps/api/mock_llm_server.py` (a fake `/v1/chat/completions`), points the
API at it with `OPENAI_BASE_URL`, and asserts: tasks report `llm`, an invented metric is rejected with
the offending number named, too-few questions fall back to the fixture bank, garbage JSON falls back
without a 500, and no name/email/phone ever appears in a request the model received.

**UI**

Workspace shows a drafting-source line and per-item badges; rejected suggestions show *which* invented
figure was refused so the user can add it to the profile if it is true. Tracks shows the source badge
for the track wording. Numbers are always labelled as computed locally.

**Still open from P0**: the demo screenshots (P0.3) and the consent record (P0.4). The user-test
records (P0.2) need humans.
