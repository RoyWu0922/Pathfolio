export interface Experience {
  id: string
  title: string
  org: string
  start: string
  end: string | null
  current: boolean
  bullets: string[]
  tags: string[]
}

export interface Education {
  school: string
  degree: string
  field: string
  end_year: number | null
}

export interface Profile {
  id: string
  display_name: string
  school: string
  degree: string
  field: string
  grad_year: number | null
  location_preference: string[]
  skills: string[]
  languages: string[]
  experiences: Experience[]
  education: Education[]
}

export interface TrackComponents {
  skill_overlap: number
  nace_coverage: number
  evidence_transfer: number
  wef_align: number
}

export interface TrackScore {
  id: string
  title: string
  rationale: string
  positioning: string
  track_fit: number
  components: TrackComponents
  matched_skills: string[]
  missing_skills: string[]
  nace_raw: Record<string, number>
  resume_scan: number
  interview_readiness: number
  drafted_by?: 'llm' | 'fixture'
  /** One sentence from the picker explaining why this track was surfaced. */
  picked_why?: string
}

export interface SampleInfo {
  id: string
  display_name: string
  school: string
  degree: string
  field: string
  experiences: number
  skills: number
  /** Offline rewrites and STAR drafts were written for the default sample only. */
  has_offline_draft: boolean
}

export interface SampleList {
  samples: SampleInfo[]
  default: string
}

export interface RecommendResponse {
  tracks: TrackScore[]
  drafted_by?: string
  /** 'ranking' = the local top three by score; 'llm' = model picked from the shortlist. */
  picked_by?: 'ranking' | 'llm'
  /** How many tracks were scored before the three were chosen. */
  considered?: number
  shortlist?: string[]
}

export interface SixPoint {
  name: number
  title: number
  org: number
  dates: number
  previous: number
  education: number
  total: number
}

export interface ResumeScan {
  track_id: string
  score: number
  six_point: SixPoint
  keyword: number
  keyword_hits: number
  layout: number
  flags: string[]
}

export interface Suggestion {
  id: string
  experience_id: string
  before: string
  after: string
  reason: string
  status: 'pending' | 'accepted' | 'dismissed' | 'edited'
  grounded_in?: string[]
  user_text?: string
  drafted_by?: 'llm' | 'fixture'
  insufficient_evidence?: boolean
  grounding_problems?: string[]
}

export interface StarStory {
  id: string
  track_id: string
  competency: string
  prompt: string
  situation: string
  task: string
  action: string
  result: string
  score: number
  breakdown: { s: number; t: number; a: number; r: number; q: number; caps: string[] }
  word_share: { s: number; t: number; a: number; r: number }
  diagnostics: string[]
  status: 'pending' | 'accepted' | 'dismissed' | 'edited'
  insufficient_evidence: boolean
  drafted_by?: 'llm' | 'fixture'
  grounding_problems?: string[]
}

export interface Question {
  id: string
  text: string
  kind: string
  competency: string
  why_asked: string
  drafted_by?: 'llm' | 'fixture'
}

export interface PlanDay {
  day: number
  title: string
  done: boolean
  mandatory?: boolean
}

export interface Strategy {
  track_id: string
  questions: Question[]
  plan7: PlanDay[]
  scan: ResumeScan
  drafted_by?: 'llm' | 'fixture'
}
