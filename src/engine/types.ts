export type SubjectKey = 'math' | 'chinese' | 'english' | 'physics'

export type Strength = 'hard' | 'soft'

export type Result = 'correct' | 'wrong' | 'skip'

export type TopicStatus = 'mastered' | 'shaky' | 'weak' | 'unknown'

export type Choice = {
  key: string
  text?: string
  figure?: string
}

export type Question = {
  id: string
  topicId: string
  difficulty: 'basic' | 'standard' | 'challenge' | 'advanced' | string
  type: 'choice' | 'numeric' | 'short' | 'self' | 'legacy' | string
  prompt: string
  answer: string
  explanation?: string
  verify?: string
  choices?: Choice[]
  figure?: string
  hideChoiceText?: boolean
  unordered?: boolean
  accept?: string[]
  percent?: boolean
}

export type Topic = {
  id: string
  name: string
  domain: string
  grade: number
  semester?: string
  chapter: string
  type?: string
  description?: string
  mastery_criteria?: string[]
  diagnostic_question?: { question: string; answer: string }
  external?: boolean
  standards?: { id: string; confidence?: string }[]
  root_reason?: string
  subject?: string
  mathLinks?: string[]
}

export type Dependency = {
  topicId: string
  prerequisiteId: string
  strength: Strength
  reason?: string
}

export type StandardItem = {
  id: string
  domain?: string
  section?: string
  clause?: string
  text: string
  page_or_ref?: string
  verbatim?: boolean
  text_status?: string
}

export type Prereq = { id: string; strength: Strength; reason?: string }

export type Graph = {
  topics: Topic[]
  byId: Record<string, Topic>
  index: Record<string, number>
  prereqs: Record<string, Prereq[]>
  dependents: Record<string, { id: string; strength: Strength }[]>
  bank: Record<string, Question[]>
  hasBank: boolean
}

export type Session = {
  targets: string[]
  limit: number
  confirm: number
  order: string[]
  status: Record<string, { s: Exclude<TopicStatus, 'unknown'>; src: 'direct' | 'inferred' }>
  stack: string[]
  answers: { id: string; qid: string | null; result: Result; text?: string }[]
  attempts: Record<string, { qid: string | null; result: Result }[]>
  mode: 'target' | 'screen'
  scope: string[] | null
  seed: string
  avoid: string[]
}

export type NextItem = { topicId: string; question: Question; attempt: number }

export type RootReason = {
  id: string
  pendingPrereqs: string[]
  outOfScopePrereqs: string[]
  externalPrereqs: string[]
}

export type PathNode = {
  id: string
  status: TopicStatus
  isRoot: boolean
  isTarget: boolean
}

export type Summary = {
  mode: 'target' | 'screen'
  targets: string[]
  asked: number
  limit: number
  finished: boolean
  limitReached: boolean
  mastered: string[]
  shaky: string[]
  weak: string[]
  unconfirmed: string[]
  untested: string[]
  roots: RootReason[]
  path: PathNode[]
}

export type LayoutNode = {
  id: string
  layer: number
  col: number
  cols: number
  status: TopicStatus
  isTarget: boolean
  isRoot: boolean
}

export type LayoutEdge = {
  from: string
  to: string
  direct: boolean
  strength: Strength
}

export type LayoutResult = {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  layers: number
  maxCols: number
}

export type ChapterSummary = {
  key: string
  volume: string
  chapterNo: string
  chapterName: string
  label: string
  total: number
  mastered: number
  shaky: number
  weak: number
  untested: number
  weakIds: string[]
  shakyIds: string[]
  untestedIds: string[]
}

export type GradeTargets = { ids: string[]; volumes: string[]; label: string }
