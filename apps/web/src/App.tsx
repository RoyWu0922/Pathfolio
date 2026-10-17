import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import { Welcome } from './pages/Welcome'
import { ProfilePage } from './pages/ProfilePage'
import { Tracks } from './pages/Tracks'
import { Workspace } from './pages/Workspace'
import { Report } from './pages/Report'
import { Ethics } from './pages/Ethics'

export default function App() {
  const { error, fixtureMode, profile, tracks, t, toggleLang, lang } = useStore()

  return (
    <>
      <header className="top">
        <div className="inner">
          <NavLink to="/" className="brand">
            Pathfolio
            <span>{t('brand.sub')}</span>
          </NavLink>
          <nav className="top">
            <NavLink to="/" end>
              {t('nav.start')}
            </NavLink>
            <NavLink to="/profile">
              {t('nav.profile')}
              {profile ? ' ✓' : ''}
            </NavLink>
            <NavLink to="/tracks">
              {t('nav.tracks')}
              {tracks.length ? ` (${tracks.length})` : ''}
            </NavLink>
            <NavLink to="/ethics">{t('nav.ethics')}</NavLink>
            {fixtureMode && (
              <span className="tiny muted" title={t('nav.offline.title')}>
                {t('nav.offline')}
              </span>
            )}
            <button
              className="ghost small no-print"
              onClick={toggleLang}
              title={t('lang.title')}
              aria-label={t('lang.title')}
            >
              {lang === 'en' ? '中文' : 'EN'}
            </button>
          </nav>
        </div>
      </header>

      {error && (
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <p className="notice">{error}</p>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/tracks" element={<Tracks />} />
        <Route path="/tracks/:trackId" element={<Workspace />} />
        <Route path="/tracks/:trackId/report" element={<Report />} />
        <Route path="/ethics" element={<Ethics />} />
        <Route
          path="*"
          element={
            <section className="wrap">
              <h1>{t('notFound.title')}</h1>
              <p className="muted">{t('notFound.body')}</p>
              <p>
                <Link to="/">{t('notFound.back')} →</Link>
              </p>
            </section>
          }
        />
      </Routes>

      <footer className="wrap" style={{ paddingTop: 0 }}>
        <p className="tiny muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, maxWidth: '84ch' }}>
          {t('footer.note')}
        </p>
      </footer>
    </>
  )
}
