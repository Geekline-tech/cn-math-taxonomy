export const SUBJECTS = [
  { key: 'math', label: '数学', hint: '小学到高中' },
  { key: 'chinese', label: '语文', hint: '一至六年级' },
  { key: 'english', label: '英语', hint: '三年级到高中' },
  { key: 'physics', label: '物理', hint: '八年级到高中' },
] as const

export type SubjectKey = (typeof SUBJECTS)[number]['key']

export const SUBJECT_KEYS = SUBJECTS.map((s) => s.key)

export function isSubject(value: unknown): value is SubjectKey {
  return typeof value === 'string' && SUBJECT_KEYS.includes(value as SubjectKey)
}
