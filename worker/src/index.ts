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
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type',
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

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function newCode(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
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

function buildMessages(input: ExplainInput) {
  const subject = input.subject?.slice(0, 20) || '数学'
  const grade = input.grade?.slice(0, 20) || '中小学'
  const system = [
    `你是一位有二十年经验的${grade}${subject}老师，正在给学生做一对一讲解。`,
    '要求：',
    '1. 只用简体中文，语气平实，不要客套话和鼓励式套话。',
    '2. 有题目时：先说清楚学生的答案错在哪一步，再讲正确思路，最后给一句检验方法。',
    '3. 没有题目时：讲清这个知识点是什么、最容易错在哪里、怎么判断自己真的会了。',
    '4. 如果学生答案是空的，就当作没做出来，直接讲思路。',
    '5. 总长度控制在 220 字以内，不要用 Markdown 标题、不要编号列表超过四条。',
    '6. 不要编造教材页码、考试信息或超出范围的内容。',
  ].join('\n')

  const lines = [
    input.topic ? `知识点：${input.topic}` : '',
    input.chapter ? `所在章节：${input.chapter}` : '',
    input.context ? `知识点说明：${input.context}` : '',
    input.prompt ? `题目：${input.prompt}` : '',
    input.answer ? `标准答案：${input.answer}` : '',
    input.studentAnswer ? `学生的作答：${input.studentAnswer}` : input.prompt ? '学生的作答：（空白）' : '',
    input.explanation ? `题库原有解析：${input.explanation}` : '',
  ].filter(Boolean)

  return [
    { role: 'system', content: system },
    { role: 'user', content: lines.join('\n') },
  ]
}

async function runAi(env: Env, messages: { role: string; content: string }[]) {
  const models = [env.AI_MODEL, env.AI_FALLBACK_MODEL].filter(Boolean)
  let lastError = ''
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages,
        max_tokens: 640,
        temperature: 0.3,
      })
      const text = result?.response?.trim()
      if (text) return { text, model }
      lastError = `${model} 返回空内容`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || '模型调用失败')
}

async function handleExplain(request: Request, env: Env): Promise<Response> {
  let input: ExplainInput
  try {
    input = (await request.json()) as ExplainInput
  } catch {
    return fail('请求体不是合法 JSON')
  }
  if (!input.prompt && !input.topic) return fail('缺少题目或知识点')

  const messages = buildMessages(input)
  const hash = await sha256(JSON.stringify(messages))

  const cached = await env.DB.prepare('SELECT payload, model FROM ai_cache WHERE hash = ?')
    .bind(hash)
    .first<{ payload: string; model: string }>()
  if (cached) {
    return json({ ok: true, cached: true, model: cached.model, text: JSON.parse(cached.payload).text })
  }

  const limit = Number(env.AI_DAILY_LIMIT || 500)
  const day = todayKey()
  const usage = await env.DB.prepare(
    'INSERT INTO ai_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1 RETURNING count',
  )
    .bind(day)
    .first<{ count: number }>()
  if (usage && usage.count > limit) {
    return fail(`今日 AI 讲解额度已用完（${limit} 次），明天再来。`, 429)
  }

  try {
    const { text, model } = await runAi(env, messages)
    await env.DB.prepare(
      'INSERT INTO ai_cache (hash, payload, model, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET payload = excluded.payload',
    )
      .bind(hash, JSON.stringify({ text }), model, new Date().toISOString())
      .run()
    return json({ ok: true, cached: false, model, text })
  } catch (error) {
    return fail(error instanceof Error ? error.message : '模型调用失败', 502)
  }
}

async function handleCreateArchive(request: Request, env: Env): Promise<Response> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return fail('请求体不是合法 JSON')
  }
  const text = JSON.stringify(payload)
  const max = Number(env.MAX_ARCHIVE_BYTES || 900000)
  if (text.length > max) return fail(`备份体积 ${(text.length / 1024).toFixed(0)} KB 超过上限 ${(max / 1024).toFixed(0)} KB`, 413)

  const now = new Date().toISOString()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode()
    const exists = await env.DB.prepare('SELECT code FROM archives WHERE code = ?').bind(code).first()
    if (exists) continue
    await env.DB.prepare('INSERT INTO archives (code, payload, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(code, text, now, now)
      .run()
    return json({ ok: true, code, updatedAt: now })
  }
  return fail('生成同步码失败，请重试', 500)
}

async function handleReadArchive(code: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare('SELECT payload, updated_at FROM archives WHERE code = ?')
    .bind(code)
    .first<{ payload: string; updated_at: string }>()
  if (!row) return fail('同步码不存在或已被覆盖', 404)
  return json({ ok: true, code, updatedAt: row.updated_at, payload: JSON.parse(row.payload) })
}

async function handleWriteArchive(code: string, request: Request, env: Env): Promise<Response> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return fail('请求体不是合法 JSON')
  }
  const text = JSON.stringify(payload)
  const max = Number(env.MAX_ARCHIVE_BYTES || 900000)
  if (text.length > max) return fail(`备份体积超过上限 ${(max / 1024).toFixed(0)} KB`, 413)

  const row = await env.DB.prepare('SELECT code FROM archives WHERE code = ?').bind(code).first()
  if (!row) return fail('同步码不存在', 404)

  const now = new Date().toISOString()
  await env.DB.prepare('UPDATE archives SET payload = ?, updated_at = ? WHERE code = ?').bind(text, now, code).run()
  return json({ ok: true, code, updatedAt: now })
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
    limit: Number(env.AI_DAILY_LIMIT || 500),
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
    if (path === '/api/sync' && request.method === 'POST') return handleCreateArchive(request, env)

    const match = path.match(/^\/api\/sync\/([A-Za-z0-9]+)$/)
    if (match) {
      const code = normalizeCode(match[1])
      if (code.length < 6) return fail('同步码格式不对')
      if (request.method === 'GET') return handleReadArchive(code, env)
      if (request.method === 'PUT') return handleWriteArchive(code, request, env)
    }

    return fail('没有这个接口', 404)
  },
}
