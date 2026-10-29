import { useEffect } from 'react'
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
  const subject = useSubjectStore((state) => state.subject)
  const setSubject = useSubjectStore((state) => state.setSubject)

  useEffect(() => {
    const fromUrl = params.get('subject')
    if (isSubject(fromUrl) && fromUrl !== subject) setSubject(fromUrl)
  }, [params, subject, setSubject])

  useEffect(() => {
    document.documentElement.dataset.subject = subject
    const next = new URLSearchParams(params)
    if (subject === 'math') next.delete('subject')
    else next.set('subject', subject)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [subject, params, setParams])

  return { subject, setSubject }
}
