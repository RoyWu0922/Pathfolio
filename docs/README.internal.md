# Pathfolio

Personalised **multi-track interview strategy and graduate portfolio** agent.

This repository is the hackathon project for track **4. Future Work & Enterprises**. The product helps fresh graduates turn one set of academic and campus experiences into **two or three distinct job-search directions**, each with scored fit, a 7-second resume scan, a STAR story bank, a structured interview plan, and an HTML/PDF takeaway pack.

**Agent / UI language: English.**  
**Status (2026-10-09): MVP implemented and verified. See "Run it" below.**

## Run it

Two processes. The API first, then the web app.

```bash
# terminal 1 — API
cd apps/api
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000

# terminal 2 — web
cd apps/web
npm install
npx vite --host 127.0.0.1 --port 5180
```

Open <http://127.0.0.1:5180> and press **Load the CityU sample**. No API key is needed:
with `PATHFOLIO_FIXTURE_MODE` unset or `true`, drafting comes from `data/samples/fixtures_llm.json`.

> Ports: the web app uses **5180** (pinned with `strictPort`) and the API uses **8000**.
> Do not move the web app into 5173–5175 — that range belongs to other projects on this machine.


To turn on real LLM drafting, copy `apps/api/.env.example` to `.env`, set `OPENAI_API_KEY`
(plus optional `OPENAI_BASE_URL` / `OPENAI_MODEL`), export `PATHFOLIO_FIXTURE_MODE=false`, and list the
tasks the model is allowed to draft:

```bash
export PATHFOLIO_LLM_TASKS=extract,suggest,stories,strategy,tracks,pick_tracks
```

Valid task names: `extract` (profile), `suggest` (resume rewrites), `stories` (STAR drafts),
`strategy` (interview questions), `tracks` (track wording), `pick_tracks` (which three of the scored
tracks to show). Anything not listed uses the offline
fixtures, and every response says which one it used (`drafted_by`). With no key, or if a call fails,
the route silently falls back — the demo cannot break because of the model. `/healthz` reports
`llm_tasks` and `llm_last_errors` so you can see which mode you are actually in.

### Share it with someone on the same network

The dev server binds every interface (`server.host: true` in `apps/web/vite.config.ts`), so a
classmate on the same network opens the app at `http://<your-lan-ip>:5180` — find your address with
`ipconfig getifaddr en0`.

Port 8000 stays bound to `127.0.0.1` on purpose: Vite proxies `/v1` and `/healthz` to it server-side,
so the API is never reachable from outside this machine. Nothing else needs configuring; if the macOS
firewall is on, allow incoming connections for `node`.

Three things to know: the Mac has to stay awake, both machines must be on the same network, and some
campus or dorm WiFi isolates clients from each other — in that case use a phone hotspot, or put the
app behind a tunnel. Anyone on that network can open the page, and there is no login.

### When the LAN route is blocked (isolated WiFi, a classmate elsewhere)

`cloudflared` is already installed on this machine, so one command publishes the app on a public
HTTPS address without exposing the API — the tunnel points at 5180, and Vite keeps forwarding `/v1`
to the local API:

```bash
cloudflared tunnel --url http://127.0.0.1:5180 --no-autoupdate
```

The quick tunnel prints a `https://<random>.trycloudflare.com` URL to share. Two things follow from
that: the address is random and dies with the process, and anyone holding the link can open the app.
For a long-lived named tunnel, put Cloudflare Access in front of it.

Vite 5.4.12+ checks the `Host` header and answers `403 Blocked request` for anything not in
`server.allowedHosts`; that is already set to `.trycloudflare.com` in `vite.config.ts`.

### Deployed copy (works without any laptop)

Running on the Windows server: **http://106.55.39.223:8080** — one process (FastAPI serving the built
frontend) under the `PathfolioGateway` scheduled task, plus a `PathfolioTunnel` task holding a
Cloudflare quick tunnel for an HTTPS address. Both start at boot.

Not under `afsgtool.top`: that domain has no ICP filing, so mainland Chinese networks get a DNSPod
block page (port 80) or a TLS reset (port 443) for it. Requests straight to the IP are unaffected.

### Verify yourself

```bash
python3 packages/scoring/tests/test_scoring.py   # 29 scoring tests
python3 apps/api/smoke_test.py                   # 35 checks: end-to-end API walk, fixtures
python3 apps/api/test_llm.py                     # 15 tests: LLM switches, redaction, fact-check
python3 apps/api/test_llm_live.py                # 25 checks: live LLM link against a mock model server
cd apps/web && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

### What works today

Welcome → profile (sample or paste, then add/duplicate/reorder/remove experiences and manage skills as
chips) → three scored tracks → per-track workspace (overview, resume skim with the six data points and
accept/edit/dismiss rewrites, STAR stories scored 1–5, likely questions, seven-day plan) → printable
report → delete session.

The three tracks on the page are **chosen, not fixed**: every direction in `data/tracks/` (eight of
them, from data analysis to finance, HR, delivery and public sector) is scored against the profile
first, the top five become a shortlist, and the model picks three of them and says why. With no key
the local ranking decides — same three, same numbers, no model involved. The model never sees a
scoring formula and never returns a number; it only chooses and explains. `/v1/tracks/recommend`
reports `picked_by: "llm" | "ranking"`, `considered`, and the `shortlist` it chose from.

Four sample profiles ship in `data/samples/`, and `GET /v1/samples` lists them for the UI:
`cityu_graduate` (business, spans all three of the original directions), `cityu_engineer` (computing),
`cityu_marketer` (marketing) and `cityu_researcher` (public policy and sociology). Load a different one
and the three tracks change with it — that is the fastest way to see the picker working. The offline
rewrite and STAR draft sets were written for `cityu_graduate`, so the other samples need a model key
for drafts; scoring, scanning and planning work for all four with no key at all.

The whole interface is **bilingual (English / 繁體中文)** — toggle with the button in the top-right; the
choice is remembered in `localStorage`. Interface copy only: the track names, drafted rewrites, STAR
text and interview questions come from the data layer and stay English by design, because they are the
material you take to an English-language interview. Sample data is CityU-shaped; your own content is
whatever language you type.

The profile editor is fully extendable: every field is editable, experiences and bullets can be added
or removed, and a banner lists what is still worth filling in before you score. Nothing is locked to
the sample's shape.

The language model drafts wording. Every number comes from `packages/scoring`.


## Read this first if you are a new model

1. `docs/HANDOFF.md` — what to build, in what order, what not to touch.
2. `docs/ROADMAP.md` — what to add next, prioritised by judge value, with acceptance tests.
3. `docs/PLAN.md` — product, architecture, pages, API, prompts, MVP cut.
4. `docs/QUANT_MODELS.md` — scoring formulas and the sources they rest on.
5. `docs/DATA_MODELS.md` — TypeScript/JSON schemas.
6. `docs/ETHICS_PDPO.md` — PDPO + PCPD AI rules the demo must show.
7. `docs/DEMO_SCRIPT.md` — 5–7 minute judging demo.
8. `docs/INTERIM_REPORT_ANSWERS.md` — answers for the 23 interim questions.
9. `docs/SOURCES.md` — numbered citations. Do not invent new numbers.

Source interim report: *A Platform for Designing Personalised Interview Strategies for Fresh Graduates* (`~/.hermes/profiles/hoshino/attachments/interim report modified.docx`).

## What this is not

- Not a FirstResume.clone (no live job board, no auto-apply, no paid tiers).
- Not a hiring tool. It does not score candidates for employers.
- Not a guarantee of employment.
- Not a ChatGPT wrapper with a generic question bank.

## Suggested layout after implementation (do not invent a different tree)

```
Hackathon_Project/
  apps/web/                 Vite + React + TypeScript
  apps/api/                 FastAPI (Python 3.11) + prompts/ + fixtures
  packages/scoring/         Pure-Python scoring, no LLM calls
  data/samples/             Demo graduate profile, scoring cases, offline fixtures
  data/tracks/              Track skill banks, aliases, WEF rising skills
  docs/                     Planning pack
```

## Team (from the interim report)

Four people: two Business, two Data Science.

| Role | Owns |
| --- | --- |
| Business — PM / analyst | Problem framing, demo narrative, interim write-up, university-client story |
| Business — user research / product | Copy, onboarding, accept/reject UX, ethics screens |
| Data Science — recommendation | Track generation, scoring engine, skill banks |
| Data Science — platform | FastAPI, LLM JSON contracts, HTML/PDF export, integration |
