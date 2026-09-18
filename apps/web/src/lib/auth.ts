import { useAuthStore, type User } from '@/stores/auth-store'

async function fetchUser(token: string): Promise<User | null> {
  const res = await fetch('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return (await res.json()) as User
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.accessToken ?? null
}

/**
 * Completes a Google redirect and restores a session from the refresh cookie.
 * Runs once on boot, before the route guards decide anything.
 */
export async function restoreSession(): Promise<void> {
  const { setSession, setInitialized } = useAuthStore.getState()

  const match = window.location.hash.match(/access_token=([^&]+)/)
  if (match) {
    const token = decodeURIComponent(match[1])
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setSession(token, await fetchUser(token))
    setInitialized()
    return
  }

  const token = await refreshAccessToken()
  setSession(token, token ? await fetchUser(token) : null)
  setInitialized()
}
