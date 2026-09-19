import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AppHeader } from '@/components/app-header'
import { PlayButton } from '@/components/play-button'
import { TodayProgress } from '@/components/today-progress'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ModuleSwatch, Orb, type ExerciseKind } from '@/components/ui/orb'
import { chainComplete, currentLevel, levelsFor, type LevelProgressEntry } from '@/lib/levels'
import { useAuthStore } from '@/stores/auth-store'

const MODULES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

/** One module's chain as a card: continue where you left off, or start at level 1. */
function LevelCard({
  kind,
  progress,
  signedIn,
}: {
  kind: ExerciseKind
  progress: Map<string, LevelProgressEntry>
  signedIn: boolean
}) {
  const { t } = useTranslation('common')
  const level = currentLevel(kind, progress)
  if (!level) return null

  const number = levelsFor(kind).findIndex((item) => item.id === level.id) + 1
  const entry = progress.get(level.id)
  const target = `/exercise/${level.module}?level=${level.id}`

  return (
    <Link
      to={signedIn ? target : '/login'}
      state={signedIn ? undefined : { from: target }}
      className="group block w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
    >
      <Card
        interactive
        className="relative h-full min-h-[132px] overflow-hidden p-5 transition-colors group-hover:border-hairline-strong"
      >
        <Orb
          kind={kind}
          size="md"
          className="-bottom-16 -right-12 transition-transform duration-500 group-hover:scale-110"
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <ModuleSwatch kind={kind} />
            <h3 className="text-[21px] font-light leading-tight">{t(`modules.${kind}`)}</h3>
          </div>
          <p className="mt-2 text-[15px] text-body">
            {chainComplete(kind, progress)
              ? t('levels.allPassed')
              : entry
                ? t('levels.continueAt', {
                    number,
                    percent: Math.round(entry.bestAccuracy * 100),
                  })
                : t('levels.startAt', { number })}
          </p>
        </div>
      </Card>
    </Link>
  )
}

const modules = [
  { key: 'singleNote', route: '/exercise/single-note' },
  { key: 'interval', route: '/exercise/interval' },
  { key: 'chord', route: '/exercise/chord' },
  { key: 'melody', route: '/exercise/melody' },
  { key: 'rhythm', route: '/exercise/rhythm' },
] as const

export function Home() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  const { data: progress } = useQuery({
    queryKey: ['level-progress'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/levels')
      return data
    },
  })

  const progressById = new Map<string, LevelProgressEntry>(
    (progress ?? []).map((entry) => [entry.levelId, entry]),
  )

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1">
        {/* Hero: the first thing a visitor meets is the sound itself, and the one
            action we want them to take. */}
        <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:pb-28 sm:pt-32">
          <Orb kind="ambient" size="lg" className="-top-28 left-1/2 -translate-x-1/2" />
          <div className="relative mx-auto flex max-w-[720px] flex-col items-center text-center">
            <h1 className="max-w-[24ch] text-balance text-[40px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[60px]">
              {t('tagline')}
            </h1>
            <p className="mt-6 text-[17px] leading-[1.7] text-body">
              <span className="block">{t('home.heroLine1')}</span>
              <span className="block">{t('home.heroLine2')}</span>
            </p>

            <Link
              to="/exercise/single-note"
              className={`${buttonVariants({ size: 'hero' })} mt-10`}
            >
              {t('home.startCta')}
            </Link>

            <div className="mt-9 flex items-center gap-3 text-muted">
              <PlayButton note="C4" className="h-11 w-11" />
              <span className="text-[15px]">{t('actions.playNote', { note: 'C4' })}</span>
            </div>

            {!user && <p className="mt-6 text-[14px] text-muted">{t('home.guestNote')}</p>}
          </div>
        </section>

        {user && (
          <section className="px-6 pb-4">
            <div className="mx-auto max-w-[1200px]">
              <TodayProgress />
            </div>
          </section>
        )}

        {/* The five modules, each carrying the orb colour it owns everywhere else. */}
        <section className="px-6 pb-24 sm:pb-32">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[26px] font-light sm:text-[32px]">{t('home.practiceHeading')}</h2>
            <p className="mt-3 max-w-[60ch] text-[14px] text-muted">{t('home.practiceHint')}</p>

            {/* Five modules in rows of three: the second row is centred, so there is
                no hole where a sixth card would have been. */}
            <div className="mt-8 flex flex-wrap justify-center gap-5">
              {modules.map(({ key, route }) => (
                <Link
                  key={key}
                  to={route}
                  className="group block w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
                >
                  <Card
                    interactive
                    className="relative h-full min-h-[132px] overflow-hidden p-5 transition-colors group-hover:border-hairline-strong"
                  >
                    <Orb
                      kind={key}
                      size="md"
                      className="-bottom-16 -right-12 transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="relative">
                      <h3 className="font-display text-[24px] font-light leading-tight">
                        {t(`modules.${key}`)}
                      </h3>
                      <p className="mt-2 max-w-[30ch] text-[15px] text-body">
                        {t(`moduleHints.${key}`)}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Daily practice: the plan's goal and today's progress, with the session
            one click away. */}
        <section className="px-6 pb-16">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[26px] font-light sm:text-[32px]">{t('daily.title')}</h2>
            <p className="mt-3 max-w-[60ch] text-[14px] text-muted">{t('home.dailyHint')}</p>

            <Link
              to="/daily"
              className="mt-8 block max-w-[520px] rounded-xl border border-hairline bg-surface px-6 py-5 transition-colors hover:border-hairline-strong"
            >
              <p className="text-[15px] font-medium">{t('daily.entry')}</p>
              <p className="mt-1 text-[14px] text-muted">
                {user ? t('daily.entryHint') : t('daily.entryHintGuest')}
              </p>
            </Link>
          </div>
        </section>

        {/* The third mode is laid out here, not hidden behind a link: the five
            chains' current levels are the invitation. */}
        <section className="px-6 pb-4">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[26px] font-light sm:text-[32px]">{t('levels.modeTitle')}</h2>
            <p className="mt-3 max-w-[60ch] text-[14px] text-muted">
              {user ? t('levels.modeHint') : t('levels.entryHintGuest')}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-5">
              {MODULES.map((kind) => (
                <LevelCard key={kind} kind={kind} progress={progressById} signedIn={!!user} />
              ))}
            </div>

            <div className="mt-6">
              <Link
                to="/levels"
                className="text-[15px] text-muted underline underline-offset-4 hover:text-ink"
              >
                {t('levels.viewAll')}
              </Link>
            </div>
          </div>
        </section>

        {!user && (
          <section className="px-6 pb-24 sm:pb-28">
            <div className="mx-auto max-w-[1200px]">
              <Card className="relative overflow-hidden p-7 sm:p-9">
                <Orb kind="ambient" size="md" className="-right-10 -top-20" />
                <div className="relative flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <h2 className="font-display text-[24px] font-light leading-tight">
                      {t('home.loginHeading')}
                    </h2>
                    <p className="mt-2 max-w-[46ch] text-[15px] text-body">
                      {t('home.loginCtaHint')}
                    </p>
                  </div>
                  <Link to="/login" className={buttonVariants({ size: 'lg' })}>
                    {t('actions.login')}
                  </Link>
                </div>
              </Card>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
