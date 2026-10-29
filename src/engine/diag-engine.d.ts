import type {
  ChapterSummary,
  Dependency,
  GradeTargets,
  Graph,
  LayoutResult,
  NextItem,
  Question,
  Result,
  Session,
  SubjectKey,
  Summary,
  Topic,
  TopicStatus,
} from './types'

declare const DiagEngine: {
  DEFAULT_LIMIT: number
  SCREEN_LIMIT: number
  DEFAULT_CONFIRM: number
  CONFIRM_CHOICES: number[]
  clampConfirm(n: number): number
  normalizeConfirm(n: number): number
  needConfirm(graph: Graph, session: Session, id: string): number
  buildGraph(topics: Topic[], deps: Dependency[], questions?: Question[]): Graph
  questionById(graph: Graph, qid: string): Question | null
  pickQuestion(graph: Graph, session: Session, id: string, attempt: number): Question | null
  createSession(graph: Graph, targets: string[], opts?: Record<string, unknown>): Session
  applyAnswer(graph: Graph, session: Session, id: string, result: Result, extra?: { text?: string }): Session
  nextQuestion(graph: Graph, session: Session): string | null
  nextItem(graph: Graph, session: Session): NextItem | null
  isUnconfirmed(session: Session, id: string): boolean
  statusOf(session: Session, id: string): TopicStatus
  summarize(graph: Graph, session: Session): Summary
  layout(graph: Graph, session: Session, summary: Summary): LayoutResult
  chapterSummary(graph: Graph, session: Session): ChapterSummary[]
  gradeTargets(graph: Graph, scope: string, subject?: SubjectKey | 'all'): GradeTargets | null
  resolveTargets(rawIds: string | string[], aliases?: Record<string, unknown>): string[]
  ancestors(graph: Graph, ids: string | string[]): Set<string>
  subgraph(graph: Graph, targets: string[]): { nodes: string[]; set: Set<string> }
  topoSort(graph: Graph, ids: string[]): string[]
  isTestable(graph: Graph, id: string): boolean
  replay(graph: Graph, targets: string[], answers: Session['answers'], opts?: Record<string, unknown>): Session
  subjectOf(topic: Topic): SubjectKey
  parseChapter(chapter: string): { volume: string; chapterNo: string; chapterName: string; section: string }
  gradeRank(graph: Graph, id: string): number
  judgeQuestion(question: Question, userText: string): { verdict: 'correct' | 'wrong' | 'manual'; reason?: string }
  judgeAnswer(user: string, reference: string): { verdict: 'correct' | 'wrong' | 'manual'; reason?: string }
  normalizeText(text: string): string
  mulberry32(seed: number): () => number
}

export default DiagEngine
