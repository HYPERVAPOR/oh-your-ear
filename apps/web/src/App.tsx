import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Routes, Route, useNavigate } from 'react-router-dom'
import { Music, Layers, AudioLines, Timer, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PlayButton } from '@/components/play-button'
import { RequireAuth } from '@/components/require-auth'
import { TodayProgress } from '@/components/today-progress'

import { ChordExercise } from '@/components/exercises/chord-exercise'
import { IntervalExercise } from '@/components/exercises/interval-exercise'
import { MelodyExercise } from '@/components/exercises/melody-exercise'
import { RhythmExercise } from '@/components/exercises/rhythm-exercise'
import { SingleNoteExercise } from '@/components/exercises/single-note-exercise'
import { getPiano } from '@/lib/audio'
import { restoreSession } from '@/lib/auth'
import { Login } from '@/pages/login'
import { Mistakes } from '@/pages/mistakes'
import { Me } from '@/pages/me'
import { useAppStore, type Language, type Theme } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

const modules = [
  { key: 'singleNote', icon: Music, route: '/exercise/single-note' },
  { key: 'interval', icon: Layers, route: '/exercise/interval' },
  { key: 'chord', icon: Volume2, route: '/exercise/chord' },
  { key: 'melody', icon: AudioLines, route: '/exercise/melody' },
  { key: 'rhythm', icon: Timer, route: '/exercise/rhythm' },
] as const

function Home() {
  const { t, i18n } = useTranslation('common')
  const { theme, language, setTheme, setLanguage } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold">{t('appName')}</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to="/me" className="text-sm text-muted-foreground hover:text-foreground">
                  {t('auth.account')}
                </Link>
                <Button variant="outline" size="sm" onClick={() => logout()}>
                  {t('actions.logout')}
                </Button>
              </>
            ) : (
              <Link to="/login" className="text-sm font-medium hover:underline">
                {t('actions.login')}
              </Link>
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

        <TodayProgress />

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

  // Prefetch piano samples and restore any existing session on mount.
  useEffect(() => {
    getPiano()
    restoreSession()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/me"
        element={
          <RequireAuth>
            <Me />
          </RequireAuth>
        }
      />
      <Route
        path="/mistakes"
        element={
          <RequireAuth>
            <Mistakes />
          </RequireAuth>
        }
      />
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
