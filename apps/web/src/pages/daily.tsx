import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AppHeader } from '@/components/app-header'
import { DailyHeatmap } from '@/components/daily-heatmap'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ModuleSwatch, type ExerciseKind } from '@/components/ui/orb'
import { useAuthStore } from '@/stores/auth-store'

const MODULES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

/** Route segment for a module, matching the practice routes. */
function path(kind: ExerciseKind): string {
  return kind === 'singleNote' ? 'single-note' : kind
}

/** Daily practice: today's goal, and a session that goes after it. */
export function Daily() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: plan } = useQuery({
    queryKey: ['study-plan'],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/plan')
      return data
    },
  })

  const goal = plan?.dailyGoal ?? 0
  const solved = plan?.today.solved ?? 0
  const remaining = Math.max(goal - solved, 0)
  const percent = goal > 0 ? Math.min(100, Math.round((solved / goal) * 100)) : 0
  const met = goal > 0 && remaining === 0

  // Focus modules, or all of them when the plan does not narrow it down.
  const focus: ExerciseKind[] = (plan?.focusExercises as ExerciseKind[] | undefined)?.length
    ? (plan?.focusExercises as ExerciseKind[])
    : MODULES

  // The module with the least done today, so a session evens the day out.
  const byExercise = plan?.today.byExercise ?? {}
  const next = [...focus].sort((a, b) => (byExercise[a] ?? 0) - (byExercise[b] ?? 0))[0]

  function startSession() {
    if (!next) return
    const size = Math.min(remaining > 0 ? remaining : 10, 20)
    navigate(`/exercise/${path(next)}?round=${size}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="text-[30px] font-light leading-tight sm:text-[36px]">{t('daily.title')}</h1>
        <p className="mt-3 max-w-[54ch] text-[15px] text-body">{t('daily.intro')}</p>

        {!user && (
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-surface px-5 py-4">
            <p className="text-[15px] text-body">{t('daily.guestBanner')}</p>
            <Link
              to="/login"
              state={{ from: '/daily' }}
              className="inline-flex h-10 items-center rounded-none bg-primary px-5 text-[15px] font-medium text-on-primary transition-opacity hover:opacity-90"
            >
              {t('actions.login')}
            </Link>
          </div>
        )}

        {user && plan && (
          <Card className="mt-8 p-6 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="badge-label text-muted">{t('daily.today')}</p>
                <p className="tabular mt-1.5 text-[32px] font-light leading-none">
                  {t('daily.progress', { solved, goal })}
                </p>
              </div>
              {met && <p className="text-[15px] font-medium text-success-text">{t('daily.met')}</p>}
            </div>

            <div className="mt-4 h-1 w-full overflow-hidden rounded-none bg-surface-strong">
              <div className="h-full rounded-none bg-primary" style={{ width: `${percent}%` }} />
            </div>

            <p className="badge-label mt-7 text-muted">{t('daily.focus')}</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {focus.map((kind) => (
                <li key={kind} className="flex items-center gap-2 text-[15px]">
                  <ModuleSwatch kind={kind} />
                  {t(`modules.${kind}`)}
                  <span className="tabular text-[13px] text-muted">{byExercise[kind] ?? 0}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={startSession}>
                {met ? t('daily.extraRound') : t('daily.start', { count: Math.min(remaining, 20) })}
              </Button>
              <Link
                to="/me"
                className="text-[15px] text-muted underline underline-offset-4 hover:text-ink"
              >
                {t('daily.settingsLink')}
              </Link>
            </div>

            {!met && (
              <p className="mt-4 text-[14px] text-muted">
                {t('daily.nextModule', { module: t(`modules.${next}`) })}
              </p>
            )}
          </Card>
        )}

        {user && (
          <div className="mt-6">
            <DailyHeatmap />
          </div>
        )}
      </main>
    </div>
  )
}
