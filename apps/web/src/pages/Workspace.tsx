import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useStore } from '../store'
import type { ResumeScan, StarStory, Strategy, Suggestion, TrackScore } from '../types'
import {
  CapNote,
  Disclaimer,
  DISCLAIMER_TEXT,
  DISCLAIMER_TEXT_ZH,
  DraftBadge,
  PageHead,
  RejectedNote,
  ScoreRing,
  Trail,
} from '../components/bits'

type Tab = 'overview' | 'resume' | 'stories' | 'plan'

const TAB_KEY: Record<Tab, string> = {
  overview: 'ws.tabOverview',
  resume: 'ws.tabResume',
  stories: 'ws.tabStories',
  plan: 'ws.tabPlan',
}

const NOTE_KEY: Record<Tab, string> = {
  overview: 'ws.noteOverview',
  resume: 'ws.noteResume',
  stories: 'ws.noteStories',
  plan: 'ws.notePlan',
}

const SIX_KEYS = ['name', 'title', 'org', 'dates', 'previous', 'education'] as const

export function Workspace() {
  const { trackId = '' } = useParams()
  const { sessionId, tracks, profile, t, lang } = useStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [scan, setScan] = useState<ResumeScan | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [stories, setStories] = useState<StarStory[]>([])
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [source, setSource] = useState<{ suggest: string; stories: string; strategy: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const track: TrackScore | undefined = tracks.find((x) => x.id === trackId)

  useEffect(() => {
    if (!sessionId || !track) return
    let alive = true
    ;(async () => {
      setBusy(true)
      setErr(null)
      try {
        const [s, sug, st, strat] = await Promise.all([
          api.scan(sessionId, track.id),
          api.suggest(sessionId, track.id),
          api.stories(sessionId, track.id),
          api.strategy(sessionId, track.id),
        ])
        if (!alive) return
        setScan(s.scan)
        setSuggestions(sug.suggestions)
        setStories(st.stories)
        setStrategy(strat)
        setSource({
          suggest: sug.suggestions.some((x) => x.drafted_by === 'llm') ? 'model' : 'offline',
          stories: st.stories.some((x) => x.drafted_by === 'llm') ? 'model' : 'offline',
          strategy: strat.drafted_by === 'llm' ? 'model' : 'offline',
        })
      } catch (e) {
        if (alive) setErr(String(e))
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [sessionId, track])

  if (!track) {
    return (
      <div className="wrap">
        <PageHead eyebrow={t('common.step3')} title={t('ws.noTrack')}>
          <p>{t('ws.noTrackBody')}</p>
        </PageHead>
        <div className="card">
          <div className="actionbar">
            <Link className="btn primary" to="/tracks">
              {t('common.backToTracks')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  async function decide(item: Suggestion | StarStory, status: Suggestion['status']) {
    if (!sessionId) return
    await api.decide(sessionId, item.id, status)
    if ('competency' in item) {
      setStories((prev) => prev.map((s) => (s.id === item.id ? { ...s, status } : s)))
    } else {
      setSuggestions((prev) => prev.map((s) => (s.id === item.id ? { ...s, status } : s)))
    }
  }

  const acceptedSug = suggestions.filter((s) => s.status === 'accepted' || s.status === 'edited').length
  const acceptedStories = stories.filter((s) => s.status === 'accepted' || s.status === 'edited').length
  const rejected = suggestions.filter((s) => s.insufficient_evidence).length

  const sixLabel = (key: string) =>
    SIX_KEYS.includes(key as (typeof SIX_KEYS)[number]) ? t(`six.${key}`) : key.replace(/_/g, ' ')
  const flagLabel = (flag: string) => {
    const key = `flag.${flag}`
    const translated = t(key)
    return translated === key ? flag.replace(/_/g, ' ') : translated
  }
  const compLabel = (c: string) => {
    const key = `comp.${c}`
    const translated = t(key)
    return translated === key ? c.replace(/_/g, ' ') : translated
  }
  const kindLabel = (kind: string) => {
    const key = `ws.kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
    const translated = t(key)
    return translated === key ? kind : translated
  }

  return (
    <div className="wrap">
      <PageHead eyebrow={t('common.step3')} title={track.title}>
        <p className="small muted" style={{ margin: 0 }}>
          {profile?.school} · {profile?.degree} {profile?.field}
        </p>
      </PageHead>

      <Trail here={2} trackId={track.id} />

      <div className="grid two" style={{ alignItems: 'stretch' }}>
        <div className="card">
          <ScoreRing score={track.track_fit} label={t('ws.fitLabel')} how={t('ws.fitHow')} />
        </div>
        <div className="card">
          <h3>{t('ws.whereStart')}</h3>
          <p className="small muted" style={{ marginTop: 0, marginBottom: 8 }}>
            {t('ws.whereStartBody')}
          </p>
          <div className="row tight">
            <button className="small" onClick={() => setTab('resume')}>
              {t('ws.jumpResume')}
            </button>
            <button className="small" onClick={() => setTab('stories')}>
              {t('ws.jumpStories')}
            </button>
            <button className="small" onClick={() => setTab('plan')}>
              {t('ws.jumpPlan')}
            </button>
          </div>
          <p className="tiny muted" style={{ marginBottom: 0, marginTop: 10 }}>
            {t('ws.acceptedSoFar')} {acceptedSug} {acceptedSug === 1 ? t('ws.rewrites') : t('ws.rewritesPlural')}、
            {acceptedStories} {acceptedStories === 1 ? t('ws.story') : t('ws.storiesPlural')}
            {rejected > 0 && ` · ${rejected} ${t('ws.refusedDrafts')}`}
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(['overview', 'resume', 'stories', 'plan'] as Tab[]).map((key) => (
          <button key={key} role="tab" aria-selected={key === tab} onClick={() => setTab(key)}>
            {t(TAB_KEY[key])}
          </button>
        ))}
      </div>
      <p className="tab-note">{t(NOTE_KEY[tab])}</p>

      {err && (
        <p className="notice" style={{ marginTop: 4 }}>
          {err}
        </p>
      )}

      {source && (
        <p className="tiny muted" style={{ marginTop: -6, marginBottom: 18 }}>
          {t('ws.draftSource')}{' '}
          <strong>{source.suggest === 'model' ? t('draft.sourceModel') : t('draft.sourceOffline')}</strong>,{' '}
          {t('ws.draftSourceStories')}{' '}
          <strong>{source.stories === 'model' ? t('draft.sourceModel') : t('draft.sourceOffline')}</strong>,{' '}
          {t('ws.draftSourceQuestions')}{' '}
          <strong>{source.strategy === 'model' ? t('draft.sourceModel') : t('draft.sourceOffline')}</strong>.{' '}
          {t('ws.draftSourceTail')}
        </p>
      )}

      {busy && <p className="small muted">{t('common.working')}</p>}

      {tab === 'overview' && (
        <section>
          <div className="grid two">
            <div className="card">
              <h3>{t('ws.whyTrack')}</h3>
              <p style={{ marginTop: 0 }}>{track.rationale}</p>
              <h3 style={{ marginTop: 18 }}>{t('ws.positioning')}</h3>
              <p style={{ fontStyle: 'italic', marginBottom: 0 }}>{track.positioning}</p>
            </div>
            <div className="card">
              <h3>{t('ws.howBuilt')}</h3>
              <table className="data">
                <tbody>
                  {(
                    [
                      ['ws.compSkill', track.components.skill_overlap, 40],
                      ['ws.compNace', track.components.nace_coverage, 30],
                      ['ws.compEvidence', track.components.evidence_transfer, 20],
                      ['ws.compWef', track.components.wef_align, 10],
                    ] as [string, number, number][]
                  ).map(([key, value, weight]) => (
                    <tr key={key}>
                      <td>{t(key)}</td>
                      <td className="num">
                        {(value * 100).toFixed(0)}% · {t('ws.weight')} {weight}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                {t('ws.howBuiltFoot')}
              </p>
            </div>
          </div>

          <div className="card">
            <h3>{t('ws.skillsHave')}</h3>
            <div className="row" style={{ marginBottom: 14 }}>
              {track.matched_skills.length ? (
                track.matched_skills.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))
              ) : (
                <span className="small muted">{t('ws.noneMatched')}</span>
              )}
            </div>
            <h3>{t('ws.gaps')}</h3>
            <div className="row">
              {track.missing_skills.slice(0, 5).map((s) => (
                <span className="chip gap" key={s}>
                  {s}
                </span>
              ))}
            </div>
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              {t('ws.gapFoot')}
            </p>
          </div>
        </section>
      )}

      {tab === 'resume' && scan && (
        <section>
          <div className="card">
            <ScoreRing score={scan.score} label={t('ws.skimLabel')} how={t('ws.skimHow')} />
          </div>

          <h2>{t('ws.sixPoints')}</h2>
          <p className="section-note">{t('ws.sixPointsNote')}</p>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>{t('ws.dataPoint')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ws.points')}</th>
                </tr>
              </thead>
              <tbody>
                {SIX_KEYS.map((k) => (
                  <tr key={k}>
                    <td>{sixLabel(k)}</td>
                    <td className="num">{scan.six_point[k]} / 10</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>{t('ws.total')}</td>
                  <td className="num">{scan.six_point.total} / 60</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>{t('ws.keywordLayout')}</h2>
          <div className="grid two">
            <div className="card">
              <h3>
                {t('ws.keywordMatch')} — {scan.keyword_hits} {scan.keyword_hits === 1 ? t('ws.hit') : t('ws.hits')} ·{' '}
                {scan.keyword}/25
              </h3>
              <p className="small muted" style={{ marginBottom: 0 }}>
                {t('ws.keywordFoot')}
              </p>
            </div>
            <div className="card">
              <h3>
                {t('ws.layout')} — {scan.layout}/15
              </h3>
              {scan.flags.length === 0 ? (
                <p className="small muted" style={{ marginBottom: 0 }}>
                  {t('ws.layoutOk')}
                </p>
              ) : (
                <ul className="plain small">
                  {scan.flags.map((f) => (
                    <li key={f}>{flagLabel(f)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <h2>{t('ws.rewritesTitle')}</h2>
          <p className="section-note">
            {acceptedSug} {t('ws.acceptedCount')} {t('ws.rewritesNote')}
          </p>
          {suggestions.length === 0 && <p className="muted">{t('ws.noSuggestions')}</p>}
          {suggestions.map((s) => (
            <div className={`diff ${s.status}`} key={s.id}>
              <div className="row" style={{ marginBottom: 4 }}>
                <DraftBadge by={s.drafted_by} />
                {s.insufficient_evidence && <span className="chip gap">{t('ws.refused')}</span>}
                {s.status === 'accepted' && <span className="chip">{t('common.accepted')}</span>}
                {s.status === 'dismissed' && <span className="chip quiet">{t('common.dismissed')}</span>}
              </div>
              <p className="linelabel">{t('ws.yours')}</p>
              <p className="before">{s.before}</p>
              <p className="linelabel">{t('ws.suggested')}</p>
              <p className="after">{s.user_text ?? s.after}</p>
              <p className="small muted">
                {t('ws.why')} {s.reason}
              </p>
              <RejectedNote problems={s.grounding_problems} />
              <div className="actions no-print">
                {s.insufficient_evidence ? (
                  <span className="small muted">{t('ws.notOffered')}</span>
                ) : (
                  <>
                    <button className={s.status === 'accepted' ? 'primary' : ''} onClick={() => decide(s, 'accepted')}>
                      {t('ws.accept')}
                    </button>
                    <button onClick={() => decide(s, 'dismissed')}>{t('ws.dismiss')}</button>
                    <button
                      className="ghost"
                      onClick={async () => {
                        const edited = window.prompt(t('ws.editPrompt'), s.user_text ?? s.after)
                        if (edited && sessionId) {
                          await api.decide(sessionId, s.id, 'edited', edited)
                          setSuggestions((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, status: 'edited', user_text: edited } : x)),
                          )
                        }
                      }}
                    >
                      {t('ws.edit')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'stories' && (
        <section>
          {stories.length === 0 && <p className="muted">{t('ws.noStories')}</p>}
          {stories.map((s) => (
            <div className="card" key={s.id}>
              <div className="spread">
                <div style={{ maxWidth: '62ch' }}>
                  <div className="row tight" style={{ marginBottom: 8 }}>
                    <span className="chip plain">{compLabel(s.competency)}</span>
                    <DraftBadge by={s.drafted_by} />
                    {s.status === 'accepted' && <span className="chip">{t('common.accepted')}</span>}
                    {s.status === 'dismissed' && <span className="chip quiet">{t('common.dismissed')}</span>}
                  </div>
                  <p style={{ margin: 0, fontWeight: 550 }}>{s.prompt}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span className={`ring small ${s.score >= 4 ? 'strong' : s.score === 3 ? 'mid' : 'weak'}`}>
                    {s.score}
                  </span>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {t('ws.scoreOutOf5')}
                  </div>
                </div>
              </div>

              <div className="star" style={{ marginTop: 16 }}>
                {(['situation', 'task', 'action', 'result'] as const).map((part) => (
                  <div className={`star-part${part === 'action' ? '' : ' dim'}`} key={part}>
                    <div className="label">{t(`ws.${part}`)}</div>
                    <p>{s[part] || <span className="muted">{t('ws.notProvided')}</span>}</p>
                  </div>
                ))}
              </div>

              <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
                {t('ws.wordShare')} S {(s.word_share.s * 100).toFixed(0)}% · T {(s.word_share.t * 100).toFixed(0)}% ·
                A {(s.word_share.a * 100).toFixed(0)}% · R {(s.word_share.r * 100).toFixed(0)}%. {t('ws.wordShareFoot')}
              </p>
              <CapNote caps={s.breakdown.caps} />

              <div className="actions no-print">
                <button className={s.status === 'accepted' ? 'primary' : ''} onClick={() => decide(s, 'accepted')}>
                  {t('ws.acceptExport')}
                </button>
                <button onClick={() => decide(s, 'dismissed')}>{t('ws.dismiss')}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'plan' && strategy && (
        <section>
          <h2>{t('ws.likelyQuestions')}</h2>
          <p className="section-note">{t('ws.likelyNote')}</p>
          {strategy.questions.map((q) => (
            <div className="card" key={q.id} style={{ marginBottom: 10 }}>
              <div className="row tight" style={{ marginBottom: 8 }}>
                <span className="chip plain">{kindLabel(q.kind)}</span>
                <span className="chip">{compLabel(q.competency)}</span>
                <DraftBadge by={q.drafted_by} />
              </div>
              <p style={{ margin: '0 0 4px', fontWeight: 550 }}>{q.text}</p>
              <p className="small muted" style={{ margin: 0 }}>
                {t('ws.whyAsked')} {q.why_asked}
              </p>
            </div>
          ))}

          <h2>{t('ws.sevenDay')}</h2>
          <p className="section-note">{t('ws.sevenDayNote')}</p>
          <div className="card">
            {strategy.plan7.map((d) => (
              <label className="checkitem" key={d.day}>
                <input type="checkbox" defaultChecked={d.done} />
                <span>
                  <strong>
                    {t('ws.day')} {d.day}.
                  </strong>{' '}
                  {d.title}
                  {d.mandatory && (
                    <span className="chip gap" style={{ marginLeft: 8 }}>
                      {t('ws.doFirst')}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="actionbar no-print">
        <Link className="btn primary" to={`/tracks/${track.id}/report`}>
          {t('common.goExport')}
        </Link>
        <Link className="btn" to="/tracks">
          {t('common.backToTracks')}
        </Link>
        <span className="small muted">{t('ws.exportOnlyAccepted')}</span>
      </div>

      <Disclaimer text={lang === 'zh' ? DISCLAIMER_TEXT_ZH : DISCLAIMER_TEXT} />
    </div>
  )
}
