import { hashPassword, randomHex, validPassword, validUsername, verifyPassword } from './auth'

interface D1Result<T> {
  results: T[]
  success: boolean
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<D1Result<unknown>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface AiBinding {
  run(model: string, input: unknown): Promise<{ response?: string }>
}

interface Env {
  DB: D1Database
  AI: AiBinding
  AI_MODEL: string
  AI_FALLBACK_MODEL: string
  AI_DAILY_LIMIT: string
  MAX_ARCHIVE_BYTES: string
  PROBE_TOKEN: string
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  })
}

function fail(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status)
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function todayKey(): string {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}

type ExplainInput = {
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

type Turn = { role: 'user' | 'assistant'; content: string }

function buildSystem(input: ExplainInput, followUp: boolean) {
  const subject = input.subject?.slice(0, 20) || '数学'
  const grade = input.grade?.slice(0, 20) || '中小学'
  return [
    `你是一位有二十年经验的${grade}${subject}老师，正在给学生一对一讲解。`,
    '输出格式（最重要，必须遵守）：',
    '- 用成对的 ** 双星号 标出关键内容：至少 3 处、最多 6 处，每处不超过 20 字，例如 **开方要取正负两个根**。',
    '- 只标结论、易错点、公式、关键步骤，不要整句或整段加粗。',
    '- 纯文本输出，不用 Markdown 标题、列表符号、代码块、表格。',
    '- 不要用 LaTeX 或 $ 符号，公式直接写普通字符，例如 (x-3)²=4、x=3±2。',
    '- 不要写成「学生：」「老师：」这样的对话体，直接用讲解口吻写。',
    '讲解原则：',
    '- 有题目时：先指出学生的答案错在哪一步，再讲正确过程，最后给一句检验方法。',
    '- 题目里指定了解法（配方法 / 公式法 / 因式分解法）就必须用指定解法，不能换成更快的解法。',
    '- 没有题目时：讲清这个知识点是什么、最容易错在哪里、怎么判断自己真的会了。',
    '- 学生答案是空的，就当作没做出来，直接讲思路。',
    followUp
      ? '- 学生在追问，只回答他问的那一点，不要重复上一条说过的话，不超过 160 字。'
      : '- 首次讲解不超过 220 字。',
    '- 不编造教材页码、考试信息，不扩展到本题无关的内容。',
    '- 学生问的与本题无关时，用一句话说明超范围，不要硬答。',
  ].join('\n')
}

const METHODS = ['配方法', '公式法', '因式分解法', '十字相乘法', '求根公式', '换元法', '待定系数法']

function buildContext(input: ExplainInput) {
  const method = METHODS.find((item) => input.prompt?.includes(item))
  const lines = [
    input.topic ? `知识点：${input.topic}` : '',
    input.chapter ? `所在章节：${input.chapter}` : '',
    input.context ? `知识点说明：${input.context}` : '',
    input.prompt ? `题目：${input.prompt}` : '',
    method ? `硬性要求：这道题必须用「${method}」讲，不许换成其他解法。` : '',
    input.answer ? `标准答案：${input.answer}` : '',
    input.studentAnswer ? `学生的作答：${input.studentAnswer}` : input.prompt ? '学生的作答：（空白）' : '',
    input.explanation ? `题库原有解析：${input.explanation}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

function buildMessages(input: ExplainInput, history: Turn[], question: string) {
  const followUp = history.length > 0 || question.length > 0
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: buildSystem(input, followUp) },
    { role: 'user', content: buildContext(input) },
  ]
  for (const turn of history) messages.push({ role: turn.role, content: turn.content })
  if (question) messages.push({ role: 'user', content: question })
  return messages
}

async function runAi(env: Env, messages: { role: string; content: string }[]) {
  const models = [env.AI_MODEL, env.AI_FALLBACK_MODEL].filter(Boolean)
  let lastError = ''
  for (const model of models) {
    try {
      const budget = /deepseek-r1|qwq/i.test(model) ? 1100 : 700
      const result = (await Promise.race([
        env.AI.run(model, { messages, max_tokens: budget, temperature: 0.3 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${model} 超时`)), 22000)),
      ])) as { response?: string }
      const raw = result?.response ?? ''
      const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '').trim()
      if (text) return { text, model }
      lastError = `${model} 返回空内容`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || '模型调用失败')
}

async function handleExplain(request: Request, env: Env): Promise<Response> {
  let body: ExplainInput & { history?: Turn[]; question?: string }
  try {
    body = (await request.json()) as ExplainInput & { history?: Turn[]; question?: string }
  } catch {
    return fail('请求体不是合法 JSON')
  }
  if (!body.prompt && !body.topic) return fail('缺少题目或知识点')

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((turn) => (turn?.role === 'user' || turn?.role === 'assistant') && typeof turn.content === 'string')
    .slice(-8)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1200) }))
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 300) : ''

  const messages = buildMessages(body, history, question)
  const firstTurn = history.length === 0 && !question
  const hash = await sha256(JSON.stringify(messages))

  if (firstTurn) {
    const cached = await env.DB.prepare('SELECT payload, model FROM ai_cache WHERE hash = ?')
      .bind(hash)
      .first<{ payload: string; model: string }>()
    if (cached) {
      return json({ ok: true, cached: true, model: cached.model, text: JSON.parse(cached.payload).text })
    }
  }

  const day = todayKey()
  await env.DB.prepare(
    'INSERT INTO ai_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1',
  )
    .bind(day)
    .run()

  try {
    const { text, model } = await runAi(env, messages)
    if (firstTurn) {
      await env.DB.prepare(
        'INSERT INTO ai_cache (hash, payload, model, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET payload = excluded.payload',
      )
        .bind(hash, JSON.stringify({ text }), model, new Date().toISOString())
        .run()
    }
    return json({ ok: true, cached: false, model, text })
  } catch (error) {
    return fail(error instanceof Error ? error.message : '模型调用失败', 502)
  }
}

type UserRow = {
  id: string
  username: string
  role: string
  created_at: string
  last_login_at: string | null
}

const SESSION_DAYS = 30

function bearer(request: Request): string {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

async function currentUser(request: Request, env: Env): Promise<UserRow | null> {
  const token = bearer(request)
  if (!token) return null
  const row = await env.DB.prepare(
    'SELECT u.id, u.username, u.role, u.created_at, u.last_login_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?',
  )
    .bind(token, new Date().toISOString())
    .first<UserRow>()
  return row ?? null
}

async function issueSession(env: Env, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomHex(32)
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000)
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, now.toISOString(), expires.toISOString())
    .run()
  return { token, expiresAt: expires.toISOString() }
}

async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await readBody<{ username?: string; password?: string }>(request)
  if (!body) return fail('请求体不是合法 JSON')
  const username = validUsername(body.username)
  if (!username) return fail('用户名需 3 到 20 位，只能用中文、字母、数字、下划线')
  const password = validPassword(body.password)
  if (!password) return fail('密码至少 6 位')

  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (exists) return fail('这个用户名已经被注册了', 409)

  const id = randomHex(12)
  const now = new Date().toISOString()
  await env.DB.prepare('INSERT INTO users (id, username, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, username, await hashPassword(password), 'user', now)
    .run()

  const session = await issueSession(env, id)
  return json({ ok: true, user: { id, username, role: 'user', createdAt: now }, ...session })
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await readBody<{ username?: string; password?: string }>(request)
  if (!body) return fail('请求体不是合法 JSON')
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return fail('请输入用户名和密码')

  const row = await env.DB.prepare('SELECT id, username, pass_hash, role, created_at FROM users WHERE username = ?')
    .bind(username)
    .first<UserRow & { pass_hash: string }>()
  if (!row) return fail('用户名或密码不对', 401)
  if (!(await verifyPassword(password, row.pass_hash))) return fail('用户名或密码不对', 401)

  const now = new Date().toISOString()
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now, row.id).run()
  const session = await issueSession(env, row.id)
  return json({
    ok: true,
    user: { id: row.id, username: row.username, role: row.role, createdAt: row.created_at },
    ...session,
  })
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const token = bearer(request)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  return json({ ok: true })
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env)
  if (!user) return fail('未登录', 401)
  return json({ ok: true, user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at } })
}

async function handleGetArchive(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env)
  if (!user) return fail('未登录', 401)
  const row = await env.DB.prepare('SELECT payload, updated_at FROM cloud_archives WHERE user_id = ?')
    .bind(user.id)
    .first<{ payload: string; updated_at: string }>()
  if (!row) return json({ ok: true, empty: true, payload: null, updatedAt: null })
  return json({ ok: true, empty: false, payload: JSON.parse(row.payload), updatedAt: row.updated_at })
}

async function handlePutArchive(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env)
  if (!user) return fail('未登录', 401)
  const payload = await readBody<unknown>(request)
  if (payload === null) return fail('请求体不是合法 JSON')
  const text = JSON.stringify(payload)
  const max = Number(env.MAX_ARCHIVE_BYTES || 900000)
  if (text.length > max) return fail(`备份体积 ${(text.length / 1024).toFixed(0)} KB 超过上限 ${(max / 1024).toFixed(0)} KB`, 413)

  const now = new Date().toISOString()
  await env.DB.prepare(
    'INSERT INTO cloud_archives (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
  )
    .bind(user.id, text, now)
    .run()
  return json({ ok: true, updatedAt: now })
}

async function requireAdmin(request: Request, env: Env): Promise<UserRow | Response> {
  const user = await currentUser(request, env)
  if (!user) return fail('未登录', 401)
  if (user.role !== 'admin') return fail('没有权限', 403)
  return user
}

async function handleAdminOverview(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(request, env)
  if (guard instanceof Response) return guard

  const users = await env.DB.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>()
  const archives = await env.DB.prepare(
    'SELECT count(*) AS n, coalesce(sum(length(payload)), 0) AS bytes FROM cloud_archives',
  ).first<{ n: number; bytes: number }>()
  const sessions = await env.DB.prepare('SELECT count(*) AS n FROM sessions WHERE expires_at > ?')
    .bind(new Date().toISOString())
    .first<{ n: number }>()
  const today = await env.DB.prepare('SELECT count FROM ai_usage WHERE day = ?').bind(todayKey()).first<{ count: number }>()
  const trend = await env.DB.prepare('SELECT day, count FROM ai_usage ORDER BY day DESC LIMIT 14').all<{ day: string; count: number }>()
  const total = await env.DB.prepare('SELECT coalesce(sum(count), 0) AS n FROM ai_usage').first<{ n: number }>()
  const recent = await env.DB.prepare(
    'SELECT username, role, created_at FROM users ORDER BY created_at DESC LIMIT 8',
  ).all<{ username: string; role: string; created_at: string }>()

  return json({
    ok: true,
    users: users?.n ?? 0,
    archives: archives?.n ?? 0,
    archiveBytes: archives?.bytes ?? 0,
    sessions: sessions?.n ?? 0,
    aiToday: today?.count ?? 0,
    aiTotal: total?.n ?? 0,
    trend: (trend?.results ?? []).reverse(),
    recent: recent?.results ?? [],
    model: env.AI_MODEL,
    time: new Date().toISOString(),
  })
}

async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(request, env)
  if (guard instanceof Response) return guard

  const rows = await env.DB.prepare(
    'SELECT u.id, u.username, u.role, u.created_at, u.last_login_at, length(a.payload) AS bytes, a.updated_at FROM users u LEFT JOIN cloud_archives a ON a.user_id = u.id ORDER BY u.created_at DESC LIMIT 200',
  ).all<{
    id: string
    username: string
    role: string
    created_at: string
    last_login_at: string | null
    bytes: number | null
    updated_at: string | null
  }>()

  return json({ ok: true, users: rows?.results ?? [] })
}

async function handleAdminDeleteUser(id: string, request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(request, env)
  if (guard instanceof Response) return guard
  if (guard.id === id) return fail('不能删除自己', 400)

  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM cloud_archives WHERE user_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return json({ ok: true })
}

async function handleHealth(env: Env): Promise<Response> {
  let db = 'down'
  let tables = 0
  try {
    const row = await env.DB.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").first<{ n: number }>()
    db = 'up'
    tables = row?.n ?? 0
  } catch {
    db = 'down'
  }
  return json({
    ok: db === 'up',
    db,
    tables,
    model: env.AI_MODEL,
    fallback: env.AI_FALLBACK_MODEL,
    time: new Date().toISOString(),
  })
}

const PROBE_MODELS = [
  '@cf/qwen/qwen2.5-7b-instruct',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/qwen/qwq-32b',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/google/gemma-3-12b-it',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
]

async function handleProbe(env: Env): Promise<Response> {
  const results: { model: string; ok: boolean; sample?: string; error?: string }[] = []
  for (const model of PROBE_MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: 'user', content: '用中文回答两个字：你好' }],
        max_tokens: 24,
      })
      results.push({ model, ok: true, sample: (out?.response || '').slice(0, 40) })
    } catch (error) {
      results.push({ model, ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 160) })
    }
  }
  return json({ results })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (path === '/api/health' && request.method === 'GET') return handleHealth(env)
    if (path === '/api/ai/probe' && request.method === 'GET') {
      if (!env.PROBE_TOKEN || url.searchParams.get('token') !== env.PROBE_TOKEN) return fail('没有这个接口', 404)
      return handleProbe(env)
    }
    if (path === '/api/ai/explain' && request.method === 'POST') return handleExplain(request, env)

    if (path === '/api/auth/register' && request.method === 'POST') return handleRegister(request, env)
    if (path === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env)
    if (path === '/api/auth/logout' && request.method === 'POST') return handleLogout(request, env)
    if (path === '/api/auth/me' && request.method === 'GET') return handleMe(request, env)

    if (path === '/api/archive' && request.method === 'GET') return handleGetArchive(request, env)
    if (path === '/api/archive' && request.method === 'PUT') return handlePutArchive(request, env)

    if (path === '/api/admin/overview' && request.method === 'GET') return handleAdminOverview(request, env)
    if (path === '/api/admin/users' && request.method === 'GET') return handleAdminUsers(request, env)

    const del = path.match(/^\/api\/admin\/users\/([a-f0-9]+)$/)
    if (del && request.method === 'DELETE') return handleAdminDeleteUser(del[1], request, env)

    return fail('没有这个接口', 404)
  },
}
