import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { PracticeHeatmap } from '@/components/practice-heatmap'
import { modulePath } from '@/components/round-summary'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MODULES, type ExerciseKind } from '@/components/ui/orb'
import { loginHere } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

/** The plan's own default, and what a signed-out reader is shown against. */
const DEFAULT_GOAL = 20
/** One session is a round; the plan can ask for more, but not in a single sitting. */
const MAX_SESSION = 20

/**
 * The first band of the dashboard: who you are and what to do about today on the left,
 * how today and the year are going on the right (PRD 7.1.4). Guests get the same shape
 * with the numbers at zero, so nothing moves after signing in.
 */
export function TodayPanel() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: plan } = useQuery({
    queryKey: ['study-plan'],
    enabled: !!user,
    // Always re-read on mount: this is the page you land on after practising.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/plan')
      return data
    },
  })

  const goal = plan?.dailyGoal ?? DEFAULT_GOAL
  const solved = plan?.today.solved ?? 0
  const remaining = Math.max(goal - solved, 0)
  const percent = goal > 0 ? Math.min(100, Math.round((solved / goal) * 100)) : 0
  const met = goal > 0 && solved >= goal

  // The focus modules, or all of them when the plan does not narrow it down.
  const focus: ExerciseKind[] = (plan?.focusExercises as ExerciseKind[] | undefined)?.length
    ? (plan?.focusExercises as ExerciseKind[])
    : MODULES
  const byExercise = plan?.today.byExercise ?? {}
  // The module with the least done today, so a session evens the day out.
  const next = [...focus].sort((a, b) => (byExercise[a] ?? 0) - (byExercise[b] ?? 0))[0]

  function startSession() {
    if (!next) return
    const size = Math.min(remaining > 0 ? remaining : MAX_SESSION, MAX_SESSION)
    navigate(`/exercise/${modulePath(next)}?round=${size}`)
  }

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {/* min-w-0 on both: a grid item defaults to min-width auto, so the heatmap's
          intrinsic width would stretch the whole column past a phone screen. */}
      <Card className="flex min-w-0 flex-col justify-between p-6 sm:p-7">
        {user ? (
          <>
            <div>
              <p className="badge-label text-muted">{t('home.accountLabel')}</p>
              <p className="mt-1.5 break-all text-[15px]">{user.email}</p>
            </div>
            <div className="mt-8">
              <Button size="lg" onClick={startSession}>
                {met ? t('home.extraRound') : t('home.startDaily')}
              </Button>
              <p className="mt-3 text-[14px] text-muted">
                {met || !next
                  ? t('home.goalMet')
                  : t('home.startHint', {
                      count: Math.min(remaining, MAX_SESSION),
                      module: t(`modules.${next}`),
                    })}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="badge-label text-muted">{t('home.accountLabel')}</p>
              <p className="mt-1.5 text-[15px] text-body">{t('home.guestIdentity')}</p>
            </div>
            <div className="mt-8">
              <Link to={loginHere()} className={buttonVariants({ size: 'lg' })}>
                {t('actions.login')}
              </Link>
              <p className="mt-3 max-w-[42ch] text-[14px] text-muted">{t('home.loginCtaHint')}</p>
            </div>
          </>
        )}
      </Card>

      <Card className="min-w-0 p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div>
            <p className="badge-label text-muted">{t('plan.today')}</p>
            <p className="tabular mt-1.5 text-[32px] font-medium leading-none">
              {t('plan.solvedOfGoal', { solved, goal })}
            </p>
          </div>
          {user ? (
            <Link
              to="/me"
              className="text-[13px] text-muted underline underline-offset-4 hover:text-ink"
            >
              {t('home.adjustPlan')}
            </Link>
          ) : null}
        </div>

        <div className="mt-4 h-1 w-full overflow-hidden bg-surface-strong">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        {met && <p className="mt-2 text-[13px] font-medium text-success-text">{t('home.met')}</p>}

        <div className="mt-8 border-t border-hairline pt-6">
          <PracticeHeatmap />
        </div>
      </Card>
    </div>
  )
}
