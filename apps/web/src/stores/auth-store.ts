import { create } from 'zustand'

import type { components } from '@/api/schema'

export type User = components['schemas']['UserResponse']

interface AuthState {
  accessToken: string | null
  user: User | null
  /** False until the boot-time session restore settles, so guards can wait for it. */
  initialized: boolean
  setSession: (accessToken: string | null, user: User | null) => void
  setInitialized: () => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  initialized: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setInitialized: () => set({ initialized: true }),
  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      set({ accessToken: null, user: null })
    }
  },
}))
