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

export type CoreData = {
  topics: Topic[]
  deps: Dependency[]
  questions: Question[]
  aliases: Aliases
  standards: StandardsFile
}

async function getJson<T>(file: string): Promise<T> {
  const response = await fetch(`${BASE}data/${file}`)
  if (!response.ok) throw new Error(`${file} 加载失败（HTTP ${response.status}）`)
  return (await response.json()) as T
}

let corePromise: Promise<CoreData> | null = null

export function loadCore(): Promise<CoreData> {
  if (!corePromise) {
    corePromise = Promise.all([
      getJson<Topic[]>('topics.json'),
      getJson<Dependency[]>('dependencies.json'),
      getJson<Question[]>('questions.json'),
      getJson<Aliases>('id-aliases.json'),
      getJson<StandardsFile>('cn-curriculum-standards.json'),
    ])
      .then(([topics, deps, questions, aliases, standards]) => ({
        topics,
        deps,
        questions,
        aliases,
        standards,
      }))
      .catch((error: unknown) => {
        corePromise = null
        throw error
      })
  }
  return corePromise
}

const graphCache = new Map<SubjectKey, Graph>()

export async function loadSubjectGraph(subject: SubjectKey): Promise<Graph> {
  const cached = graphCache.get(subject)
  if (cached) return cached
  const core = await loadCore()
  const prefix = PREFIX[subject]
  const topics = core.topics.filter((topic) => topic.id.startsWith(prefix))
  const ids = new Set(topics.map((topic) => topic.id))
  const deps = core.deps.filter((dep) => ids.has(dep.topicId) && ids.has(dep.prerequisiteId))
  const questions = core.questions.filter((question) => ids.has(question.topicId))
  const graph = DiagEngine.buildGraph(topics, deps, questions)
  graphCache.set(subject, graph)
  return graph
}

export function standardsById(core: CoreData): Map<string, StandardItem> {
  return new Map(core.standards.items.map((item) => [item.id, item]))
}

export function resolveIds(raw: string, aliases: Aliases): string[] {
  const ids = DiagEngine.resolveTargets(raw, aliases as Record<string, unknown>)
  return ids
}
