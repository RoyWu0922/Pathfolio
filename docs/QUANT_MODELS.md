# Quantitative models

All scores are computed in `packages/scoring`. The LLM must not emit these numbers.

Citation ids match `docs/SOURCES.md`. Quote figures exactly as the source states them. Do not round a source number to look cleaner.

## 0. Honesty rules

- These models measure **preparation structure**, not job performance and not hire probability.
- Do not display Schmidt–Hunter validity coefficients in the product as if they were Pathfolio’s accuracy. They are background for *why structured STAR answers matter*; we did not re-run that meta-analysis in this repo.
- Do not use FirstResume’s “75% of applications filtered by ATS” or “10X interview rate” in our UI.[1] Those are competitor marketing claims, not our metrics.
- Every on-screen number must have a “How this is calculated” disclosure linking here.

## 1. Inputs

After parse, a `Profile` has:

- `skills: str[]` (lowercased, deduped)
- `experiences: { title, org, start, end, bullets[], tags[] }[]`
- `education: { school, degree, field, end_year }[]`
- `nace_evidence: Record<NaceId, Evidence[]>` where Evidence is an experience id or a bullet

A `Track` has `keywords[]`, `nace_weights`, `wef_rising[]`.

Tokenise with a simple regex `[a-z0-9+#]+`. Keep `c++`, `c#`, `sql`. Map aliases in `data/tracks/aliases.json` (`js` → `javascript`, `ms excel` → `excel`).

## 2. TrackFitScore ∈ [0, 100]

```
TrackFit = 100 * (
    0.40 * SkillOverlap
  + 0.30 * NACECoverage
  + 0.20 * EvidenceTransfer
  + 0.10 * WEFAlign
)
```

Round to 1 decimal for storage, integer for the ring UI.

### 2.1 SkillOverlap ∈ [0, 1]

Jaccard between profile skill set **P** and track keyword set **K**:

```
SkillOverlap = |P ∩ K| / |P ∪ K|
```

If both empty, 0. Do not use embeddings in MVP (too opaque for judges).

### 2.2 NACECoverage ∈ [0, 1]

NACE defines eight career-readiness competencies: Career & Self-Development, Communication, Critical Thinking, Equity & Inclusion, Leadership, Professionalism, Teamwork, Technology.[6]

**Product uses seven in scoring.** Drop Equity & Inclusion from the numeric score: NACE currently flags that competency as under legal review in some jurisdictions.[6] Still allow a story to be tagged with it; it just does not enter TrackFit.

For the seven scored competencies:

```
raw_c = 0 if no mapped evidence
      = min(5, 1 + n_bullets_c + (2 if a STAR story exists for c else 0))
NACECoverage = mean_c (raw_c / 5)
```

`nace_weights` on the track **do not** change this mean in MVP (keep it explainable). They may be used later to rank which stories to generate first.

NACE 2024/25 perception gap, for copy and for the gap panel — not for TrackFit:[7]

| Competency | Students: important | Employers: important | Students: proficient | Employers: proficient |
| --- | --- | --- | --- | --- |
| Communication | 96.3% | 96.1% | 78.1% | 53.5% |
| Critical Thinking | 94.0% | 96.1% | 80.8% | 55.9% |
| Teamwork | 90.5% | 93.9% | 83.5% | 81.5% |
| Career & Self-Development | 87.8% | 65.6% | 61.5% | 43.2% |
| Professionalism | 88.9% | 89.4% | 79.7% | 50.3% |
| Leadership | 84.6% | 45.0% | 66.0% | 31.0% |
| Technology | 77.9% | 71.7% | 60.5% | 72.0% |
| Equity & Inclusion | 78.3% | 70.0% | 79.5% | 63.3% |

Show the user: “Employers in NACE’s Job Outlook 2025 rated new-grad proficiency in communication at 53.5% vs students’ 78.1%. Your stories for Communication: n.”[7]

### 2.3 EvidenceTransfer ∈ [0, 1]

```
EvidenceTransfer = n_experiences_with_≥1_track_keyword_in_title_or_bullets
                 / max(1, n_experiences)
```

Campus clubs count. Empty profile → 0.

### 2.4 WEFAlign ∈ [0, 1]

WEF Future of Jobs 2025: employers expect **39%** of workers’ core skills to change by 2030 (down from 44% in 2023).[12][13] Fastest-rising skill groups named in the report: AI and big data; networks and cybersecurity; technological literacy; creative thinking; resilience, flexibility and agility; curiosity and lifelong learning; then leadership and social influence, talent management, analytical thinking, environmental stewardship.[12]

Map those ten labels to keyword lists in `data/tracks/wef_rising.json`.

```
WEFAlign = |profile skills that hit ≥1 rising group| / max(1, |profile skills|)
```

Capped at 1.

## 3. ResumeScanScore ∈ [0, 100]

Grounded in TheLadders eye-tracking: recruiters spent **about 6 seconds** on an initial fit/no-fit pass; **almost 80%** of review time sat on six data points — name, current title/company, previous title/company, current dates, previous dates, education. Beyond that they scanned keywords. Professionally rewritten resumes scored 6.2 vs 3.9 on a 1–7 usability Likert (60% improvement).[10] A 2018 update reported **7.4 seconds** for the initial skim.[11]

We do **not** simulate eyeballs. We check whether those six points exist, whether track keywords appear, and whether layout is skim-friendly.

```
ResumeScan = SixPoint + Keyword + Layout
SixPoint  ∈ [0, 60]   # 10 each
Keyword   ∈ [0, 25]
Layout    ∈ [0, 15]
```

### 3.1 SixPoint (10 each)

1. Name present (client-side; API sees `CANDIDATE` but the flag is true if the session profile has a name).
2. Most recent title present.
3. Most recent organisation present.
4. Most recent start and end (or “Present”) present.
5. A previous role **or** an explicit campus/project role if only one experience exists.
6. Education: school + degree.

Missing dates cost the full 10 for item 4. “2024–2025” is enough.

### 3.2 Keyword ∈ [0, 25]

```
hits = |track.keywords present in resume text|
Keyword = 25 * min(1, hits / max(5, 0.5 * |track.keywords|))
```

### 3.3 Layout ∈ [0, 15]

Start at 15. Subtract (floor 0):

- −5 if any bullet > 40 words
- −5 if zero bullets
- −3 if section headers missing (Experience / Education / Skills)
- −5 if a photo URL is present (Ladders: pictures pulled gaze off the data)[10]

MVP resume is structured JSON rendered to a single column — multi-column penalty is unused until free-form PDF upload exists.

## 4. STARScore ∈ {1,2,3,4,5}

STAR = Situation, Task, Action, Result. UK National Careers Service definition.[8] DDI documents STAR as a behavioural-interview structure (Situation/Task, Action, Result).[17] MIT CAPD time guide for *spoken* answers: Situation **20%**, Task **10%**, Action **60%**, Result **10%**; Action uses **I**; Result should be quantified.[9]

ACXPA describes a 1–5 competency rubric used with STAR (1 = no relevant example … 5 = exceptional with strategic thinking).[18] We operationalise that rubric so two runs of the same text get the same integer.

### 4.1 Completeness points (integer 0–5, then clamp to 1–5 if any text exists)

```
s = 1 if Situation has ≥ 8 words and a time or place cue else 0
t = 1 if Task has a first-person obligation cue (I / my role / I was asked) else 0
a = 1 if Action has ≥ 2 action verbs else 0
r = 1 if Result is non-empty else 0
q = 1 if Result contains a digit or a percent or one of {increased, decreased, saved, reduced, grew} else 0
base = s+t+a+r+q          # 0..5
```

If the concatenated story has ≥ 20 words and base == 0, set base = 1 (there is an attempt).

### 4.2 Caps (apply after base)

- If Action word share < 0.35, `score = min(score, 3)` (MIT wants Action to dominate; 35% is the pass mark so a tight but clear answer is not punished).[9]
- If the Action field has no first-person singular (`\bI\b`) and has `\bwe\b`, `score = min(score, 2)`.[9][18]
- If Result empty, `score = min(score, 3)`.

### 4.3 Diagnostics (shown, not mixed into TrackFit)

Word-share of S/T/A/R vs 20/10/60/10. Report as four percentages. Do not fail the user for being off; coach toward Action.

Speaking-length hint (optional): 90–150 seconds ≈ 130–160 words. Flag “likely too long” above 220 words. This is a heuristic, not a cited lab number — label it `[heuristic]` in the UI.

## 5. InterviewReadiness ∈ [0, 100]

Shown on the track overview as a second ring.

```
InterviewReadiness = 0.35 * (mean(STARScore) / 5) * 100
                   + 0.25 * TrackFit
                   + 0.20 * ResumeScan
                   + 0.20 * StoryCoverage
StoryCoverage = n_scored_competencies_with_STAR / 7
```

If no stories yet, InterviewReadiness is still computed (story term = 0) so the page is not empty.

## 6. 7-day plan (not a score)

Deterministic template, filled with the lowest-scoring gaps:

| Day | Task |
| --- | --- |
| 1 | Fix SixPoint misses on the resume |
| 2 | Rewrite bullets that failed keyword overlap (accepted diffs only) |
| 3 | Draft STAR for the weakest NACE competency |
| 4 | Draft STAR for the second-weakest |
| 5 | Rehearse Action-heavy versions out loud (word-share check) |
| 6 | Answer the 8–12 generated questions in writing |
| 7 | Print the report; do a timed 4-question run |

LLM may rephrase the tasks; it may not drop Day 1–2 if SixPoint < 60.

## 7. Market context numbers (UI copy only)

Use these on the welcome page, each with a source link:

- JIJIS via SCMP / Macao News: 2025 graduate-level vacancies **30,798**, **55%** below 2024’s **68,728**, below 2021’s **63,543**. Average monthly graduate salary **HK$20,961**, **+0.5%** / **+HK$112** vs 2024.[4][5]
- HKU CEDARS GES 2025 (UGC-funded bachelor’s): **98.9%** “full employment” as employed/(employed+unemployed); destinations: employed **69.3%**, further study **27.8%**, unemployed **0.8%**, others **2.2%**; average monthly gross **HK$33,338**, median **HK$26,000**. n = 3,179, response rate 83.3%.[16] Do not present 98.9% as “everyone has a job”.
- WEF: **39%** of core skills change by 2030; **170 million** jobs created this decade, **92 million** displaced, net **+78 million** (global, not HK).[13]

## 8. Reference tests (pin these)

See `data/samples/scoring_cases.json` (to be created in S1). Example:

- Profile skills `{sql, python, excel}`, track keywords `{sql, python, tableau, statistics}` → Jaccard = 2/5 = 0.4.
- STAR with Situation+Task+Action+Result+digit, Action share 0.6, contains “I” → score 5.
- STAR with only Situation, 30 words → score 1.

## 9. What we are not modelling

- ATS parser compatibility (no PDF binary, no hidden text).
- Facial or vocal delivery.
- Fairness across gender/ethnicity (we do not collect those fields).
- Salary prediction.
