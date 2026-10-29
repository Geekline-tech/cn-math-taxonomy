import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'origin.theme'

type ThemeContextValue = {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* storage blocked */
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [resolved, setResolved] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && query.matches)
      document.documentElement.classList.toggle('dark', dark)
      setResolved(dark ? 'dark' : 'light')
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage blocked */
    }
  }, [])

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return context
}
