import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { DraftBadge, PageHead, ScoreRing, Trail } from '../components/bits'

export function Tracks() {
  const { tracks, profile, recommend, trackSource, pickedBy, considered, t } = useStore()

  if (!profile) {
    return (
      <div className="wrap">
        <PageHead eyebrow={t('common.step2')} title={t('tracks.title')}>
          <p>{t('tracks.ledeNoProfile')}</p>
        </PageHead>
        <div className="card">
          <h3>{t('tracks.noneTitle')}</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('tracks.noneBody')}
          </p>
          <div className="actionbar">
            <Link className="btn primary" to="/profile">
              {t('tracks.goProfile')}
            </Link>
            <Link className="btn" to="/">
              {t('tracks.backStart')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <PageHead eyebrow={t('common.step2')} title={t('tracks.title')}>
        <p>{t('tracks.lede')}</p>
      </PageHead>

      <Trail here={1} />

      <p className="section-note">
        {t('tracks.fitHow')} <DraftBadge by={trackSource ?? undefined} /> {t('tracks.sourceNote')}
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, marginBottom: 6 }}>{t('tracks.howPicked')}</h3>
        <p className="small" style={{ margin: '0 0 6px' }}>
          <strong>{considered}</strong> {t('tracks.chosenFrom')} ·{' '}
          {pickedBy === 'llm' ? t('tracks.byModel') : t('tracks.byRanking')}
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {t('tracks.howPickedBody')}
        </p>
      </div>

      <div className="spread" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, border: 0, padding: 0 }}>{t('tracks.pick')}</h2>
        <button className="ghost small no-print" onClick={() => recommend()} title={t('tracks.rescoreTitle')}>
          {t('tracks.rescore')}
        </button>
      </div>

      <div className="grid three" style={{ marginTop: 14 }}>
        {tracks.map((track, i) => (
          <div className="card raised" key={track.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row tight">
              <span className="chip quiet">
                {t('common.track')} {i + 1}
              </span>
              {i === 0 && <span className="chip">{t('common.bestFit')}</span>}
            </div>

            <div>
              <h3 style={{ marginBottom: 10 }}>{track.title}</h3>
              <ScoreRing score={track.track_fit} how={track.rationale} />
            </div>

            {track.picked_why && (
              <p className="small muted" style={{ margin: 0 }}>
                <strong>{t('tracks.whyThis')}:</strong> {track.picked_why}
              </p>
            )}

            <div className="small muted" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
              <div>
                {t('tracks.resumeSkim')} <strong>{track.resume_scan}</strong>/100
              </div>
              <div>
                {t('tracks.readiness')} <strong>{track.interview_readiness}</strong>/100
              </div>
            </div>

            <div>
              {track.matched_skills.slice(0, 3).map((s) => (
                <span className="chip" key={s}>
                  {s}
                </span>
              ))}
              {track.missing_skills.slice(0, 2).map((s) => (
                <span className="chip gap" key={s}>
                  {t('tracks.gap')}: {s}
                </span>
              ))}
            </div>

            <div className="actionbar" style={{ marginTop: 'auto' }}>
              <Link className="btn primary" to={`/tracks/${track.id}`}>
                {t('common.workOnThis')}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <h2>{t('tracks.readTitle')}</h2>
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>
          {t('tracks.readBody')}
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {t('tracks.readBody2')}
        </p>
      </div>
    </div>
  )
}
