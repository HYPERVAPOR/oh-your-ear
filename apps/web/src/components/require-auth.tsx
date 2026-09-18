import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth-store'

/** Blocks a route until the session restore has settled, then requires a user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const initialized = useAuthStore((s) => s.initialized)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!initialized) return null
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  return <>{children}</>
}
