# Ethics, PDPO, and GenAI limits

Judges score **sustainability and ethics at 20%**. The tips page also requires: PDPO / Electronic Transactions Ordinance awareness, no overclaiming GenAI, accessibility, no “just a chatbot”.

## What we collect

Only what the scoring needs: education, experiences, skills, optional contact for the PDF header. No photos, no ID numbers, no gender, no ethnicity, no health, no voice, no video.

## PDPO mapping (Cap. 486)[14]

| DPP | Pathfolio behaviour |
| --- | --- |
| DPP1 Collection | First-run Personal Information Collection Statement: purpose = generate interview strategies and a portfolio for *this user*; voluntary; not required to give a real name. |
| DPP2 Accuracy / retention | User can edit every field. Session delete + “Download JSON then wipe”. Default retention: process lifetime. No cloud DB in MVP. |
| DPP3 Use | No marketing. No sale. No employer forwarding. New purpose requires express consent we will not ask for in MVP. |
| DPP4 Security | HTTPS only if deployed; local demo on localhost. LLM traffic: identifiers stripped. Operator keys stay server-side; a visitor key is entered in the browser, kept in that browser's `localStorage`, sent per request and held only for the life of that request — never written to a session or a log. |
| DPP5 Openness | `/ethics` states what we hold and why. |
| DPP6 Access / correction | The profile editor *is* the access/correction path. |

Direct-marketing provisions in Part 6A do not apply because we do not market.

Data processors: the LLM vendor is a processor. DPP2/4 require contractual or other means to keep their retention in check — for the demo, we document “do not send PII” and “do not use for training” in the PICS, and we strip identifiers.[14][15] In visitor mode the request is made against the visitor's own provider account under that provider's terms; Pathfolio holds no credential of its own for the call and cannot see the response beyond the draft it renders.

## PCPD AI Model Framework (June 2024)[15]

We are an organisation *using* a generative model, not training one.

- **Human oversight:** every AI sentence is pending until accept/edit/dismiss. Scores are not AI.
- **Transparency:** “How this is calculated” on every ring. Model name in the report footer.
- **Data minimisation:** strip name/email/phone/linkedin before the vendor sees the payload.
- **Fairness:** no protected attributes in the model. TrackFit can still encode degree-field bias via skills — disclose that a Business student and a CS student with the same projects should be able to reach the same analytics score.
- **Reliability:** if JSON fails validation, do not show a partial hallucination; fall back to fixtures or an error.
- **Beneficial / not dependent:** the export is a document the user owns. The product must still make sense if the LLM is off (sample path).

## GenAI limits (on-screen copy, do not soften)

Use this text in the workspace footer and the PDF:

> Pathfolio drafts wording from the experiences you supplied. It can miss context, repeat bias in job language, or invent details — if a suggestion adds a fact you did not enter, discard it. Scores measure how complete and structured your materials are. They are not an offer prediction and not an employer’s view of you. You decide what goes in the exported pack.

Do not hide this behind a tooltip.

## Accessibility

- Text paste, not only file upload (barrier: not everyone has a polished PDF).
- Sample profile so a user with no internship still sees the full demo.
- Colour is not the only score encoding (number + word: Needs work / Getting there / Interview-ready).
- Keyboard: Accept / Dismiss buttons are real buttons.
- The interface is bilingual (English / 繁體中文), toggled in the header and remembered per browser. Drafted content stays in English, because that is the language the interview will be in; a Chinese-language draft mode is a post-MVP item and is listed on `/ethics` as a known gap.

## Empowerment vs dependency

The system refuses to auto-submit applications. It refuses to speak in the interview for the user. STAR drafts are labelled “draft”. The 7-day plan is work the user does.

## Business sustainability (story, not code)

University career-centre licence (cohort pricing) is the primary path; optional later individual subscription. Free workshop mode = fixture + scoring, no LLM cost. This matches the interim report and avoids a pure API-burn model.

## Electronic Transactions Ordinance

If we later add click-wrap accept of the PICS, keep a timestamped log of consent. MVP: checkbox “I have read the notice” before parse. No digital-signature claims.
