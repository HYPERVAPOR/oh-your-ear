import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppHeader } from '@/components/app-header'
import { LevelRack } from '@/components/dashboard/level-rack'
import { RandomRack } from '@/components/dashboard/random-rack'
import { TodayPanel } from '@/components/dashboard/today-panel'
import { cn } from '@/lib/utils'

const MODES = ['learn', 'random'] as const

/**
 * The hub, laid out as a dashboard: today first, then the five modules (PRD 7.1.4). The
 * three modes are all visible to guests — the two that need an account say so when they
 * are clicked, they are never hidden.
 */
export function Home() {
  const { t } = useTranslation('common')
  const [mode, setMode] = useState<(typeof MODES)[number]>('learn')

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 px-6 pb-24 pt-10 sm:pt-12">
        {/* Gutter outside the 1200px box and the same width as the header, so this column
            and the bar above it share an edge. */}
        <div className="mx-auto w-full max-w-[1200px] space-y-14">
          <TodayPanel />

          {/* One band, two tabs: Learn and Random test show the same five modules — the
              tab says what clicking one will do (a chain with progress, or endless
              practice), so the two used to be the same grid drawn twice. */}
          <section>
            <div
              role="group"
              aria-label={t('home.modeLabel')}
              className="inline-flex items-stretch divide-x divide-hairline-strong border border-hairline-strong"
            >
              {MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'h-10 px-4 text-[15px] transition-colors',
                    mode === value ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {t(value === 'learn' ? 'home.learnTitle' : 'home.randomTitle')}
                </button>
              ))}
            </div>

            <div className="mt-6">{mode === 'learn' ? <LevelRack /> : <RandomRack />}</div>

            {mode === 'learn' && (
              <div className="mt-6">
                <Link
                  to="/levels"
                  className="text-[15px] text-muted underline underline-offset-4 hover:text-ink"
                >
                  {t('levels.viewAll')}
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
