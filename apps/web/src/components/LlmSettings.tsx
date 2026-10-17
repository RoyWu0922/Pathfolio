import { useEffect, useState } from 'react'
import { clearLlm, loadLlm, saveLlm, type LlmConfig } from '../llm'
import { useStore } from '../store'

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20, 18, 16, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 50,
}

const panel: React.CSSProperties = {
  background: 'var(--card, #fff)',
  color: 'var(--foreground, #1b1a18)',
  border: '1px solid var(--border, #ddd)',
  borderRadius: 14,
  padding: '24px 24px 20px',
  width: 'min(560px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
}

const label: React.CSSProperties = { display: 'block', marginBottom: 14, fontSize: 14 }
const input: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  padding: '9px 11px',
  fontSize: 14,
  border: '1px solid var(--border, #ddd)',
  borderRadius: 8,
  background: 'var(--background, #fff)',
  color: 'inherit',
  boxSizing: 'border-box',
}

export function LlmSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useStore()
  const [cfg, setCfg] = useState<LlmConfig>({ key: '', base: '', model: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      setCfg(loadLlm())
      setSaved(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const set = (patch: Partial<LlmConfig>) => {
    setCfg((c) => ({ ...c, ...patch }))
    setSaved(false)
  }

  return (
    <div style={backdrop} onClick={onClose} role="presentation">
      <div
        style={panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('llm.title')}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{t('llm.title')}</h2>
        <p className="muted" style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55 }}>
          {t('llm.body')}
        </p>

        <label style={label}>
          {t('llm.key')}
          <input
            style={input}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-..."
            value={cfg.key}
            onChange={(e) => set({ key: e.target.value })}
          />
        </label>

        <label style={label}>
          {t('llm.base')}
          <input
            style={input}
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://api.openai.com/v1"
            value={cfg.base}
            onChange={(e) => set({ base: e.target.value })}
          />
        </label>

        <label style={label}>
          {t('llm.model')}
          <input
            style={input}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="gpt-4o-mini"
            value={cfg.model}
            onChange={(e) => set({ model: e.target.value })}
          />
        </label>

        <p className="tiny muted" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
          {t('llm.privacy')}
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => { saveLlm(cfg); setSaved(true) }} disabled={!cfg.key.trim()}>
            {t('llm.save')}
          </button>
          <button className="ghost" onClick={() => { clearLlm(); setCfg({ key: '', base: '', model: '' }); setSaved(false) }}>
            {t('llm.clear')}
          </button>
          <button className="ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
            {t('llm.close')}
          </button>
        </div>

        {saved && (
          <p className="tiny" style={{ margin: '12px 0 0', color: 'var(--accent, #1a7f5a)' }}>
            {t('llm.saved')}
          </p>
        )}
      </div>
    </div>
  )
}
