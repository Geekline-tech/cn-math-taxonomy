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
  context?: string
}

export type Turn = { role: 'user' | 'assistant'; content: string }

export type ExplainRequest = ExplainInput & {
  history?: Turn[]
  question?: string
}

export type ExplainResult = {
  ok: boolean
  text: string
  model: string
  cached: boolean
}

export function explain(request: ExplainRequest): Promise<ExplainResult> {
  return requestPost('/api/ai/explain', request)
}

function requestPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
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
}

export function health(): Promise<HealthResult> {
  return request<HealthResult>('/api/health')
}

export type AuthUser = { id: string; username: string; role: string; createdAt: string }
export type AuthSession = { ok: boolean; user: AuthUser; token: string; expiresAt: string }

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

export function login(username: string, password: string): Promise<AuthSession> {
  return requestPost<AuthSession>('/api/auth/login', { username, password })
}

export function register(username: string, password: string): Promise<AuthSession> {
  return requestPost<AuthSession>('/api/auth/register', { username, password })
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', headers: authHeaders(token) })
}

export function me(token: string): Promise<{ ok: boolean; user: AuthUser }> {
  return request<{ ok: boolean; user: AuthUser }>('/api/auth/me', { headers: authHeaders(token) })
}

export type CloudArchive = { ok: boolean; empty: boolean; payload: unknown; updatedAt: string | null }

export function getArchive(token: string): Promise<CloudArchive> {
  return request<CloudArchive>('/api/archive', { headers: authHeaders(token) })
}

export function putArchive(token: string, payload: unknown): Promise<{ ok: boolean; updatedAt: string }> {
  return request<{ ok: boolean; updatedAt: string }>('/api/archive', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export type AdminOverview = {
  ok: boolean
  users: number
  archives: number
  archiveBytes: number
  sessions: number
  aiToday: number
  aiTotal: number
  trend: { day: string; count: number }[]
  recent: { username: string; role: string; created_at: string }[]
  model: string
  time: string
}

export function adminOverview(token: string): Promise<AdminOverview> {
  return request<AdminOverview>('/api/admin/overview', { headers: authHeaders(token) })
}

export type AdminUser = {
  id: string
  username: string
  role: string
  created_at: string
  last_login_at: string | null
  bytes: number | null
  updated_at: string | null
}

export function adminUsers(token: string): Promise<{ ok: boolean; users: AdminUser[] }> {
  return request<{ ok: boolean; users: AdminUser[] }>('/api/admin/users', { headers: authHeaders(token) })
}

export function adminDeleteUser(token: string, id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE', headers: authHeaders(token) })
}
