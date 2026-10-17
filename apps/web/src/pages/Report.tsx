import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useStore } from '../store'
import { PageHead, ScoreRing, Trail } from '../components/bits'

interface Suggestion {
  id: string
  before: string
  after: string
  reason: string
  user_text?: string
}

interface Story {
  id: string
  competency: string
  prompt: string
  situation: string
  task: string
  action: string
  result: string
  score: number
}

interface SixPoint {
  name: number
  title: number
  org: number
  dates: number
  previous: number
  education: number
  total: number
}

interface Question {
  id: string
  text: string
  kind: string
  competency: string
  why_asked: string
}

interface PlanDay {
  day: number
  title: string
  done: boolean
}

interface ReportData {
  generated_at: string
  profile: { display_name: string; school: string; degree: string; field: string; skills: string[] }
  track: { title: string; track_fit: number; positioning: string; matched_skills: string[]; missing_skills: string[] }
  scan: { score: number; six_point: SixPoint; keyword: number; keyword_hits: number; layout: number; flags: string[] }
  accepted_suggestions: Suggestion[]
  accepted_stories: Story[]
  questions: Question[]
  plan7: PlanDay[]
  readiness: number
  story_coverage: number
  disclaimer: string
}

const SIX_KEYS = ['name', 'title', 'org', 'dates', 'previous', 'education'] as const

export function Report() {
  const { trackId = '' } = useParams()
  const { sessionId, t, lang } = useStore()
  const [data, setData] = useState<ReportData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    api
      .report(sessionId, trackId)
      .then((d) => setData(d as unknown as ReportData))
      .catch((e) => setErr(String(e)))
  }, [sessionId, trackId])

  const sixLabel = (key: string) => (SIX_KEYS.includes(key as (typeof SIX_KEYS)[number]) ? t(`six.${key}`) : key.replace(/_/g, ' '))
  const compLabel = (c: string) => {
    const key = `comp.${c}`
    const translated = t(key)
    return translated === key ? c.replace(/_/g, ' ') : translated
  }

  if (err) {
    return (
      <div className="wrap">
        <PageHead eyebrow={t('common.step4')} title={t('report.buildFail')}>
          <p className="notice">{err}</p>
        </PageHead>
        <div className="card">
          <div className="actionbar">
            <Link className="btn primary" to={`/tracks/${trackId}`}>
              {t('common.backWorkspace')}
            </Link>
            <Link className="btn" to="/tracks">
              {t('common.backToTracks')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="wrap">
        <p className="muted">{t('common.building')}</p>
      </div>
    )
  }

  const { profile, track, scan } = data

  return (
    <div className="wrap">
      <div className="no-print">
        <PageHead eyebrow={t('common.step4')} title={t('report.title')}>
          <p>{t('report.lede')}</p>
        </PageHead>

        <Trail here={3} trackId={trackId} />

        <div className="card">
          <div className="spread">
            <div>
              <h3>{t('report.ready')}</h3>
              <p className="small muted" style={{ marginBottom: 0 }}>
                {t('report.readyBody')}
              </p>
            </div>
            <div className="row">
              <button className="primary" onClick={() => window.print()}>
                {t('report.print')}
              </button>
              <Link className="btn" to={`/tracks/${trackId}`}>
                {t('common.backWorkspace')}
              </Link>
            </div>
          </div>
        </div>

        {(data.accepted_suggestions.length === 0 || data.accepted_stories.length === 0) && (
          <p className="notice" style={{ marginTop: 16 }}>
            {data.accepted_suggestions.length === 0 && `${t('report.noRewrites')} `}
            {data.accepted_stories.length === 0 && `${t('report.noStories')} `}
            {t('report.goBackAccept')}
          </p>
        )}
      </div>

      {/* ---- everything below is the printable pack ---- */}
      <div style={{ marginTop: 26 }}>
        <h1 style={{ marginBottom: 4 }}>
          {profile.display_name || t('report.candidate')} — {track.title}
        </h1>
        <p className="small muted" style={{ marginTop: 0 }}>
          {profile.school} · {profile.degree} {profile.field} · {t('report.generated')}{' '}
          {new Date(data.generated_at).toLocaleString()}
        </p>
      </div>

      <div className="grid three" style={{ marginTop: 18 }}>
        <div className="card flat">
          <ScoreRing score={track.track_fit} label={t('ws.fitLabel')} />
        </div>
        <div className="card flat">
          <ScoreRing score={scan.score} label={t('tracks.resumeSkim')} />
        </div>
        <div className="card flat">
          <ScoreRing score={data.readiness} label={t('tracks.readiness')} />
        </div>
      </div>

      <h2>{t('report.positioning')}</h2>
      <p>{track.positioning}</p>

      <h2>{t('report.skimDetail')}</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data">
          <tbody>
            {SIX_KEYS.map((k) => (
              <tr key={k}>
                <td>{sixLabel(k)}</td>
                <td className="num">{scan.six_point[k]} / 10</td>
              </tr>
            ))}
            <tr className="total">
              <td>{t('report.sixTotal')}</td>
              <td className="num">{scan.six_point.total} / 60</td>
            </tr>
            <tr>
              <td>{t('ws.keywordMatch')}</td>
              <td className="num">
                {scan.keyword_hits} {t('ws.hits')} · {scan.keyword} / 25
              </td>
            </tr>
            <tr>
              <td>{t('ws.layout')}</td>
              <td className="num">{scan.layout} / 15</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>
        {t('report.acceptedRewrites')} ({data.accepted_suggestions.length})
      </h2>
      {data.accepted_suggestions.length === 0 ? (
        <p className="muted small">{t('report.none')}</p>
      ) : (
        data.accepted_suggestions.map((s) => (
          <div className="diff accepted" key={s.id}>
            <p className="linelabel">{t('report.was')}</p>
            <p className="before">{s.before}</p>
            <p className="linelabel">{t('report.now')}</p>
            <p className="after">{s.user_text ?? s.after}</p>
          </div>
        ))
      )}

      <h2>
        {t('report.acceptedStories')} ({data.accepted_stories.length})
      </h2>
      {data.accepted_stories.length === 0 ? (
        <p className="muted small">{t('report.none')}</p>
      ) : (
        data.accepted_stories.map((s) => (
          <div className="card flat" key={s.id}>
            <div className="spread">
              <div style={{ maxWidth: '60ch' }}>
                <p className="tiny muted" style={{ margin: '0 0 4px' }}>
                  {compLabel(s.competency)}
                </p>
                <strong>{s.prompt}</strong>
              </div>
              <span className="chip plain">
                {t('common.score')} {s.score}/5
              </span>
            </div>
            <div className="star" style={{ marginTop: 14 }}>
              {(['situation', 'task', 'action', 'result'] as const).map((part) => (
                <div className={`star-part${part === 'action' ? '' : ' dim'}`} key={part}>
                  <div className="label">{t(`ws.${part}`)}</div>
                  <p>{s[part]}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <h2>{t('report.likelyQuestions')}</h2>
      <ul className="plain">
        {data.questions.map((q) => (
          <li key={q.id}>
            <strong>{q.text}</strong>
            <div className="small muted">{q.why_asked}</div>
          </li>
        ))}
      </ul>

      <h2>{t('report.sevenDay')}</h2>
      <ul className="plain">
        {data.plan7.map((d) => (
          <li key={d.day}>
            <strong>
              {t('ws.day')} {d.day}.
            </strong>{' '}
            {d.title}
          </li>
        ))}
      </ul>

      <h2>{t('report.skills')}</h2>
      <p>
        {track.matched_skills.map((s) => (
          <span className="chip" key={s}>
            {s}
          </span>
        ))}
        {track.missing_skills.map((s) => (
          <span className="chip gap" key={s}>
            {t('tracks.gap')}: {s}
          </span>
        ))}
      </p>

      <p className="disclaimer">
        {lang === 'zh'
          ? 'Pathfolio 依据你提供的经历起草文字。它可能漏掉背景、沿用招聘话术里的偏见，甚至编造细节——只要建议里多出你没填的事实，就丢掉它。分数衡量的是你的材料有多完整、多有条理，不预测录取结果，也不是雇主对你的评价。导出什么由你决定。'
          : data.disclaimer}
      </p>
      <p className="tiny muted">
        {t('report.coverage')} {Math.round(data.story_coverage * 100)}% {t('report.coverageTail')}
      </p>
    </div>
  )
}
