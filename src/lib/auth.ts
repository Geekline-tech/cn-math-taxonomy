import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from './api'

type AuthState = {
  token: string
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: '',
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: '', user: null }),
    }),
    { name: 'origin.auth' },
  ),
)

export function useAuth() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  return {
    token,
    user,
    signedIn: Boolean(token && user),
    isAdmin: user?.role === 'admin',
  }
}
