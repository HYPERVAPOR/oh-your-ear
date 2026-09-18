import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/auth-store'

/** Today's progress against the daily goal, for signed-in users on the home page. */
export function TodayProgress() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  const { data } = useQuery({
    queryKey: ['study-plan'],
    enabled: !!user,
    // Always re-read on mount: this is the page you land on after practising.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: plan } = await apiClient.GET('/me/plan')
      return plan
    },
  })

  if (!user || !data) return null

  const { solved, correct } = data.today
  const goal = data.dailyGoal
  const percent = Math.min(100, Math.round((solved / goal) * 100))
  const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 0

  return (
    <Link
      to="/me"
      className="mb-8 w-full max-w-md rounded-md border border-border px-4 py-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{t('plan.today')}</span>
        <span className="text-muted-foreground">
          {t('plan.solvedOfGoal', { solved, goal })}
          {solved > 0 && ` · ${t('plan.accuracy', { percent: accuracy })}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </Link>
  )
}
