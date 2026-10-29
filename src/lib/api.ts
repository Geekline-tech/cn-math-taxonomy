const RAW = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
export const API_BASE = RAW.replace(/\/+$/, '')
export const apiEnabled = API_BASE.length > 0

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  const body = data as { ok?: boolean; error?: string } | null
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `接口返回 ${response.status}`)
  }
  return data as T
}

export type ExplainInput = {
  subject?: string
  grade?: string
  topic?: string
  chapter?: string
  prompt?: string
  answer?: string
  studentAnswer?: string
  explanation?: string
}

export type ExplainResult = {
  ok: boolean
  text: string
  model: string
  cached: boolean
}

export function explain(input: ExplainInput): Promise<ExplainResult> {
  return request<ExplainResult>('/api/ai/explain', { method: 'POST', body: JSON.stringify(input) })
}

export type CloudSaveResult = { ok: boolean; code: string; updatedAt: string }
export type CloudLoadResult = { ok: boolean; code: string; updatedAt: string; payload: unknown }

export function cloudSave(payload: unknown): Promise<CloudSaveResult> {
  return request<CloudSaveResult>('/api/sync', { method: 'POST', body: JSON.stringify(payload) })
}

export function cloudLoad(code: string): Promise<CloudLoadResult> {
  return request<CloudLoadResult>(`/api/sync/${encodeURIComponent(code.trim().toUpperCase())}`)
}

export type HealthResult = {
  ok: boolean
  db: string
  tables: number
  model: string
  fallback: string
  limit: number
}

export function health(): Promise<HealthResult> {
  return request<HealthResult>('/api/health')
}
