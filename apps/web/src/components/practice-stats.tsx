import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'

const MODULES = ['singleNote', 'interval', 'chord', 'melody', 'rhythm'] as const

/** Totals, per-module accuracy, and a daily trend for the signed-in user. */
export function PracticeStats() {
  const { t } = useTranslation('common')

  const { data } = useQuery({
    queryKey: ['practice-stats'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: stats } = await apiClient.GET('/me/stats')
      return stats
    },
  })

  if (!data) return null

  if (data.solved === 0) {
    return (
      <section className="rounded-md border border-border p-6">
        <h2 className="font-medium">{t('stats.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('stats.empty')}</p>
      </section>
    )
  }

  const accuracy = Math.round(data.accuracy * 100)
  const activeDays = data.daily.filter((day) => day.solved > 0).length
  const peak = Math.max(...data.daily.map((day) => day.solved), 1)

  return (
    <section className="rounded-md border border-border p-6">
      <h2 className="font-medium">{t('stats.title')}</h2>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.solved')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{data.solved}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.accuracy')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{accuracy}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.activeDays')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{activeDays}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.streak')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{data.streak}</dd>
        </div>
      </dl>

      <h3 className="mt-6 text-sm font-medium">{t('stats.trend')}</h3>
      <div
        className="mt-2 flex h-20 max-w-md items-end gap-1.5"
        role="img"
        aria-label={t('stats.trendLabel', {
          from: data.daily[0]?.date ?? '',
          to: data.daily[data.daily.length - 1]?.date ?? '',
          solved: data.daily.reduce((sum, day) => sum + day.solved, 0),
        })}
      >
        {data.daily.map((day) => (
          <div
            key={day.date}
            title={t('stats.dayTitle', { date: day.date, solved: day.solved })}
            className="flex h-full flex-1 flex-col justify-end overflow-hidden rounded-sm bg-muted"
          >
            <div
              className={day.solved > 0 ? 'rounded-sm bg-primary' : ''}
              style={{
                height: day.solved > 0 ? `${Math.max(10, (day.solved / peak) * 100)}%` : '0',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{data.daily[0]?.date}</span>
        <span>{data.daily[data.daily.length - 1]?.date}</span>
      </div>

      <h3 className="mt-6 text-sm font-medium">{t('stats.byExercise')}</h3>
      <ul className="mt-2 space-y-2">
        {MODULES.filter((kind) => data.byExercise[kind]).map((kind) => {
          const entry = data.byExercise[kind]
          if (!entry) return null
          const share = Math.round((entry.solved / data.solved) * 100)
          return (
            <li key={kind} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
              <span>{t(`modules.${kind}`)}</span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${share}%` }}
                />
              </span>
              <span className="tabular-nums text-muted-foreground">
                {t('stats.moduleDetail', {
                  solved: entry.solved,
                  percent: Math.round(entry.accuracy * 100),
                })}
              </span>
            </li>
          )
        })}
      </ul>

      <h3 className="mt-6 text-sm font-medium">{t('stats.achievements')}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {data.achievements.map((badge) => (
          <li
            key={badge.id}
            title={t(`achievements.${badge.id}.description`)}
            className={`rounded-md border px-3 py-2 text-sm ${
              badge.achieved
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-border text-muted-foreground'
            }`}
          >
            {t(`achievements.${badge.id}.title`)}
            <span className="ml-2 tabular-nums text-xs">
              {badge.achieved ? '✓' : `${badge.progress}/${badge.target}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
