import { useState } from 'react'
import { useStore } from '../store'
import { PageHead } from '../components/bits'

export function Ethics() {
  const { reset, sessionId, t } = useStore()
  const [done, setDone] = useState(false)

  const dpp: [string, string][] = [
    ['ethics.dpp1', 'ethics.dpp1Body'],
    ['ethics.dpp2', 'ethics.dpp2Body'],
    ['ethics.dpp3', 'ethics.dpp3Body'],
    ['ethics.dpp4', 'ethics.dpp4Body'],
    ['ethics.dpp5', 'ethics.dpp5Body'],
    ['ethics.dpp6', 'ethics.dpp6Body'],
  ]

  return (
    <div className="wrap">
      <PageHead eyebrow={t('common.reference')} title={t('ethics.title')}>
        <p>{t('ethics.lede')}</p>
      </PageHead>

      <div className="grid two">
        <div className="card">
          <h3>{t('ethics.holdTitle')}</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            {t('ethics.holdBody')}
          </p>
        </div>
        <div className="card">
          <h3>{t('ethics.leavesTitle')}</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            {t('ethics.leavesBody')}
          </p>
        </div>
      </div>

      <h2>{t('ethics.pdpoTitle')}</h2>
      <div className="card">
        <ul className="plain">
          {dpp.map(([head, body]) => (
            <li key={head}>
              <strong>{t(head)}</strong> {t(body)}
            </li>
          ))}
        </ul>
      </div>

      <h2>{t('ethics.governanceTitle')}</h2>
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>
          {t('ethics.governanceBody')}
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          {t('ethics.governanceBody2')}
        </p>
      </div>

      <h2>{t('ethics.limitsTitle')}</h2>
      <div className="card">
        <p className="small" style={{ marginTop: 0, marginBottom: 0 }}>
          {t('ethics.limitsBody')}
        </p>
      </div>

      <h2>{t('ethics.accessTitle')}</h2>
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>
          {t('ethics.accessBody')}
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          {t('ethics.accessBody2')}
        </p>
      </div>

      <h2>{t('ethics.businessTitle')}</h2>
      <div className="card">
        <p className="small" style={{ marginTop: 0, marginBottom: 0 }}>
          {t('ethics.businessBody')}
        </p>
      </div>

      <h2>{t('ethics.deleteTitle')}</h2>
      <div className="card raised">
        <p className="small muted" style={{ marginTop: 0 }}>
          {t('ethics.deleteBodyPrefix')} {sessionId ? sessionId.slice(0, 8) : '—'}…
          {t('ethics.deleteBodyTail')}
        </p>
        <div className="actionbar">
          <button
            className="primary"
            onClick={async () => {
              await reset()
              setDone(true)
            }}
          >
            {t('ethics.deleteBtn')}
          </button>
          {done && <span className="small muted">{t('ethics.deleted')}</span>}
        </div>
      </div>
    </div>
  )
}
