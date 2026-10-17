# Evaluation protocol

The interim report commits to four measures: **user satisfaction**, **recommendation relevance**,
**usability** and **self-reported interview confidence**. This file says how each would be measured,
what exists today, and what does not. It exists so the gap is visible rather than implied.

## Status

| Measure | Instrument | Status |
| --- | --- | --- |
| Deterministic correctness | 29 scoring tests, 35 API checks, 15 model-switch tests, 25 mock-server checks | **Run, passing** |
| Score reproducibility | Same profile scored twice must match; four samples re-scored each release | **Run, passing** |
| Recommendation relevance | Participant rates the three surfaced directions 1–5 ("this fits my background") | **Not run** |
| Usability | System Usability Scale (SUS), 10 items, after the guided flow | **Not run** |
| Satisfaction | 3 items: would use again / would recommend / overall 1–5 | **Not run** |
| Confidence | Two-item self-report before and after the seven-day plan | **Not run** |

Anything in the bottom four rows is a plan. The README says so; do not report it as a finding.

## Protocol (next session)

**Participants.** Five to eight final-year students or recent graduates, mixed disciplines (at least
two non-business). No one who worked on the project. Recruit through the course cohort.

**Session, 30 minutes, moderated but scripted.**

1. **Before.** Two confidence items: "How prepared do you feel for a behavioural interview?" and
   "How well can you explain your experience in STAR form?" 1–5 each. No coaching beforehand.
2. **Task A — sample.** Load `cityu_graduate`, read the three directions and their explanations,
   and say aloud whether the top direction fits. Record relevance 1–5 and one sentence of why.
3. **Task B — own profile.** Enter (or paste) their own material, run the flow to the workspace.
   Observe, do not help. Note every point where they hesitate for more than five seconds, and every
   label they misread.
4. **Task C — one rewrite.** Accept or dismiss one suggestion and explain the decision. This tests
   whether the human-in-the-loop gate is understood, not merely present.
5. **After.** SUS (10 items), the three satisfaction items, and the same two confidence items.

**Analysis.** Report SUS as a single score with the standard adjective rating; report relevance and
satisfaction as medians with ranges, not means — five participants do not justify a mean. Quote the
hesitation points verbatim; they are the most actionable output.

## What counts as a failure

Written down in advance so the result cannot be rationalised afterwards:

- A participant cannot tell which direction was chosen or why.
- A participant believes the score predicts an offer.
- A participant accepts a rewrite containing a fact they did not enter.
- SUS below 68 (the industry average) with no single obvious cause.
- Median relevance at or below 3 for participants whose own discipline is in the eight-track library.

## Where results would live

`docs/EVALUATION_RESULTS.md`, one section per session, plus a summary table. The file does not exist
yet because no session has been run. When it does, the README's evaluation section links to it.
