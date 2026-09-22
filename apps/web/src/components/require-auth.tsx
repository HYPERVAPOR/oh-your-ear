import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { loginPath } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

/** Blocks a route until the session restore has settled, then requires a user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const initialized = useAuthStore((s) => s.initialized)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!initialized) return null
  // The search string has to come along: a level is addressed by `?level=`, and signing
  // in used to drop it and land on a blank practice screen.
  if (!user) return <Navigate to={loginPath(location.pathname + location.search)} replace />

  return <>{children}</>
}
