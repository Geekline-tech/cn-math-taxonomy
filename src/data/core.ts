import DiagEngine from '@/engine/diag-engine'
import type { Dependency, Graph, Question, StandardItem, SubjectKey, Topic } from '@/engine/types'

const BASE = import.meta.env.BASE_URL

const PREFIX: Record<SubjectKey, string> = {
  math: 'cnm_',
  chinese: 'cnc_',
  english: 'cne_',
  physics: 'cnp_',
}

export type Aliases = Record<string, string[] | { targets?: string[] }>

export type StandardsFile = {
  items: StandardItem[]
  source?: Record<string, unknown>
}

export type BaseData = {
  topics: Topic[]
  deps: Dependency[]
  aliases: Aliases
  standards: StandardsFile
}

export type CoreData = BaseData & {
  questions: Question[]
}

async function getJson<T>(file: string): Promise<T> {
  const response = await fetch(`${BASE}data/${file}`)
  if (!response.ok) throw new Error(`${file} 加载失败（HTTP ${response.status}）`)
  return (await response.json()) as T
}

let basePromise: Promise<BaseData> | null = null
const questionPromises = new Map<SubjectKey, Promise<Question[]>>()

export function loadBase(): Promise<BaseData> {
  if (!basePromise) {
    basePromise = Promise.all([
      getJson<Topic[]>('topics.json'),
      getJson<Dependency[]>('dependencies.json'),
      getJson<Aliases>('id-aliases.json'),
      getJson<StandardsFile>('cn-curriculum-standards.json'),
    ])
      .then(([topics, deps, aliases, standards]) => ({ topics, deps, aliases, standards }))
      .catch((error: unknown) => {
        basePromise = null
        throw error
      })
  }
  return basePromise
}

export function loadQuestions(subject: SubjectKey): Promise<Question[]> {
  const cached = questionPromises.get(subject)
  if (cached) return cached
  const task = getJson<Question[]>(`questions-${subject}.json`).catch((error: unknown) => {
    questionPromises.delete(subject)
    throw error
  })
  questionPromises.set(subject, task)
  return task
}

const graphCache = new Map<string, Graph>()

export async function loadSubjectGraph(subject: SubjectKey, withQuestions = true): Promise<Graph> {
  const cacheKey = `${subject}:${withQuestions ? 'q' : 'nq'}`
  const cached = graphCache.get(cacheKey)
  if (cached) return cached
  const [base, questions] = await Promise.all([
    loadBase(),
    withQuestions ? loadQuestions(subject) : Promise.resolve([] as Question[]),
  ])
  const prefix = PREFIX[subject]
  const topics = base.topics.filter((topic) => topic.id.startsWith(prefix))
  const ids = new Set(topics.map((topic) => topic.id))
  const deps = base.deps.filter((dep) => ids.has(dep.topicId) && ids.has(dep.prerequisiteId))
  const graph = DiagEngine.buildGraph(topics, deps, questions)
  graphCache.set(cacheKey, graph)
  return graph
}

export function standardsById(standards: StandardsFile): Map<string, StandardItem> {
  return new Map(standards.items.map((item) => [item.id, item]))
}

export function resolveIds(raw: string, aliases: Aliases): string[] {
  return DiagEngine.resolveTargets(raw, aliases as Record<string, unknown>)
}
