import { useEffect, useState } from 'react'
import { loadSubjectGraph } from '@/data/core'
import type { Graph, SubjectKey } from '@/engine/types'

type State = {
  graph: Graph | null
  error: string | null
}

export function useGraph(subject: SubjectKey, withQuestions = true): State {
  const [state, setState] = useState<State>({ graph: null, error: null })

  useEffect(() => {
    let alive = true
    setState({ graph: null, error: null })
    loadSubjectGraph(subject, withQuestions)
      .then((graph) => {
        if (alive) setState({ graph, error: null })
      })
      .catch((error: unknown) => {
        if (alive) setState({ graph: null, error: error instanceof Error ? error.message : '图谱加载失败' })
      })
    return () => {
      alive = false
    }
  }, [subject, withQuestions])

  return state
}
