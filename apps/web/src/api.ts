// Every API call carries the app's own base path, so one build works both at '/'
// (dev, preview) and under a prefix like '/pathfolio/'. BASE_URL is '/' in dev.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* keep statusText */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => req<{ ok: boolean; fixture_mode: boolean; llm_enabled: boolean }>('/healthz'),
  createSession: () => req<{ session_id: string }>('/v1/session', { method: 'POST', body: '{}' }),
  parseProfile: (session_id: string, raw_text = '', use_sample: boolean | string = false) =>
    req<{ profile: import('./types').Profile; stripped_fields: string[]; drafted_by?: string; sample_id?: string | null }>(
      '/v1/profile/parse',
      {
        method: 'POST',
        body: JSON.stringify({ session_id, raw_text, use_sample }),
      },
    ),
  samples: () => req<import('./types').SampleList>('/v1/samples'),
  saveProfile: (session_id: string, profile: import('./types').Profile) =>
    req<{ profile: import('./types').Profile }>('/v1/profile', {
      method: 'PUT',
      body: JSON.stringify({ session_id, profile }),
    }),
  recommend: (session_id: string) =>
    req<import('./types').RecommendResponse>('/v1/tracks/recommend', {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),
  scan: (session_id: string, track_id: string) =>
    req<{ scan: import('./types').ResumeScan }>('/v1/resume/scan', {
      method: 'POST',
      body: JSON.stringify({ session_id, track_id }),
    }),
  suggest: (session_id: string, track_id: string) =>
    req<{ suggestions: import('./types').Suggestion[] }>('/v1/resume/suggest', {
      method: 'POST',
      body: JSON.stringify({ session_id, track_id }),
    }),
  stories: (session_id: string, track_id: string) =>
    req<{ stories: import('./types').StarStory[] }>('/v1/stories/generate', {
      method: 'POST',
      body: JSON.stringify({ session_id, track_id }),
    }),
  scoreStory: (story: Partial<import('./types').StarStory>) =>
    req<import('./types').StarStory>('/v1/stories/score', { method: 'POST', body: JSON.stringify({ story }) }),
  strategy: (session_id: string, track_id: string) =>
    req<import('./types').Strategy>('/v1/strategy', {
      method: 'POST',
      body: JSON.stringify({ session_id, track_id }),
    }),
  decide: (session_id: string, item_id: string, status: string, user_text?: string) =>
    req<{ ok: boolean }>('/v1/decision', {
      method: 'POST',
      body: JSON.stringify({ session_id, item_id, status, user_text }),
    }),
  report: (session_id: string, track_id: string) =>
    req<Record<string, unknown>>(`/v1/export/${session_id}/${track_id}`),
  destroy: (session_id: string) =>
    req<{ ok: boolean }>(`/v1/session/${session_id}`, { method: 'DELETE' }),
}
