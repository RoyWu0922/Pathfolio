// Visitor-supplied model credentials.
//
// Stored in this browser only, and sent as request headers so the API can use
// them for that one call. Nothing is written to a session or a log server-side.

export interface LlmConfig {
  key: string
  base: string
  model: string
}

const STORAGE_KEY = 'pathfolio.llm'

const EMPTY: LlmConfig = { key: '', base: '', model: '' }

export function loadLlm(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<LlmConfig>
    return {
      key: typeof parsed.key === 'string' ? parsed.key : '',
      base: typeof parsed.base === 'string' ? parsed.base : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveLlm(cfg: LlmConfig): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ key: cfg.key.trim(), base: cfg.base.trim(), model: cfg.model.trim() }),
    )
  } catch {
    /* storage blocked in private mode — the key still works for this page */
  }
}

export function clearLlm(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasLlmKey(): boolean {
  return loadLlm().key.trim().length > 0
}

/** Headers for one request. Empty when the visitor has not supplied a key. */
export function llmHeaders(): Record<string, string> {
  const cfg = loadLlm()
  const key = cfg.key.trim()
  if (!key) return {}
  const out: Record<string, string> = { 'X-LLM-Key': key }
  if (cfg.base.trim()) out['X-LLM-Base'] = cfg.base.trim()
  if (cfg.model.trim()) out['X-LLM-Model'] = cfg.model.trim()
  return out
}
