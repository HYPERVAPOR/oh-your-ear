import { create } from 'zustand'

import { queryClient } from '@/api/query-client'
import type { components } from '@/api/schema'

export type User = components['schemas']['UserResponse']

interface AuthState {
  accessToken: string | null
  user: User | null
  /** False until the boot-time session restore settles, so guards can wait for it. */
  initialized: boolean
  setSession: (accessToken: string | null, user: User | null) => void
  /** Replace the account in hand — after an avatar change, say — without touching tokens. */
  setUser: (user: User) => void
  setInitialized: () => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  initialized: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  setInitialized: () => set({ initialized: true }),
  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      set({ accessToken: null, user: null })
      // Everything in the cache is the account's progress, and it must not outlive the
      // session: the dashboard reads those numbers back (they are what drew the ghost
      // progress after signing out), and on a shared browser whoever signs in next would
      // see the previous account's figures until their own landed.
      queryClient.clear()
    }
  },
}))
