import { create } from 'zustand'

export interface User {
  id: string
  email: string
  name?: string | null
  avatar_url?: string | null
}

interface AuthState {
  accessToken: string | null
  user: User | null
  setAccessToken: (token: string | null) => void
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  logout: () => set({ accessToken: null, user: null }),
}))
