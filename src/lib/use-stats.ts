import { useEffect, useState } from 'react'
import type { SubjectKey } from './subjects'

export type GradeBucket = {
  grade: number
  label: string
  stage: 'primary' | 'junior' | 'senior'
  count: number
}

export type SubjectStats = {
  key: SubjectKey
  label: string
  topics: number
  edges: { total: number; hard: number; soft: number }
  questions: number
  standards: number
  grades: GradeBucket[]
  domains: { name: string; count: number }[]
}

export type StatsPayload = {
  generatedAt: string
  subjects: Record<SubjectKey, SubjectStats>
}

type State = {
  data: StatsPayload | null
  error: string | null
}

let cache: StatsPayload | null = null

export function useStats(): State {
  const [state, setState] = useState<State>({ data: cache, error: null })

  useEffect(() => {
    if (cache) return
    let alive = true
    fetch(`${import.meta.env.BASE_URL}data/stats.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<StatsPayload>
      })
      .then((payload) => {
        cache = payload
        if (alive) setState({ data: payload, error: null })
      })
      .catch((error: unknown) => {
        if (alive) setState({ data: null, error: error instanceof Error ? error.message : '数据加载失败' })
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}
