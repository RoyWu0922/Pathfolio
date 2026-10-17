import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Profile, SampleInfo, TrackScore } from './types'
import { api } from './api'
import { translate, type Lang } from './i18n'

interface Store {
  sessionId: string | null
  profile: Profile | null
  tracks: TrackScore[]
  trackSource: 'llm' | 'fixture' | null
  pickedBy: 'ranking' | 'llm' | null
  considered: number
  samples: SampleInfo[]
  sampleId: string | null
  ready: boolean
  fixtureMode: boolean
  error: string | null
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: string) => string
  loadSample: (id?: string) => Promise<void>
  parseText: (raw: string) => Promise<void>
  saveProfile: (p: Profile) => Promise<void>
  recommend: () => Promise<void>
  setError: (e: string | null) => void
  reset: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
const LANG_KEY = 'pathfolio.lang'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tracks, setTracks] = useState<TrackScore[]>([])
  const [trackSource, setTrackSource] = useState<'llm' | 'fixture' | null>(null)
  const [pickedBy, setPickedBy] = useState<'ranking' | 'llm' | null>(null)
  const [considered, setConsidered] = useState(0)
  const [samples, setSamples] = useState<SampleInfo[]>([])
  const [sampleId, setSampleId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [fixtureMode, setFixtureMode] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY)
      if (saved === 'en' || saved === 'zh') return saved
    } catch {
      /* storage blocked in private mode */
    }
    return 'en'
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleLang = useCallback(() => setLang(lang === 'en' ? 'zh' : 'en'), [lang, setLang])

  const t = useCallback((key: string) => translate(key, lang), [lang])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
  }, [lang])

  useEffect(() => {
    ;(async () => {
      try {
        const h = await api.health()
        setFixtureMode(h.fixture_mode)
        const s = await api.createSession()
        setSessionId(s.session_id)
        try {
          const list = await api.samples()
          setSamples(list.samples)
        } catch {
          /* the sample menu is optional; the paste box still works */
        }
      } catch (e) {
        setError(`Cannot reach the API. Start it with uvicorn on port 8000. (${String(e)})`)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const loadSample = useCallback(
    async (id?: string) => {
      if (!sessionId) return
      setError(null)
      try {
        const { profile: p, sample_id } = await api.parseProfile(sessionId, '', id ?? true)
        setProfile(p)
        setSampleId(sample_id ?? null)
        const res = await api.recommend(sessionId)
        setTracks(res.tracks)
        setTrackSource(res.drafted_by === 'llm' ? 'llm' : 'fixture')
        setPickedBy(res.picked_by ?? 'ranking')
        setConsidered(res.considered ?? res.tracks.length)
      } catch (e) {
        setError(String(e))
      }
    },
    [sessionId],
  )

  const parseText = useCallback(
    async (raw: string) => {
      if (!sessionId) return
      setError(null)
      try {
        const { profile: p } = await api.parseProfile(sessionId, raw, false)
        setProfile(p)
        setTracks([])
      } catch (e) {
        setError(String(e))
      }
    },
    [sessionId],
  )

  const saveProfile = useCallback(
    async (p: Profile) => {
      if (!sessionId) return
      setError(null)
      try {
        const { profile: saved } = await api.saveProfile(sessionId, p)
        setProfile(saved)
        const { tracks: found, drafted_by } = await api.recommend(sessionId)
        setTracks(found)
        setTrackSource(drafted_by === 'llm' ? 'llm' : 'fixture')
      } catch (e) {
        setError(String(e))
      }
    },
    [sessionId],
  )

  const recommend = useCallback(async () => {
    if (!sessionId) return
    const res = await api.recommend(sessionId)
    setTracks(res.tracks)
    setTrackSource(res.drafted_by === 'llm' ? 'llm' : 'fixture')
    setPickedBy(res.picked_by ?? 'ranking')
    setConsidered(res.considered ?? res.tracks.length)
  }, [sessionId])

  const reset = useCallback(async () => {
    if (sessionId) await api.destroy(sessionId).catch(() => undefined)
    const s = await api.createSession()
    setSessionId(s.session_id)
    setProfile(null)
    setTracks([])
  }, [sessionId])

  const value = useMemo(
    () => ({
      sessionId,
      profile,
      tracks,
      trackSource,
      pickedBy,
      considered,
      samples,
      sampleId,
      ready,
      fixtureMode,
      error,
      lang,
      setLang,
      toggleLang,
      t,
      loadSample,
      parseText,
      saveProfile,
      recommend,
      setError,
      reset,
    }),
    [
      sessionId,
      profile,
      tracks,
      trackSource,
      pickedBy,
      considered,
      samples,
      sampleId,
      ready,
      fixtureMode,
      error,
      lang,
      setLang,
      toggleLang,
      t,
      loadSample,
      parseText,
      saveProfile,
      recommend,
      reset,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
