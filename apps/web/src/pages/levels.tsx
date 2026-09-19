import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, Lock } from 'lucide-react'

import { apiClient } from '@/api/client'
import { AppHeader } from '@/components/app-header'
import { EmptyState } from '@/components/ui/card'
import { Orb } from '@/components/ui/orb'
import { ModuleSwatch, type ExerciseKind } from '@/components/ui/orb'
import { useAuthStore } from '@/stores/auth-store'
import { levelsFor } from '@/lib/levels'
import { modulePath } from '@/components/round-summary'

const MODULES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

/**
 * Question sets: five chains, easy to hard, for signed-in users. A level is locked
 * until the one before it is passed, so the page is really a picture of progress.
 */
export function Levels() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  // Guests see the whole ladder — that is the invitation. Only their progress is
  // unknown, and the endpoint answers 401, so it is not asked for.
  const { data } = useQuery({
    queryKey: ['level-progress'],
    enabled: !!user,
    queryFn: async () => {
      const { data: progress } = await apiClient.GET('/me/levels')
      return progress
    },
  })

  const progressById = new Map((data ?? []).map((entry) => [entry.levelId, entry]))

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="text-[30px] font-light leading-tight sm:text-[36px]">{t('levels.title')}</h1>
        <p className="mt-3 max-w-[52ch] text-[15px] text-body">{t('levels.intro')}</p>

        {!user && (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-surface px-5 py-4">
            <p className="text-[15px] text-body">{t('levels.guestBanner')}</p>
            <Link
              to="/login"
              state={{ from: '/levels' }}
              className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[15px] font-medium text-on-primary transition-opacity hover:opacity-90"
            >
              {t('actions.login')}
            </Link>
          </div>
        )}

        <div className="mt-10 space-y-10">
          {MODULES.map((kind) => {
            const chain = levelsFor(kind)
            // A level is open when it is the first, or the one before it is passed.
            const openIndex = chain.findIndex((level) => !progressById.get(level.id)?.passed)

            return (
              <section key={kind}>
                <div className="flex items-center gap-3">
                  <ModuleSwatch kind={kind} />
                  <h2 className="text-[20px] font-medium">{t(`modules.${kind}`)}</h2>
                </div>

                <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {chain.map((level, index) => {
                    const progress = progressById.get(level.id)
                    // A lock means "pass the level before it"; a guest is stopped by
                    // the sign-in step instead, so nothing is shown locked to them.
                    const locked = Boolean(user) && openIndex !== -1 && index > openIndex

                    return (
                      <li key={level.id}>
                        {locked ? (
                          <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline px-4 py-3.5 text-muted-soft">
                            <span className="flex items-center gap-3 text-[15px]">
                              <Lock className="h-4 w-4" />
                              {t('levels.level', { number: index + 1 })}
                            </span>
                            <span className="text-[13px]">
                              {t('levels.questions', { count: level.questions })}
                            </span>
                          </div>
                        ) : (
                          <Link
                            to={user ? `/exercise/${modulePath(kind)}?level=${level.id}` : '/login'}
                            state={
                              user
                                ? undefined
                                : { from: `/exercise/${modulePath(kind)}?level=${level.id}` }
                            }
                            className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-surface px-4 py-3.5 transition-colors hover:border-hairline-strong hover:bg-canvas-soft"
                          >
                            <span className="flex items-center gap-3 text-[15px] font-medium">
                              {progress?.passed ? (
                                <Check className="h-4 w-4 text-success-text" />
                              ) : (
                                <span className="h-4 w-4 rounded-full border border-hairline-strong" />
                              )}
                              {t('levels.level', { number: index + 1 })}
                            </span>
                            <span className="tabular text-[13px] text-muted">
                              {!user
                                ? t('levels.questions', { count: level.questions })
                                : progress
                                  ? t('levels.best', {
                                      percent: Math.round(progress.bestAccuracy * 100),
                                    })
                                  : t('levels.questions', { count: level.questions })}
                            </span>
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>

        {data && data.length === 0 && <EmptyState className="mt-8">{t('levels.empty')}</EmptyState>}
      </main>

      <Orb kind="ambient" size="lg" className="-bottom-40 right-0" />
    </div>
  )
}
