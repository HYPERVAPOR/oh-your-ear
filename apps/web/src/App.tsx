import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Route, Routes, useNavigate } from 'react-router-dom'

import { RequireAuth } from '@/components/require-auth'
import { Button } from '@/components/ui/button'
import { ChordExercise } from '@/components/exercises/chord-exercise'
import { IntervalExercise } from '@/components/exercises/interval-exercise'
import { MelodyExercise } from '@/components/exercises/melody-exercise'
import { RhythmExercise } from '@/components/exercises/rhythm-exercise'
import { SingleNoteExercise } from '@/components/exercises/single-note-exercise'
import { getPiano } from '@/lib/audio'
import { restoreSession } from '@/lib/auth'
import { useAppStore } from '@oh-your-ear/shared/prefs'
import { Home } from '@/pages/home'
import { Levels } from '@/pages/levels'
import { Login } from '@/pages/login'
import { Bookmarks } from '@/pages/bookmarks'
import { Daily } from '@/pages/daily'
import { Me } from '@/pages/me'
import { Mistakes } from '@/pages/mistakes'

function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-[32px] font-medium">404</h1>
      <p className="text-[15px] text-body">{t('notFound')}</p>
      <Button variant="outline" onClick={() => navigate('/')}>
        {t('actions.back')}
      </Button>
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.language)

  // The store is the source of truth for the language: i18next's detector keeps its
  // own copy, and without this the header could say English while the page is Chinese.
  useEffect(() => {
    if (i18n.language !== language) i18n.changeLanguage(language)
  }, [language])

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
      {/* Both modes are open to guests on purpose: they can see what is there, and
          starting anything asks them to sign in (PRD §6, non-blocking prompt). */}
      <Route path="/levels" element={<Levels />} />
      <Route path="/daily" element={<Daily />} />
      <Route path="/bookmarks" element={<Bookmarks />} />
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
