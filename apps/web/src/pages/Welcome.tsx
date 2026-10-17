import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Disclaimer, DISCLAIMER_TEXT, DISCLAIMER_TEXT_ZH, PageHead } from '../components/bits'

export function Welcome() {
  const { loadSample, ready, error, fixtureMode, t, lang } = useStore()
  const nav = useNavigate()

  return (
    <div className="wrap">
      <PageHead eyebrow={t('welcome.eyebrow')} title={t('welcome.title')}>
        <p className="lede">{t('welcome.lede')}</p>
      </PageHead>

      <div className="card raised">
        <div className="spread">
          <div style={{ maxWidth: '52ch' }}>
            <h3>{t('welcome.startTitle')}</h3>
            <p className="small muted" style={{ marginTop: 0 }}>
              {t('welcome.startBody')}
            </p>
          </div>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <button
              className="primary"
              disabled={!ready}
              onClick={async () => {
                await loadSample()
                nav('/tracks')
              }}
            >
              {t('welcome.loadSample')}
            </button>
            <Link className="btn" to="/profile">
              {t('welcome.ownProfile')}
            </Link>
          </div>
        </div>
        <p className="tiny muted" style={{ margin: '14px 0 0' }}>
          {fixtureMode ? t('welcome.offlineNote') : t('welcome.onlineNote')}
        </p>
      </div>

      {error && (
        <p className="notice" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <h2>{t('welcome.whatOrder')}</h2>
      <div className="grid three">
        <div className="card">
          <div className="chip quiet">{t('common.step1')}</div>
          <h3 style={{ marginTop: 10 }}>{t('welcome.c1Title')}</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            {t('welcome.c1Body')}
          </p>
        </div>
        <div className="card">
          <div className="chip quiet">{t('common.step2')}</div>
          <h3 style={{ marginTop: 10 }}>{t('welcome.c2Title')}</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            {t('welcome.c2Body')}
          </p>
        </div>
        <div className="card">
          <div className="chip quiet">
            {t('common.step3')} · {t('common.step4')}
          </div>
          <h3 style={{ marginTop: 10 }}>{t('welcome.c3Title')}</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            {t('welcome.c3Body')}
          </p>
        </div>
      </div>

      <h2>{t('welcome.why')}</h2>
      <div className="stats">
        <div className="stat">
          <div className="n">30,798</div>
          <div className="k">
            {t('welcome.stat1')} (
            <a
              href="https://macaonews.org/news/greater-bay-area/hong-kong-graduates-employment-job-market/"
              target="_blank"
              rel="noreferrer"
            >
              Macao News
            </a>
            ,{' '}
            <a
              href="https://www.scmp.com/news/hong-kong/education/article/3341998/55-plunge-new-hires-hong-kong-graduates-face-gloomiest-job-outlook-5-years"
              target="_blank"
              rel="noreferrer"
            >
              SCMP
            </a>
            ）
          </div>
        </div>
        <div className="stat">
          <div className="n">+0.5%</div>
          <div className="k">{t('welcome.stat2')}</div>
        </div>
        <div className="stat">
          <div className="n">53.5 vs 78.1</div>
          <div className="k">
            {t('welcome.stat3')} (
            <a
              href="https://www.naceweb.org/career-readiness/competencies/the-gap-in-perceptions-of-new-grads-competency-proficiency-and-resources-to-shrink-it"
              target="_blank"
              rel="noreferrer"
            >
              NACE
            </a>
            )
          </div>
        </div>
      </div>

      <h2>{t('welcome.notTitle')}</h2>
      <div className="card">
        <ul className="plain small">
          <li>{t('welcome.not1')}</li>
          <li>{t('welcome.not2')}</li>
          <li>{t('welcome.not3')}</li>
          <li>{t('welcome.not4')}</li>
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {t('welcome.privacy')} {t('welcome.privacyPrefix')}
          <Link to="/ethics">{t('welcome.privacyLink')}</Link>。
        </p>
      </div>

      <Disclaimer text={lang === 'zh' ? DISCLAIMER_TEXT_ZH : DISCLAIMER_TEXT} />
    </div>
  )
}
