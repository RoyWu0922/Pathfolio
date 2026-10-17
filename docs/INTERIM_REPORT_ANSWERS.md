# Interim report answers (draft)

Use these as the team’s working answers to the 23 questions. They match the locked Pathfolio plan. Numbers must keep their citations from `SOURCES.md`. Do not inflate sample-size claims — the team still needs to record its own survey n if the original report asserted surveys.

Product name in the write-up: **Pathfolio**. One-line subtitle: *A platform for personalised, multi-track interview strategies for fresh graduates.*

## Problem and scope

**1. What specific problem or pain point is your project addressing?**  
Fresh graduates often hold a degree and some campus evidence but cannot turn that evidence into role-specific, structured interview answers. They reuse one generic story for every posting, miss what recruiters actually skim on a resume, and receive one-size-fits-all advice. The pain is not “lack of questions”; it is lack of a personalised strategy that maps one life onto several plausible job directions.

**2. What research have you conducted?**  
Literature and competitor review (university career pages, STAR method, NACE competencies, FirstResume and generic GPT chatbots). Labour-market figures: JIJIS via SCMP / Macao News — 30,798 graduate-level vacancies in 2025, 55% below 68,728 in 2024, below 63,543 in 2021; average graduate monthly salary HK$20,961 (+0.5%).[4][5] HKU CEDARS GES 2025 for context on how “employment rate” is defined.[16] NACE student vs employer proficiency gaps.[7] WEF Future of Jobs 2025 skill disruption (39% by 2030).[12][13] Recruiter skim behaviour from TheLadders eye-tracking (≈6 s in 2012; 7.4 s in 2018).[10][11] Primary research claimed in the original interim (student discussions / prototype comments) should be footnoted with the team’s actual n; do not invent a sample size here.

**3. Why is this problem significant? Who does it affect?**  
Entry-level hiring in Hong Kong tightened sharply in 2025 while headline unemployment stayed around 3.8%.[4][5] Graduates lose offers they might have reached if they had presented evidence in the form employers already use (structured behavioural answers, skim-readable CVs). Universities are measured on graduate outcomes. Employers waste interviews on under-prepared but capable candidates. Families and first-generation students are hit hardest when paid coaching is the alternative.

**4. What existing solutions are available and how do they fall short?**  
University workshops and PDF question banks are generic. Professional coaches are expensive. ChatGPT produces fluent answers that are not scored and often ungrounded. FirstResume automates per-job tailoring and mock interviews but scores are opaque, the product is one-job-at-a-time, full interview practice sits behind a paid Max plan, and it does not teach a published rubric.[1][2][3] None of these start from “one graduate, several honest directions” or show how a number was calculated.

## Proposed solution

**5. Primary objectives**  
(1) Generate two or three diversified tracks from one profile. (2) Score track fit, resume skim-readiness, and STAR completeness with published formulas. (3) Draft — never silently publish — interview stories and a 7-day plan. (4) Export an HTML/PDF pack the student owns. (5) Keep a human in the loop and stay inside PDPO.

**6. Boundaries**  
Not a job guarantee. Not a career counsellor. Not a recruitment agency. Not an ATS. Not an employer scoring tool. No live job board, no auto-apply, no voice/video interview in the hackathon MVP. No use of user data to train models.

**7. Assumptions**  
Graduates will try a digital tool and will enter reasonably accurate experiences. Interview performance still matters in graduate hiring. Personalised, structured guidance beats generic question lists. Users will judge drafts rather than paste them unedited. LLM output can be constrained with JSON schemas and fact-check rules, but hallucination risk never hits zero.

**8. Target audience**  
Final-year undergraduates, recent graduates, internship applicants, graduate-trainee applicants — starting with Hong Kong / English-medium universities (CityU-shaped demo).

**9. Client (who would pay)**  
University career centres and faculties buying a cohort licence. Secondary: a low-cost student plan after the hackathon. The hackathon itself has no paying client; the CityU / hackathon organisers are the immediate audience.

**10. How needs were gathered (including testing)**  
Original interim: surveys, informal interviews, prototype comments preferring customised recommendations over static banks. For the hackathon demo: at least five think-alouds with classmates using the CityU sample plus one empty-internship profile (accessibility). Log: task success, time-to-first-track, whether users noticed the disclaimer, whether they rejected a hallucinated bullet (plant one on purpose in testing).

## Teamwork

**11. Structure and roles**  
Four members: two Business, two Data Science. Business PM/analyst — framing, market, demo script, interim text. Business product/research — UX copy, accept/reject flow, ethics screens. DS recommendation — track banks, `packages/scoring`, tests. DS platform — FastAPI, LLM JSON, integration, export.

**12. Communication**  
Weekly stand-up, shared GitHub, one spec folder (`docs/`). Decisions that change a formula are pull-requested against `QUANT_MODELS.md` so numbers stay cited.

## Progress

**13. Achieved so far**  
Problem definition, literature and competitor review, scoring research with sources, system design, user journey, ethics mapping, this specification pack (2026-10-09). Application code not yet started — that is the next model’s job.

**14. Currently working on**  
Handing a buildable spec to implementation: scaffold web + API, scoring library, sample profile.

**15. Immediate next steps**  
S0–S4 in `PLAN.md` (runnable app, three scored tracks on the sample). Then STAR, strategy, print, PICS.

**16. How we will evaluate success**  
User: SUS or a 5-item post-task (clarity of scores, relevance of tracks, trust in drafts, willingness to export). Technical: scoring unit tests pinned; LLM JSON validation rate; time-to-first-track < 60 s on sample. Demo: judges complete the four clicks in `DEMO_SCRIPT.md`. We will **not** use callback rate as a hackathon metric (no live applications).

## Challenges

**17. Challenges so far, and responses**  
Diverse majors → three track families plus transparent Jaccard, not a black-box embedding. Personalisation without invention → `insufficient_evidence` flag and accept/reject. Plan-book vs FirstResume temptation → explicit non-goals (no job board).

**18. Upcoming challenges**  
LLM hallucination, small user-test n, PDPO if anyone deploys beyond localhost, scoring that looks “too low” and discourages users. Mitigations: fixture mode, planted-hallucination test, session wipe, copy that frames scores as structure not worth.

## Resources

**19. Used so far**  
Academic and public reports listed in `SOURCES.md`; Figma/GitHub/VS Code/Python as named in the original interim; this Hermes planning pass for formulas and FirstResume UX notes.

**20. Still lacking**  
A real LLM key in the implementation environment; more than one sample profile (non-business major); recruiter guest feedback; if deployed, cloud credits and a processor agreement.

## Learnings

**21. Learned so far**  
Interview prep is strategy plus evidence, not a question generator. Structured answers and skim-readable CVs have decades of I-O and recruiter-behaviour research behind them; GenAI is the adapter, not the science. Business + DS only works if numbers live in code with tests.

**22. How understanding evolved**  
Started as “generate interview questions”. Research pushed the product to multi-track portfolios, published scores, and an export the student keeps. FirstResume confirmed the per-job workspace pattern and the accept/reject diff; it also showed what not to copy (opaque 87, ATS 75% claim, auto-hunt).

**23. Other issues**  
English-only agent is a hackathon constraint and a barrier for some HK students — listed on `/ethics` as known. NACE Equity & Inclusion competency is omitted from numeric TrackFit because NACE itself flags review risk; stories may still use it.[6]
