# Pathfolio v0.1.0

A career-strategy agent for fresh graduates: one profile in, three scored career directions out.

## What it does

- **Picks three directions from eight** — data, product, commercial, finance, user research, HR,
  technology delivery, public sector. Everything is scored locally, the highest five go to the
  model as a shortlist, and the model picks three and explains why.
- **Scores every direction with a published formula** — skill overlap 40%, NACE coverage 30%,
  evidence transfer 20%, WEF rising-skill alignment 10%. The model never returns a number.
- **Checks the résumé** against the six data points recruiters read in the first seconds.
- **Drafts rewrites, STAR stories, questions and a seven-day plan**, each grounded in what the
  student actually entered, and each accepted, edited or discarded by hand.
- **Exports a printable report** of what was accepted.
- **Runs in English or Chinese**, and runs with no API key at all.

## In this build

- 8-direction library, 4 sample profiles, dynamic track selection with a visible "how these three
  were picked" explanation.
- **Bring your own key**: the AI button in the header takes any OpenAI-compatible key, stored in
  the browser and sent per-request. Nothing is written to a session or a log.
- Fact-check gate: a draft containing a number or employer that is not in the profile is rejected
  and shown as rejected.
- Whole-token keyword matching, so `hr` no longer matches "three".
- Bilingual not-found page.

## Run it

```bash
cd apps/api && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000

cd apps/web && npm install && npx vite --host 127.0.0.1 --port 5180
```

Open <http://127.0.0.1:5180> and press **Load the CityU sample**.

## Verify

```bash
python3 packages/scoring/tests/test_scoring.py   # 29 scoring tests
python3 apps/api/smoke_test.py                   # 35 API checks
python3 apps/api/test_llm.py                     # 15 switch / redaction / fact-check tests
python3 apps/api/test_llm_live.py                # 25 checks against a mock model server
cd apps/web && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

## What it does not do

No auto-application, no leaderboards, no psychometrics, no employer-side screening. A fit score
measures how complete and structured the material is, not the probability of an offer.

## Assets

- `pathfolio-v0.1.0-source.zip` — the repository at this tag (85 files, no dependencies).
- `pathfolio-v0.1.0-web-dist.zip` — the built frontend, for serving static files.
