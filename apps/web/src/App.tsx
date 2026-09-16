import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Music, Layers, AudioLines, Timer, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PlayButton } from '@/components/play-button'
import { ChordExercise } from '@/components/exercises/chord-exercise'
import { IntervalExercise } from '@/components/exercises/interval-exercise'
import { SingleNoteExercise } from '@/components/exercises/single-note-exercise'
import { getPiano } from '@/lib/audio'
import { useAppStore, type Language, type Theme } from '@/stores/app-store'

const modules = [
  { key: 'singleNote', icon: Music },
  { key: 'interval', icon: Layers },
  { key: 'chord', icon: Volume2 },
  { key: 'melody', icon: AudioLines },
  { key: 'rhythm', icon: Timer },
] as const

export default function App() {
  const { t, i18n } = useTranslation('common')
  const { theme, language, setTheme, setLanguage } = useAppStore()
  const [view, setView] = useState<'home' | 'single-note' | 'interval' | 'chord'>('home')

  // Prefetch piano samples on mount so the first Play click is responsive.
  useEffect(() => {
    getPiano()
  }, [])

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  if (view === 'single-note') {
    return <SingleNoteExercise onBack={() => setView('home')} />
  }

  if (view === 'interval') {
    return <IntervalExercise onBack={() => setView('home')} />
  }

  if (view === 'chord') {
    return <ChordExercise onBack={() => setView('home')} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold">{t('appName')}</h1>
          <div className="flex items-center gap-3">
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
          {modules.map(({ key, icon: Icon }) => (
            <Button
              key={key}
              variant="outline"
              className="flex h-32 flex-col items-center justify-center gap-3 text-lg"
              onClick={() => {
                if (key === 'singleNote') setView('single-note')
                if (key === 'interval') setView('interval')
                if (key === 'chord') setView('chord')
              }}
            >
              <Icon className="h-8 w-8" />
              {t(`modules.${key}`)}
            </Button>
          ))}
        </div>
      </main>
    </div>
  )
}
