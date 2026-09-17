import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Routes, Route, useNavigate } from 'react-router-dom'
import { Music, Layers, AudioLines, Timer, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PlayButton } from '@/components/play-button'

import { ChordExercise } from '@/components/exercises/chord-exercise'
import { IntervalExercise } from '@/components/exercises/interval-exercise'
import { MelodyExercise } from '@/components/exercises/melody-exercise'
import { RhythmExercise } from '@/components/exercises/rhythm-exercise'
import { SingleNoteExercise } from '@/components/exercises/single-note-exercise'
import { getPiano } from '@/lib/audio'
import { useAppStore, type Language, type Theme } from '@/stores/app-store'
import { useAuthStore, type User } from '@/stores/auth-store'

const modules = [
  { key: 'singleNote', icon: Music, route: '/exercise/single-note' },
  { key: 'interval', icon: Layers, route: '/exercise/interval' },
  { key: 'chord', icon: Volume2, route: '/exercise/chord' },
  { key: 'melody', icon: AudioLines, route: '/exercise/melody' },
  { key: 'rhythm', icon: Timer, route: '/exercise/rhythm' },
] as const

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
  return data.access_token ?? null
}

function Home() {
  const { t, i18n } = useTranslation('common')
  const { theme, language, setTheme, setLanguage } = useAppStore()
  const { user, setAccessToken, setUser, logout } = useAuthStore()

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  async function handleMockLogin() {
    const res = await fetch('/api/v1/auth/mock', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.access_token) {
      setAccessToken(data.access_token)
      setUser(data.user as User)
    }
  }

  function handleGoogleLogin() {
    window.location.href = '/api/v1/auth/google'
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    logout()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold">{t('appName')}</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {t('auth.loggedInAs', { email: user.email })}
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  {t('actions.logout')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleMockLogin}>
                  {t('auth.loginMock')}
                </Button>
                <Button size="sm" onClick={handleGoogleLogin}>
                  {t('auth.loginWithGoogle')}
                </Button>
              </>
            )}
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
            </select>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="light">{t('theme.light')}</option>
              <option value="dark">{t('theme.dark')}</option>
              <option value="system">{t('theme.system')}</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-6 text-center text-lg text-muted-foreground">{t('tagline')}</p>

        <div className="mb-10 flex items-center gap-3">
          <PlayButton note="C4" />
          <span className="text-sm text-muted-foreground">{t('actions.play')} C4</span>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ key, icon: Icon, route }) => (
            <Link
              key={key}
              to={route}
              className="inline-flex h-32 flex-col items-center justify-center gap-3 rounded-md border border-border bg-background text-lg font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon className="h-8 w-8" />
              {t(`modules.${key}`)}
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">{t('notFound')}</p>
      <Button onClick={() => navigate('/')}>{t('actions.back')}</Button>
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const { accessToken, setAccessToken, setUser } = useAuthStore()

  // Prefetch piano samples on mount so the first Play click is responsive.
  useEffect(() => {
    getPiano()
  }, [])

  // Handle OAuth callback token and restore session on reload.
  useEffect(() => {
    async function initAuth() {
      const hash = window.location.hash
      const match = hash.match(/access_token=([^&]+)/)
      if (match) {
        const token = decodeURIComponent(match[1])
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        setAccessToken(token)
        const profile = await fetchUser(token)
        if (profile) setUser(profile)
        return
      }

      if (!accessToken) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          setAccessToken(refreshed)
          const profile = await fetchUser(refreshed)
          if (profile) setUser(profile)
        }
      }
    }
    initAuth()
  }, [accessToken, setAccessToken, setUser])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/exercise/single-note"
        element={<SingleNoteExercise onBack={() => navigate('/')} />}
      />
      <Route
        path="/exercise/interval"
        element={<IntervalExercise onBack={() => navigate('/')} />}
      />
      <Route path="/exercise/chord" element={<ChordExercise onBack={() => navigate('/')} />} />
      <Route path="/exercise/melody" element={<MelodyExercise onBack={() => navigate('/')} />} />
      <Route path="/exercise/rhythm" element={<RhythmExercise onBack={() => navigate('/')} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
