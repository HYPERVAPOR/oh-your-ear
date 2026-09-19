import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AppHeader } from '@/components/app-header'
import { modulePath } from '@/components/round-summary'
import { TodayProgress } from '@/components/today-progress'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MODULE_SWATCH, ModuleSwatch, type ExerciseKind } from '@/components/ui/orb'
import {
  chainComplete,
  currentLevel,
  pickText,
  useLevelCatalog,
  type LevelProgressEntry,
  type LevelSet,
} from '@/lib/levels'
import { useAuthStore } from '@/stores/auth-store'

const MODULES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

/** One module's chain as a card: continue where you left off, or start at level 1. */
function LevelCard({
  sets,
  kind,
  progress,
  signedIn,
}: {
  sets: LevelSet[]
  kind: ExerciseKind
  progress: Map<string, LevelProgressEntry>
  signedIn: boolean
}) {
  const { t, i18n } = useTranslation('common')
  const level = currentLevel(sets, kind, progress)
  if (!level) return null

  const entry = progress.get(level.slug)
  const target = `/exercise/${modulePath(kind)}?level=${level.slug}`

  return (
    <Link
      to={signedIn ? target : '/login'}
      state={signedIn ? undefined : { from: target }}
      className="group block w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
    >
      <Card
        interactive
        className="h-full min-h-[132px] p-5 transition-colors group-hover:border-hairline-strong"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <ModuleSwatch kind={kind} />
            <h3 className="text-[21px] font-medium leading-tight">{t(`modules.${kind}`)}</h3>
          </div>
          <p className="mt-2 text-[15px] text-body">
            {chainComplete(sets, kind, progress)
              ? t('levels.allPassed')
              : entry
                ? t('levels.continueAt', {
                    level: pickText(level.title, i18n.language),
                    percent: Math.round(entry.bestAccuracy * 100),
                  })
                : t('levels.startAtName', { level: pickText(level.title, i18n.language) })}
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

  const { data: catalog } = useLevelCatalog()

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
        {/* Hero: one screen, two columns, everything flush left. The pitch on the left,
            the single action on the right. The play control that used to sit here was
            decoration — a note you could already hear one click away. */}
        <section className="flex min-h-[calc(100svh-65px)] scroll-mt-[65px] snap-start items-center px-6 py-16">
          <div className="mx-auto grid w-full max-w-[1200px] gap-12 sm:grid-cols-[1.5fr_1fr] sm:items-end">
            <div>
              <h1 className="max-w-[24ch] text-[40px] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[60px]">
                {t('tagline')}
              </h1>
              <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.7] text-body">
                <span className="block">{t('home.heroLine1')}</span>
                <span className="block">{t('home.heroLine2')}</span>
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 sm:items-end sm:pb-1.5">
              {/* A plain anchor, not a router link and not a scroll library: the browser
                  already knows how to travel to an id, and CSS gives it the pull. */}
              <a href="#practice" className={buttonVariants({ size: 'hero' })}>
                {t('home.startCta')}
              </a>
              {!user && (
                <p className="max-w-[38ch] text-[14px] text-muted sm:text-right">
                  {t('home.guestNote')}
                </p>
              )}
            </div>
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
        <section id="practice" className="snap-start px-6 pb-24 sm:pb-32">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[26px] font-medium sm:text-[32px]">{t('home.practiceHeading')}</h2>
            <p className="mt-3 max-w-[60ch] text-[14px] text-muted">{t('home.practiceHint')}</p>

            {/* A rack of panels: square, tightly packed, one per module, with the
                module's track colour along the top edge. Six cells — five modules
                plus mistake review — so the rectangle closes on both the two-column
                and three-column layouts instead of leaving a gap. */}
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {modules.map(({ key, route }) => (
                <Link key={key} to={route} className="group block">
                  <Card
                    interactive
                    className="h-full min-h-[96px] gap-0 overflow-hidden p-0 transition-colors group-hover:border-hairline-strong"
                  >
                    <span
                      aria-hidden="true"
                      className={cn('block h-[3px] w-full', MODULE_SWATCH[key])}
                    />
                    <span className="block px-4 py-4">
                      <span className="font-display block text-[19px] font-medium leading-tight">
                        {t(`modules.${key}`)}
                      </span>
                      <span className="mt-1.5 block text-[13px] leading-snug text-body">
                        {t(`moduleHints.${key}`)}
                      </span>
                    </span>
                  </Card>
                </Link>
              ))}

              <Link to="/mistakes" className="group block">
                <Card
                  interactive
                  className="h-full min-h-[96px] gap-0 overflow-hidden p-0 transition-colors group-hover:border-hairline-strong"
                >
                  <span aria-hidden="true" className="block h-[3px] w-full bg-hairline-strong" />
                  <span className="block px-4 py-4">
                    <span className="font-display block text-[19px] font-medium leading-tight">
                      {t('home.mistakesTile')}
                    </span>
                    <span className="mt-1.5 block text-[13px] leading-snug text-body">
                      {t('home.mistakesHint')}
                    </span>
                  </span>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        {/* Daily practice: the plan's goal and today's progress, with the session
            one click away. */}
        <section className="px-6 pb-16">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[26px] font-medium sm:text-[32px]">{t('daily.title')}</h2>
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
            <h2 className="text-[26px] font-medium sm:text-[32px]">{t('levels.modeTitle')}</h2>
            <p className="mt-3 max-w-[60ch] text-[14px] text-muted">
              {user ? t('levels.modeHint') : t('levels.entryHintGuest')}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-5">
              {MODULES.map((kind) => (
                <LevelCard
                  key={kind}
                  sets={catalog ?? []}
                  kind={kind}
                  progress={progressById}
                  signedIn={!!user}
                />
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
              <Card className="p-7 sm:p-9">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <h2 className="font-display text-[24px] font-medium leading-tight">
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
