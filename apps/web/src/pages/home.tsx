import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppHeader } from '@/components/app-header'
import { LevelRack } from '@/components/dashboard/level-rack'
import { RandomRack } from '@/components/dashboard/random-rack'
import { TodayPanel } from '@/components/dashboard/today-panel'

/**
 * The hub, laid out as a dashboard: today first, then what to learn, then somewhere to
 * just play (PRD 7.1.4). All three modes are visible to guests; only the recorded parts
 * of them need an account, and clicking one asks for it without hiding anything.
 */
export function Home() {
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 px-6 pb-24 pt-10 sm:pt-12">
        {/* Gutter outside the 1200px box and the same width as the header, so this column
            and the bar above it share an edge. */}
        <div className="mx-auto w-full max-w-[1200px] space-y-14">
          <TodayPanel />

          <section>
            <h2 className="text-[26px] font-medium sm:text-[32px]">{t('home.learnTitle')}</h2>
            <div className="mt-8">
              <LevelRack />
            </div>
            <div className="mt-6">
              <Link
                to="/levels"
                className="text-[15px] text-muted underline underline-offset-4 hover:text-ink"
              >
                {t('levels.viewAll')}
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-medium sm:text-[32px]">{t('home.randomTitle')}</h2>
            <div className="mt-8">
              <RandomRack />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
