import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { Experience, Profile } from '../types'
import { PageHead, Trail } from '../components/bits'

/* ------------------------------------------------------------------ utils */

function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

/** Nine months ago as YYYY-MM — friendlier than an empty date box. */
function recentStart(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 9)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EXP_TAGS = [
  'analytics',
  'leadership',
  'teamwork',
  'communication',
  'technology',
  'critical_thinking',
  'professionalism',
  'career_self_development',
]

const TAG_ZH: Record<string, string> = {
  analytics: '数据分析',
  leadership: '领导力',
  teamwork: '团队协作',
  communication: '沟通',
  technology: '技术',
  critical_thinking: '批判性思维',
  professionalism: '职业素养',
  career_self_development: '自我发展',
}

const EMPTY_EXPERIENCE = (): Experience => ({
  id: newId('exp'),
  title: '',
  org: '',
  start: '',
  end: null,
  current: false,
  bullets: [],
  tags: [],
})

/* ------------------------------------------------------- bullet editor */

function BulletList({ bullets, onChange }: { bullets: string[]; onChange: (next: string[]) => void }) {
  const { t } = useStore()
  const [draft, setDraft] = useState('')

  function add() {
    const text = draft.trim()
    if (!text) return
    onChange([...bullets.filter((b) => b.trim()), text])
    setDraft('')
  }

  return (
    <>
      {bullets.length === 0 && (
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          {t('profile.bulletEmpty')}
        </p>
      )}
      {bullets.map((b, i) => (
        <div className="row" key={i} style={{ alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
          <textarea
            value={b}
            onChange={(e) => {
              const next = [...bullets]
              next[i] = e.target.value
              onChange(next)
            }}
            style={{ minHeight: 56, flex: '1 1 320px' }}
            aria-label={`${t('profile.bullets')} ${i + 1}`}
          />
          <button
            className="ghost small no-print"
            title={t('profile.remove')}
            aria-label={`${t('profile.remove')} ${i + 1}`}
            onClick={() => onChange(bullets.filter((_, j) => j !== i))}
          >
            {t('profile.remove')}
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={t('profile.newBullet')}
          aria-label={t('profile.newBullet')}
          style={{ flex: '1 1 320px' }}
        />
        <button className="small" onClick={add} disabled={!draft.trim()}>
          {t('profile.addBullet')}
        </button>
      </div>
    </>
  )
}

/* -------------------------------------------------------- skill editor */

function SkillEditor({ skills, onChange }: { skills: string[]; onChange: (next: string[]) => void }) {
  const { t } = useStore()
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)

  function add(raw: string) {
    const value = raw.trim().toLowerCase()
    if (!value) return
    if (skills.includes(value)) {
      setNote(`“${value}” ${t('profile.skillDup')}`)
      return
    }
    onChange([...skills, value])
    setDraft('')
    setNote(null)
  }

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder={t('profile.skillPlaceholder')}
          aria-label={t('profile.addSkill')}
          style={{ flex: '1 1 320px' }}
        />
        <button className="small" onClick={() => add(draft)} disabled={!draft.trim()}>
          {t('profile.addSkill')}
        </button>
        {draft.includes(',') && (
          <button
            className="ghost small"
            onClick={() => {
              const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
              const next = [...skills]
              parts.forEach((part) => {
                const value = part.toLowerCase()
                if (!next.includes(value)) next.push(value)
              })
              onChange(next)
              setDraft('')
              setNote(null)
            }}
          >
            {t('profile.splitSkills')}
          </button>
        )}
      </div>
      {note && (
        <p className="small" style={{ color: 'var(--warn)', margin: '0 0 10px' }}>
          {note}
        </p>
      )}
      {skills.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          {t('profile.skillEmpty')}
        </p>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          {skills.map((s) => (
            <span className="chip quiet" key={s}>
              {s}
              <button
                className="ghost no-print"
                style={{
                  padding: '0 2px 0 6px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 13,
                  lineHeight: 1,
                  verticalAlign: 'middle',
                }}
                title={`${t('profile.remove')} ${s}`}
                aria-label={`${t('profile.remove')} ${s}`}
                onClick={() => onChange(skills.filter((x) => x !== s))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

/* ----------------------------------------------------- experience card */

function ExperienceCard({
  exp,
  index,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  exp: Experience
  index: number
  total: number
  onChange: (patch: Partial<Experience>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const { t, lang } = useStore()
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 14, alignItems: 'center' }}>
        <div className="row tight">
          <span className="chip quiet">
            {t('profile.exp')} {index + 1}
          </span>
          <span className="small muted">{exp.title || t('profile.untitled')}</span>
        </div>
        <div className="row tight no-print">
          <button
            className="ghost small"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title={t('profile.moveUp')}
            aria-label={t('profile.moveUp')}
          >
            ↑
          </button>
          <button
            className="ghost small"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title={t('profile.moveDown')}
            aria-label={t('profile.moveDown')}
          >
            ↓
          </button>
          <button className="ghost small" onClick={onDuplicate} title={t('profile.duplicateTitle')}>
            {t('profile.duplicate')}
          </button>
          {confirmRemove ? (
            <>
              <button className="small" onClick={onRemove} style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
                {t('profile.confirmRemove')}
              </button>
              <button className="ghost small" onClick={() => setConfirmRemove(false)}>
                {t('profile.cancel')}
              </button>
            </>
          ) : (
            <button className="ghost small" onClick={() => setConfirmRemove(true)}>
              {t('profile.remove')}
            </button>
          )}
        </div>
      </div>

      <div className="grid two">
        <label className="field">
          <span>{t('profile.titleLabel')}</span>
          <input type="text" value={exp.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('profile.orgLabel')}</span>
          <input type="text" value={exp.org} onChange={(e) => onChange({ org: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('profile.startLabel')}</span>
          <input type="text" value={exp.start} onChange={(e) => onChange({ start: e.target.value })} placeholder="2025-05" />
          <span className="hint">{t('profile.startHint')}</span>
        </label>
        <label className="field">
          <span>{t('profile.endLabel')}</span>
          <input
            type="text"
            value={exp.end ?? ''}
            onChange={(e) => onChange({ end: e.target.value || null, current: !e.target.value })}
            placeholder="2025-12"
          />
          <span className="hint">{t('profile.endHint')}</span>
        </label>
      </div>

      <label className="field">
        <span>{t('profile.bullets')}</span>
        <BulletList bullets={exp.bullets} onChange={(bullets) => onChange({ bullets })} />
        <span className="hint">{t('profile.bulletHint')}</span>
      </label>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
        <span className="tiny muted" style={{ display: 'block', marginBottom: 8 }}>
          {t('profile.tagsLabel')}
        </span>
        <div className="row" style={{ gap: 6 }}>
          {EXP_TAGS.map((tag) => {
            const on = exp.tags.includes(tag)
            return (
              <button
                key={tag}
                className={on ? 'small primary' : 'small ghost'}
                aria-pressed={on}
                onClick={() => onChange({ tags: on ? exp.tags.filter((x) => x !== tag) : [...exp.tags, tag] })}
              >
                {lang === 'zh' ? (TAG_ZH[tag] ?? tag) : tag.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export function ProfilePage() {
  const { profile, parseText, saveProfile, loadSample, ready, error, samples, sampleId, t } = useStore()
  const [raw, setRaw] = useState('')
  const [draft, setDraft] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openNew, setOpenNew] = useState<Experience | null>(null)
  const nav = useNavigate()

  // Whenever the store receives a new parsed profile, copy it into the editable draft.
  useEffect(() => {
    if (profile) setDraft(structuredClone(profile))
  }, [profile])

  const p = draft ?? profile

  /** Commit the pending new experience, dropping it if it is still completely empty. */
  function commitNew() {
    if (!p || !openNew) return
    const cleaned: Experience = { ...openNew, bullets: openNew.bullets.filter((b) => b.trim()) }
    const blank = !cleaned.title.trim() && !cleaned.org.trim() && cleaned.bullets.length === 0
    if (!blank) setDraft({ ...p, experiences: [...p.experiences, cleaned] })
    setOpenNew(null)
  }

  function setExp(i: number, patch: Partial<Experience>) {
    if (!p) return
    const next = [...p.experiences]
    next[i] = { ...next[i], ...patch }
    setDraft({ ...p, experiences: next })
  }

  const missing = useMemo(() => {
    if (!p) return []
    const problems: string[] = []
    if (!p.school.trim()) problems.push(t('profile.missingUniversity'))
    if (!p.degree.trim()) problems.push(t('profile.missingDegree'))
    if (p.skills.length === 0) problems.push(t('profile.missingSkill'))
    if (p.experiences.length === 0) problems.push(t('profile.missingExp'))
    if (p.experiences.length === 1) problems.push(t('profile.missingSecond'))
    const noDates = p.experiences.filter((e) => !e.start.trim()).length
    if (noDates > 0)
      problems.push(`${noDates} ${noDates > 1 ? t('profile.missingDatesPlural') : t('profile.missingDates')}`)
    const noBullets = p.experiences.filter((e) => e.bullets.filter((b) => b.trim()).length === 0).length
    if (noBullets > 0)
      problems.push(`${noBullets} ${noBullets > 1 ? t('profile.missingBulletsPlural') : t('profile.missingBullets')}`)
    return problems
  }, [p, t])

  return (
    <div className="wrap">
      <PageHead eyebrow={t('common.step1')} title={t('profile.title')}>
        <p>{t('profile.lede')}</p>
      </PageHead>

      <Trail here={0} />

      {!p && (
        <div className="grid two">
          <div className="card">
            <h3>{t('profile.optA')}</h3>
            <p className="small muted" style={{ marginTop: 0 }}>
              {t('profile.optABody')}
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t('profile.pastePlaceholder')}
              aria-label={t('profile.pastePlaceholder')}
            />
            <div className="actionbar">
              <button
                className="primary"
                disabled={!ready || busy || !raw.trim()}
                onClick={() => {
                  setBusy(true)
                  parseText(raw).finally(() => setBusy(false))
                }}
              >
                {t('profile.extract')}
              </button>
            </div>
          </div>

          <div className="card">
            <h3>{t('profile.optB')}</h3>
            <p className="small muted" style={{ marginTop: 0 }}>
              {t('profile.optBBody')}
            </p>
            {samples.length > 0 ? (
              <>
                <p className="tiny muted" style={{ margin: '10px 0 8px' }}>
                  {t('profile.samplesNote')}
                </p>
                <div className="row" style={{ gap: 8 }}>
                  {samples.map((s) => (
                    <button
                      key={s.id}
                      className={sampleId === s.id ? 'small primary' : 'small'}
                      disabled={!ready || busy}
                      title={s.has_offline_draft ? t('profile.hasOfflineDraft') : t('profile.needsModel')}
                      onClick={() => {
                        setBusy(true)
                        loadSample(s.id).finally(() => setBusy(false))
                      }}
                    >
                      {s.display_name} · {s.degree} {s.field}
                    </button>
                  ))}
                </div>
                <p className="tiny muted" style={{ marginBottom: 0 }}>
                  {t('profile.samplesNote2')}
                </p>
              </>
            ) : (
              <div className="actionbar">
                <button
                  disabled={!ready || busy}
                  onClick={() => {
                    setBusy(true)
                    loadSample().finally(() => setBusy(false))
                  }}
                >
                  {t('profile.loadSample')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="notice" style={{ marginTop: 18 }}>
          {error}
        </p>
      )}

      {p && (
        <>
          {samples.length > 0 && (
            <p className="tiny muted" style={{ marginBottom: 14 }}>
              {t('profile.switchSample')}{' '}
              {samples.map((s) => (
                <button
                  key={s.id}
                  className={sampleId === s.id ? 'small primary' : 'ghost small'}
                  disabled={busy}
                  style={{ marginRight: 6 }}
                  onClick={() => {
                    setBusy(true)
                    loadSample(s.id).finally(() => setBusy(false))
                  }}
                >
                  {s.display_name}
                </button>
              ))}
            </p>
          )}

          {missing.length > 0 && (
            <p className="notice" style={{ marginBottom: 18 }}>
              <strong>{t('profile.missingPrefix')}</strong> {missing.join('、')}。{t('profile.missingSuffix')}
            </p>
          )}

          <h2>{t('profile.basics')}</h2>
          <div className="card">
            <div className="grid two">
              <label className="field">
                <span>{t('profile.name')}</span>
                <input type="text" value={p.display_name} onChange={(e) => setDraft({ ...p, display_name: e.target.value })} />
                <span className="hint">{t('profile.nameHint')}</span>
              </label>
              <label className="field">
                <span>{t('profile.university')}</span>
                <input type="text" value={p.school} onChange={(e) => setDraft({ ...p, school: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('profile.degree')}</span>
                <input type="text" value={p.degree} onChange={(e) => setDraft({ ...p, degree: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('profile.field')}</span>
                <input type="text" value={p.field} onChange={(e) => setDraft({ ...p, field: e.target.value })} />
              </label>
            </div>
          </div>

          <h2>
            {t('profile.skills')} ({p.skills.length})
          </h2>
          <p className="section-note">{t('profile.skillsNote')}</p>
          <div className="card">
            <SkillEditor skills={p.skills} onChange={(skills) => setDraft({ ...p, skills })} />
          </div>

          <h2>
            {t('profile.experiences')} ({p.experiences.length})
          </h2>
          <p className="section-note">{t('profile.expNote')}</p>

          {p.experiences.map((exp, i) => (
            <ExperienceCard
              key={exp.id}
              exp={exp}
              index={i}
              total={p.experiences.length}
              onChange={(patch) => setExp(i, patch)}
              onRemove={() => setDraft({ ...p, experiences: p.experiences.filter((_, j) => j !== i) })}
              onDuplicate={() =>
                setDraft({
                  ...p,
                  experiences: [...p.experiences, { ...exp, id: newId('exp'), title: `${exp.title} (copy)` }],
                })
              }
              onMove={(dir) => {
                const to = i + dir
                if (to < 0 || to >= p.experiences.length) return
                const next = [...p.experiences]
                ;[next[i], next[to]] = [next[to], next[i]]
                setDraft({ ...p, experiences: next })
              }}
            />
          ))}

          {openNew ? (
            <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
              <div className="row tight" style={{ marginBottom: 14 }}>
                <span className="chip">{t('profile.newExp')}</span>
                <span className="small muted">{t('profile.newExpHint')}</span>
              </div>
              <div className="grid two">
                <label className="field">
                  <span>{t('profile.titleLabel')}</span>
                  <input
                    type="text"
                    value={openNew.title}
                    onChange={(e) => setOpenNew({ ...openNew, title: e.target.value })}
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span>{t('profile.orgLabel')}</span>
                  <input type="text" value={openNew.org} onChange={(e) => setOpenNew({ ...openNew, org: e.target.value })} />
                </label>
                <label className="field">
                  <span>{t('profile.startLabel')}</span>
                  <input type="text" value={openNew.start} onChange={(e) => setOpenNew({ ...openNew, start: e.target.value })} />
                </label>
                <label className="field">
                  <span>{t('profile.endLabel')}</span>
                  <input
                    type="text"
                    value={openNew.end ?? ''}
                    onChange={(e) => setOpenNew({ ...openNew, end: e.target.value || null, current: !e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span>{t('profile.bullets')}</span>
                <BulletList bullets={openNew.bullets} onChange={(bullets) => setOpenNew({ ...openNew, bullets })} />
              </label>
              <div className="actionbar" style={{ marginTop: 4 }}>
                <button className="primary" onClick={commitNew}>
                  {t('profile.addIt')}
                </button>
                <button onClick={() => setOpenNew(null)}>{t('profile.cancel')}</button>
                <button className="ghost" onClick={() => setOpenNew({ ...openNew, start: recentStart() })}>
                  {t('profile.recentDate')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn no-print"
              onClick={() => setOpenNew(EMPTY_EXPERIENCE())}
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
            >
              {t('profile.addExp')}
            </button>
          )}

          <div className="actionbar">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  if (draft) await saveProfile(draft)
                  setSaved(true)
                  nav('/tracks')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {t('profile.saveScore')}
            </button>
            <button
              className="no-print"
              disabled={busy || !draft}
              onClick={async () => {
                setBusy(true)
                try {
                  if (draft) await saveProfile(draft)
                  setSaved(true)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {t('profile.saveStay')}
            </button>
            {saved && <span className="small muted">{t('profile.saved')}</span>}
          </div>
        </>
      )}
    </div>
  )
}
