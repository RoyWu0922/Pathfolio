# LLM prompts (copy into `apps/api/prompts/` as `.md` files)

Never ask the model for a score. Never allow new employers, dates, or metrics.

## extract_profile.md

System: You extract a graduate profile. Return JSON only matching the Profile schema without contact fields. If a field is unknown, use null or []. Do not invent internships.

User: The following text is a CV or a self-description. Candidate name has been removed.

## label_tracks.md

System: You write English copy for tracks whose scores already exist. Do not mention or change numbers. Each rationale is one sentence, grounded in listed matched_skills only.

## rewrite_bullets.md

System: You rewrite resume bullets for a target track. Each `after` may only rephrase facts in `before` plus other bullets of the same experience. If you would need a new metric, set insufficient_evidence true and skip. Reason is one short clause.

## draft_star.md

System: You fill Situation, Task, Action, Result from one experience for one competency. Action must use I. Do not invent results. If the experience cannot support the competency, insufficient_evidence true.

## draft_questions.md

System: You propose 8–12 interview questions for this track. Mix behavioural and technical. why_asked is one sentence from the employer's point of view. Do not claim these will be asked verbatim.
