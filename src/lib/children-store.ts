import type { SubjectKey } from '@/engine/types'

export type Child = {
  id: string
  name: string
  grade: string
  textbook: string
  createdAt: string
}

export type Archive = {
  v: 1
  current: string | null
  children: Child[]
}

export type ChildRecord = {
  key: string
  subject: SubjectKey
  label?: string
  mode?: 'target' | 'screen'
  asked?: number
  targets?: string[]
  mastered?: string[]
  shaky?: string[]
  weak?: string[]
  roots?: string[]
  counts?: Record<string, number>
  savedAt: string
  updatedAt?: string
}

export type Records = Record<string, ChildRecord[]>

export type Backup = {
  format: string
  version: 1
  exportedAt: string
  profiles: Archive
  records: Records
}

export type ImportSummary = {
  addedChildren: number
  matchedChildren: number
  renamedChildren: number
  addedRecords: number
  updatedRecords: number
  keptRecords: number
  children: { name: string; sourceName: string; action: 'add' | 'merge' | 'rename'; records: number }[]
  token: string
}

const KEY = 'cnmChildren.v1'
const REC_KEY = 'cnmChildren.records.v1'
const MAX_CHILDREN = 8
const MAX_RECORDS = 40
const MAX_BACKUP_BYTES = 10 * 1024 * 1024
const FORMAT = 'cn-math-taxonomy.children'

export const GRADES = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '七年级',
  '八年级',
  '九年级',
  '高一',
  '高二',
  '高三',
]

export const TEXTBOOKS = ['人教版', '北师大版', '苏教版', '沪教版', '外研版', '译林版', '其他']

export { MAX_CHILDREN }

function read<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return value == null ? fallback : (value as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function state(): Archive {
  const raw = read<Archive | null>(KEY, null)
  const archive: Archive =
    raw && Array.isArray(raw.children) ? raw : { v: 1, current: null, children: [] }
  if (archive.current && !archive.children.some((child) => child.id === archive.current)) {
    archive.current = archive.children.length ? archive.children[0].id : null
  }
  return archive
}

function allRecords(): Records {
  const raw = read<Records | null>(REC_KEY, null)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function list(): Child[] {
  return state().children.slice()
}

export function get(id: string): Child | null {
  return state().children.find((child) => child.id === id) ?? null
}

export function current(): Child | null {
  const archive = state()
  return archive.current ? get(archive.current) : null
}

export function setCurrent(id: string | null): boolean {
  const archive = state()
  if (id && !archive.children.some((child) => child.id === id)) return false
  archive.current = id
  return write(KEY, archive)
}

type Form = { name: string; grade: string; textbook: string }

function clean(form: Partial<Form>): Form {
  return {
    name: String(form.name ?? '').replace(/\s+/g, ' ').trim(),
    grade: GRADES.includes(form.grade ?? '') ? (form.grade as string) : '',
    textbook: TEXTBOOKS.includes(form.textbook ?? '') ? (form.textbook as string) : TEXTBOOKS[0],
  }
}

function check(archive: Archive, form: Form, selfId: string | null): string {
  if (!form.name) return '请填写孩子的昵称。'
  if (form.name.length > 12) return '昵称最多 12 个字。'
  if (!form.grade) return '请选择年级。'
  if (archive.children.some((child) => child.id !== selfId && child.name === form.name)) {
    return `已经有叫「${form.name}」的孩子了，换个昵称区分。`
  }
  return ''
}

export function add(form: Partial<Form>): { ok: boolean; error?: string; child?: Child } {
  const archive = state()
  const value = clean(form)
  if (archive.children.length >= MAX_CHILDREN) return { ok: false, error: `最多可以建 ${MAX_CHILDREN} 个孩子。` }
  const error = check(archive, value, null)
  if (error) return { ok: false, error }
  const child: Child = {
    id: newId(),
    ...value,
    createdAt: new Date().toISOString(),
  }
  archive.children.push(child)
  if (!archive.current) archive.current = child.id
  if (!write(KEY, archive)) {
    return { ok: false, error: '浏览器不允许保存数据（可能是隐私模式），档案无法保存。' }
  }
  return { ok: true, child }
}

export function update(id: string, form: Partial<Form>): { ok: boolean; error?: string; child?: Child } {
  const archive = state()
  const value = clean(form)
  const index = archive.children.findIndex((child) => child.id === id)
  if (index < 0) return { ok: false, error: '找不到这个孩子。' }
  const error = check(archive, value, id)
  if (error) return { ok: false, error }
  archive.children[index] = { ...archive.children[index], ...value }
  write(KEY, archive)
  return { ok: true, child: archive.children[index] }
}

export function remove(id: string) {
  const archive = state()
  archive.children = archive.children.filter((child) => child.id !== id)
  if (archive.current === id) archive.current = archive.children.length ? archive.children[0].id : null
  write(KEY, archive)
  const records = allRecords()
  delete records[id]
  write(REC_KEY, records)
}

export function recordsOf(childId: string): ChildRecord[] {
  const list = allRecords()[childId]
  return Array.isArray(list)
    ? list.slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
    : []
}

export function saveRecord(childId: string, record: ChildRecord): boolean {
  if (!childId || !record?.key) return false
  const all = allRecords()
  const list = Array.isArray(all[childId]) ? all[childId] : []
  const keepImported = list.length > MAX_RECORDS
  const index = list.findIndex((item) => item.key === record.key)
  const now = new Date().toISOString()
  if (index >= 0) list[index] = { ...record, savedAt: list[index].savedAt, updatedAt: now }
  else list.push({ ...record, savedAt: now, updatedAt: now })
  list.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
  all[childId] = keepImported ? list : list.slice(0, MAX_RECORDS)
  return write(REC_KEY, all)
}

export function removeRecord(childId: string, key: string) {
  const all = allRecords()
  if (!Array.isArray(all[childId])) return
  all[childId] = all[childId].filter((item) => item.key !== key)
  write(REC_KEY, all)
}

export type LatestStatus = Record<
  string,
  { status: 'mastered' | 'shaky' | 'weak'; recKey: string; at: string; label?: string; root: boolean; subject: SubjectKey }
>

export function latestStatus(childId: string, subject?: SubjectKey): LatestStatus {
  const records = recordsOf(childId)
    .filter((record) => !subject || record.subject === subject)
    .reverse()
  const by: LatestStatus = {}
  records.forEach((record) => {
    const roots: Record<string, boolean> = {}
    ;(record.roots ?? []).forEach((id) => {
      roots[id] = true
    })
    const put = (ids: string[] | undefined, status: 'mastered' | 'shaky' | 'weak') => {
      ;(ids ?? []).forEach((id) => {
        by[id] = {
          status,
          recKey: record.key,
          at: record.savedAt,
          label: record.label,
          root: !!roots[id],
          subject: record.subject,
        }
      })
    }
    put(record.mastered, 'mastered')
    put(record.shaky, 'shaky')
    put(record.weak, 'weak')
  })
  return by
}

export function exportBackup(): Backup {
  let profiles: Archive
  let records: Records
  try {
    const rawProfiles = localStorage.getItem(KEY)
    const rawRecords = localStorage.getItem(REC_KEY)
    profiles = rawProfiles === null ? { v: 1, current: null, children: [] } : JSON.parse(rawProfiles)
    records = rawRecords === null ? {} : JSON.parse(rawRecords)
  } catch {
    throw new Error('无法读取档案数据，未生成备份。请检查浏览器是否允许访问本机存储。')
  }
  if (!profiles || !Array.isArray(profiles.children) || !records || typeof records !== 'object') {
    throw new Error('档案数据格式异常，未生成备份。')
  }
  if (!profiles.children.length) throw new Error('还没有可导出的孩子档案。')
  return {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    records,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validDate(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validId(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
    ['__proto__', 'constructor', 'prototype'].indexOf(value) < 0
  )
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function checkArchive(profiles: unknown, records: unknown, allowEmpty: boolean) {
  if (
    !isObject(profiles) ||
    profiles.v !== 1 ||
    !Array.isArray(profiles.children) ||
    (!allowEmpty && !profiles.children.length) ||
    profiles.children.length > MAX_CHILDREN ||
    !isObject(records)
  ) {
    throw new Error('档案数据格式或数量不正确。')
  }
  const ids = new Set<string>()
  profiles.children.forEach((child) => {
    if (
      !isObject(child) ||
      !validId(child.id) ||
      ids.has(child.id as string) ||
      typeof child.name !== 'string' ||
      !child.name.trim() ||
      child.name.length > 12 ||
      GRADES.indexOf(child.grade as string) < 0 ||
      TEXTBOOKS.indexOf(child.textbook as string) < 0 ||
      !validDate(child.createdAt)
    ) {
      throw new Error('孩子资料不完整、ID 重复，或年级和教材版本不正确。')
    }
    ids.add(child.id as string)
  })
  if (profiles.current !== null && !ids.has(profiles.current as string)) {
    throw new Error('当前孩子不在备份档案中。')
  }
  Object.keys(records).forEach((id) => {
    if (!ids.has(id) || !Array.isArray(records[id])) throw new Error('诊断记录没有对应的孩子档案。')
    const keys = new Set<string>()
    ;(records[id] as unknown[]).forEach((record) => {
      if (
        !isObject(record) ||
        typeof record.key !== 'string' ||
        !record.key ||
        keys.has(record.key) ||
        ['math', 'chinese', 'english', 'physics'].indexOf(record.subject as string) < 0 ||
        !validDate(record.savedAt)
      ) {
        throw new Error('诊断记录的标识、学科或时间不正确。')
      }
      keys.add(record.key)
    })
  })
}

export function parseBackup(text: string): Backup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 10 MB。')
  let backup: unknown
  try {
    backup = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('文件不是有效的 JSON，档案未改变。')
  }
  if (!isObject(backup) || backup.format !== FORMAT) throw new Error('请选择本站导出的档案备份文件。')
  if (backup.version !== 1) throw new Error('暂不支持这个备份版本。')
  if (!validDate(backup.exportedAt)) throw new Error('备份导出时间不正确。')
  checkArchive(backup.profiles, backup.records, false)
  return backup as unknown as Backup
}

function snapshot() {
  const rawProfiles = localStorage.getItem(KEY)
  const rawRecords = localStorage.getItem(REC_KEY)
  const profiles: Archive = rawProfiles === null ? { v: 1, current: null, children: [] } : JSON.parse(rawProfiles)
  const records: Records = rawRecords === null ? {} : JSON.parse(rawRecords)
  checkArchive(profiles, records, true)
  return {
    profiles,
    records,
    rawRecords,
    token: JSON.stringify([rawProfiles, rawRecords]),
  }
}

function recordTime(record: ChildRecord) {
  return Math.max(Date.parse(record.savedAt), Date.parse(record.updatedAt || record.savedAt))
}

function prepare(backup: Backup) {
  const before = snapshot()
  const profiles = copy(before.profiles)
  const records = copy(before.records)
  const byId = new Map(profiles.children.map((child) => [child.id, child]))
  const names = new Set(profiles.children.map((child) => child.name))
  const additions = backup.profiles.children.filter((child) => !byId.has(child.id)).length
  if (profiles.children.length + additions > MAX_CHILDREN) {
    throw new Error(`合并后会超过 ${MAX_CHILDREN} 个孩子，请先整理现有档案。`)
  }
  backup.profiles.children.forEach((child) => {
    if (!byId.has(child.id)) names.add(child.name)
  })
  const summary: ImportSummary = {
    addedChildren: 0,
    matchedChildren: 0,
    renamedChildren: 0,
    addedRecords: 0,
    updatedRecords: 0,
    keptRecords: 0,
    children: [],
    token: before.token,
  }
  const usedNames = new Set(profiles.children.map((child) => child.name))

  backup.profiles.children.forEach((source) => {
    let child = byId.get(source.id)
    let action: 'add' | 'merge' | 'rename' = 'merge'
    if (child) {
      summary.matchedChildren += 1
    } else {
      child = copy(source)
      if (usedNames.has(child.name)) {
        let n = 1
        let candidate = ''
        do {
          const suffix = n === 1 ? '（导入）' : `（导入${n}）`
          candidate = source.name.slice(0, Math.max(0, 12 - suffix.length)) + suffix
          n += 1
        } while (names.has(candidate))
        child.name = candidate
        summary.renamedChildren += 1
        action = 'rename'
      } else {
        action = 'add'
      }
      usedNames.add(child.name)
      names.add(child.name)
      byId.set(child.id, child)
      profiles.children.push(child)
      summary.addedChildren += 1
    }

    const merged = new Map<string, ChildRecord>()
    ;(records[child.id] ?? []).forEach((record) => merged.set(record.key, record))
    ;(backup.records[child.id] ?? []).forEach((record) => {
      const old = merged.get(record.key)
      if (!old) {
        merged.set(record.key, copy(record))
        summary.addedRecords += 1
      } else if (recordTime(record) > recordTime(old)) {
        merged.set(record.key, copy(record))
        summary.updatedRecords += 1
      } else {
        summary.keptRecords += 1
      }
    })
    if (records[child.id] || backup.records[child.id]) records[child.id] = Array.from(merged.values())
    summary.children.push({ name: child.name, sourceName: source.name, action, records: merged.size })
  })

  if (!before.profiles.children.length) profiles.current = backup.profiles.current
  return { before, profiles, records, summary }
}

export function previewImport(backup: Backup): ImportSummary {
  return prepare(backup).summary
}

export function importBackup(backup: Backup, token: string): ImportSummary {
  const plan = prepare(backup)
  if (token !== plan.before.token) throw new Error('本机档案已发生变化，请重新预览后再导入。')
  let recordsWritten = false
  try {
    localStorage.setItem(REC_KEY, JSON.stringify(plan.records))
    recordsWritten = true
    localStorage.setItem(KEY, JSON.stringify(plan.profiles))
  } catch {
    if (recordsWritten) {
      try {
        if (plan.before.rawRecords === null) localStorage.removeItem(REC_KEY)
        else localStorage.setItem(REC_KEY, plan.before.rawRecords)
      } catch {
        throw new Error('导入未完成，原记录恢复失败。请保留备份文件并检查浏览器存储。')
      }
    }
    throw new Error('浏览器无法保存导入数据，原有档案和记录未改变。')
  }
  return plan.summary
}
