import { Link } from 'react-router-dom'
import { useStore } from '../store'

export function band(score: number): 'weak' | 'mid' | 'strong' {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'mid'
  return 'weak'
}

const BAND_KEY: Record<'weak' | 'mid' | 'strong', string> = {
  strong: 'band.strong',
  mid: 'band.mid',
  weak: 'band.weak',
}

/** A page title that says what the page is for and where it sits in the flow. */
export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="pagehead">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {children}
    </div>
  )
}

const STEPS: { to: string; key: string }[] = [
  { to: '/profile', key: 'trail.profile' },
  { to: '/tracks', key: 'trail.tracks' },
  { to: '/tracks/:id', key: 'trail.track' },
  { to: '/tracks/:id/report', key: 'trail.export' },
]

/**
 * Always shows which step the user is on and lets them jump to any step that
 * already has data. This is a workspace, not a wizard: nothing is blocked.
 */
export function Trail({ here, trackId }: { here: number; trackId?: string }) {
  const { t } = useStore()
  return (
    <nav className="trail" aria-label="Progress">
      {STEPS.map((s, i) => {
        const to = trackId ? s.to.replace(':id', trackId) : s.to
        const reachable = Boolean(trackId) || i === 0
        // The current step is a label, not a link, but it still has to carry the
        // highlight class — dropping it there was why the trail looked flat.
        const cls = i === here ? 'here' : i < here ? 'done' : ''
        const mark = i < here ? '✓ ' : ''
        return (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span className="arrow">›</span>}
            {reachable && i !== here ? (
              <Link to={to} className={cls}>
                {mark}
                {t(s.key)}
              </Link>
            ) : (
              <span className={cls} aria-current={i === here ? 'step' : undefined}>
                {mark}
                {t(s.key)}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export function ScoreRing({
  score,
  small,
  label,
  how,
}: {
  score: number
  small?: boolean
  label?: string
  how?: string
}) {
  const { t } = useStore()
  const bandName = band(score)
  return (
    <div className="scoreblock">
      <div
        className={`ring ${bandName}${small ? ' small' : ''}`}
        aria-label={`${Math.round(score)} ${t('common.outOf100')}`}
      >
        {Math.round(score)}
      </div>
      <div className="scoremeta">
        {label && <div className="label">{label}</div>}
        <div className="word">
          {t(BAND_KEY[bandName])} · {Math.round(score)}/100
        </div>
        {how && <div className="how">{how}</div>}
      </div>
    </div>
  )
}

export function Bar({ value, max = 1, tone }: { value: number; max?: number; tone?: 'mid' | 'weak' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`bar${tone ? ' ' + tone : ''}`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

const CAP_KEY: Record<string, string> = {
  action_share: 'cap.actionShare',
  no_first_person: 'cap.noFirstPerson',
  no_result: 'cap.noResult',
}

export function CapNote({ caps }: { caps: string[] }) {
  const { t } = useStore()
  if (!caps.length) return null
  return (
    <ul className="plain small" style={{ color: 'var(--warn)' }}>
      {caps.map((c) => (
        <li key={c}>{CAP_KEY[c] ? t(CAP_KEY[c]) : c}</li>
      ))}
    </ul>
  )
}

/** Says whether a line was written by the model or came from the offline set. */
export function DraftBadge({ by }: { by?: 'llm' | 'fixture' }) {
  const { t } = useStore()
  if (!by) return null
  return (
    <span
      className={`chip ${by === 'llm' ? '' : 'plain'}`}
      title={by === 'llm' ? t('draft.modelTitle') : t('draft.offlineTitle')}
    >
      {by === 'llm' ? t('draft.model') : t('draft.offline')}
    </span>
  )
}

/** Shown when the fact-check refused a draft because it invented something. */
export function RejectedNote({ problems }: { problems?: string[] }) {
  const { t } = useStore()
  if (!problems || !problems.length) return null
  const readable = problems.map((p) =>
    p.startsWith('new_number:')
      ? `${t('rejected.figure')}（${p.split(':')[1]}）`
      : p.startsWith('new_org:')
        ? `${t('rejected.org')}（${p.split(':')[1]}）`
        : p,
  )
  return (
    <p className="small" style={{ color: 'var(--warn)', margin: '6px 0 0' }}>
      {t('rejected.prefix')} {readable.join('、')}
      {t('rejected.suffix')}
    </p>
  )
}

export function Disclaimer({ text }: { text: string }) {
  return <p className="disclaimer">{text}</p>
}

export const DISCLAIMER_TEXT =
  'Pathfolio drafts wording from the experiences you supplied. It can miss context, repeat bias in job language, or invent details — if a suggestion adds a fact you did not enter, discard it. Scores measure how complete and structured your materials are. They are not an offer prediction and not an employer’s view of you. You decide what goes in the exported pack.'

export const DISCLAIMER_TEXT_ZH =
  'Pathfolio 依据你提供的经历起草文字。它可能漏掉背景、沿用招聘话术里的偏见，甚至编造细节——只要建议里多出你没填的事实，就丢掉它。分数衡量的是你的材料有多完整、多有条理，不预测录取结果，也不是雇主对你的评价。导出什么由你决定。'
