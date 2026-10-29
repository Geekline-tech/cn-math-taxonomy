import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isSubject, type SubjectKey } from './subjects'

type SubjectState = {
  subject: SubjectKey
  setSubject: (subject: SubjectKey) => void
}

export const useSubjectStore = create<SubjectState>()(
  persist(
    (set) => ({
      subject: 'math',
      setSubject: (subject) => set({ subject }),
    }),
    { name: 'origin.subject' },
  ),
)

export function useSubject() {
  const [params, setParams] = useSearchParams()
  const stored = useSubjectStore((state) => state.subject)
  const setStored = useSubjectStore((state) => state.setSubject)

  const fromUrl = params.get('subject')
  const subject = isSubject(fromUrl) ? fromUrl : stored
  const lastUrl = useRef<string | null>(null)

  useEffect(() => {
    if (fromUrl === lastUrl.current) return
    lastUrl.current = fromUrl
    if (isSubject(fromUrl) && fromUrl !== stored) setStored(fromUrl)
  }, [fromUrl, stored, setStored])

  useEffect(() => {
    document.documentElement.dataset.subject = subject
  }, [subject])

  const setSubject = useCallback(
    (next: SubjectKey) => {
      setStored(next)
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          if (next === 'math') copy.delete('subject')
          else copy.set('subject', next)
          return copy
        },
        { replace: true },
      )
    },
    [setStored, setParams],
  )

  return { subject, setSubject }
}
