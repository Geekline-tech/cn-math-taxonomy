import type { SubjectKey } from './subjects'

export type Stage = 'primary' | 'junior' | 'senior'

export const STAGE_LABEL: Record<Stage, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
}

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

const SENIOR_DEFAULT = ['高一', '高二', '选必一', '选必二', '选必三', '选必四']
const SENIOR_ENGLISH = ['必修一', '必修二', '必修三', '选必一', '选必二', '选必三', '选必四']

export function stageOf(grade: number): Stage {
  if (grade <= 6) return 'primary'
  if (grade <= 9) return 'junior'
  return 'senior'
}

export function gradeLabel(subject: SubjectKey, grade: number): string {
  if (grade <= 9) return `${CN[grade - 1] ?? grade}年级`
  const names = subject === 'english' ? SENIOR_ENGLISH : SENIOR_DEFAULT
  return names[grade - 10] ?? `${grade} 年级`
}

export function stagesOf(grades: number[]): Stage[] {
  const present = new Set(grades.map(stageOf))
  return (['primary', 'junior', 'senior'] as const).filter((stage) => present.has(stage))
}

export function missingStages(grades: number[]): Stage[] {
  const present = new Set(grades.map(stageOf))
  return (['primary', 'junior', 'senior'] as const).filter((stage) => !present.has(stage))
}
