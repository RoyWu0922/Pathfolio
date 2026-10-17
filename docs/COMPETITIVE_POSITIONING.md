# Where Pathfolio sits against existing tools

The five failure modes below come from a competitor review of an AI résumé/interview platform.
Each one is either something this project designs around, or something it knowingly does not solve.
Both columns are useful to a judge: the second one is where the honesty lives.

| Failure mode | What the competitor does | What Pathfolio does instead | Still unresolved here |
| --- | --- | --- | --- |
| **Keyword stuffing** — forcing skills into bullets the candidate never had | Optimises keyword density for the ATS | A rewrite may only restate facts already in the profile; the draft carries a "pending" badge until a human accepts it, edits it, or dismisses it | A rewrite can still *sound* more senior than the evidence justifies. No score catches tone inflation; the human gate does. |
| **Fabricated metrics** — inventing percentages and numbers | Model writes impact bullets freehand | Every draft passes a fact-check before display: any number or organisation absent from the profile is rejected, and the item is shown as rejected rather than shipped | A model can imply a number indirectly ("tripled" as a word). The number-word map covers one through a hundred; it is not exhaustive. |
| **Rigid templates** — fixed ATS layouts, capped customisation | Fixed template gallery | The product does not sell résumé templates. Output is a report rendered from HTML/CSS, printable to PDF, and the stylesheet is editable in the repository | Anyone wanting a pixel-perfect two-column design still needs a design tool. We do not claim to replace one. |
| **Free-tier caps** — 2 kits a month, 10 tracked applications, paywalled features | Metered generation, upsell at $24.99–34.99/mo | Scoring, the résumé scan, the seven-day plan and the report are local and uncapped; the demo runs with no model key at all. A model is optional and, in visitor mode, paid for by the visitor's own key | No billing, no quota, no accounts. That is a demo choice, not a business model. |
| **Niche-field blind spots** — generic phrasing for specialised work | One generic model for every discipline | Eight explicitly curated directions, each with its own keyword bank, NACE weighting and STAR prompts; a profile is scored against all eight and the three best-fitting are surfaced with the reason | Eight directions is not every career. Medicine, law, creative portfolios and academic CVs are outside the library, and the UI says so rather than pretending otherwise. |
| **Opaque processing** — "we mask PII, trust us" | PII masking happens server-side, unexplained | Redaction runs locally before the payload leaves the machine (name, email, phone, links); sessions live in memory and can be deleted; with a visitor key the request goes to the visitor's own provider account | Any hosted model still receives the (redacted) text. We cannot prove a vendor's retention policy — hence "use a key you can revoke". |

## The one-line version

> Every competitor above is either guessing at the candidate's evidence or charging per guess.
> Pathfolio computes the fit locally, refuses drafts it cannot ground, and makes the human decide.

## Related

- `docs/ETHICS_PDPO.md` — PDPO mapping, PCPD model framework, on-screen disclosure copy.
- `docs/QUANT_MODELS.md` — the scoring formula and its sources.
- `README.md` — how the flow actually runs.
