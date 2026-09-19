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
      className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-xl border border-hairline bg-surface px-6 py-5 transition-colors hover:border-hairline-strong"
    >
      <div>
        <p className="badge-label text-muted">{t('plan.today')}</p>
        <p className="mt-1.5 tabular text-[22px] font-medium">
          {t('plan.solvedOfGoal', { solved, goal })}
        </p>
      </div>

      <div className="min-w-[180px] flex-1">
        <div className="h-1 w-full overflow-hidden rounded-none bg-surface-strong">
          <div className="h-full rounded-none bg-primary" style={{ width: `${percent}%` }} />
        </div>
        {solved > 0 && (
          <p className="mt-2 text-[13px] text-muted">{t('plan.accuracy', { percent: accuracy })}</p>
        )}
      </div>
    </Link>
  )
}
