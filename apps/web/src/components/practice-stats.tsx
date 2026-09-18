import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { apiClient } from '@/api/client'
import { Card } from '@/components/ui/card'
import { ModuleSwatch } from '@/components/ui/orb'
import type { ExerciseKind } from '@/components/ui/orb'

const MODULES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="badge-label text-muted">{label}</p>
      <p className="tabular mt-1.5 font-display text-[32px] font-light leading-none">{value}</p>
    </div>
  )
}

/** Totals, per-module accuracy, achievements, and a daily trend. */
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
      <Card className="p-6 sm:p-7">
        <h2 className="font-display text-[22px] font-light leading-tight">{t('stats.title')}</h2>
        <p className="mt-3 text-[15px] text-muted">{t('stats.empty')}</p>
      </Card>
    )
  }

  const accuracy = Math.round(data.accuracy * 100)
  const activeDays = data.daily.filter((day) => day.solved > 0).length
  const peak = Math.max(...data.daily.map((day) => day.solved), 1)
  const practised = MODULES.filter((kind) => data.byExercise[kind])

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-[22px] font-light leading-tight">{t('stats.title')}</h2>

      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label={t('stats.solved')} value={data.solved} />
        <Stat label={t('stats.accuracy')} value={`${accuracy}%`} />
        <Stat label={t('stats.activeDays')} value={activeDays} />
        <Stat label={t('stats.streak')} value={data.streak} />
      </div>

      <h3 className="badge-label mt-8 text-muted">{t('stats.trend')}</h3>
      <div
        className="mt-3 flex h-20 max-w-md items-end gap-1.5"
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
            className="flex h-full flex-1 flex-col justify-end overflow-hidden rounded-sm bg-surface-strong"
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
      <div className="mt-2 flex max-w-md justify-between text-[13px] text-muted">
        <span className="tabular">{data.daily[0]?.date}</span>
        <span className="tabular">{data.daily[data.daily.length - 1]?.date}</span>
      </div>

      <h3 className="badge-label mt-8 text-muted">{t('stats.byExercise')}</h3>
      <ul className="mt-3 space-y-3">
        {practised.map((kind) => {
          const entry = data.byExercise[kind]
          if (!entry) return null
          const share = Math.round((entry.solved / data.solved) * 100)

          return (
            <li key={kind} className="flex items-center gap-3 text-[15px]">
              <ModuleSwatch kind={kind} />
              <span className="w-20 shrink-0 whitespace-nowrap">{t(`modules.${kind}`)}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${share}%` }}
                />
              </span>
              <span className="tabular shrink-0 text-[13px] text-muted">
                {t('stats.moduleDetail', {
                  solved: entry.solved,
                  percent: Math.round(entry.accuracy * 100),
                })}
              </span>
            </li>
          )
        })}
      </ul>

      <h3 className="badge-label mt-8 text-muted">{t('stats.achievements')}</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {data.achievements.map((badge) => (
          <li
            key={badge.id}
            title={t(`achievements.${badge.id}.description`)}
            className={
              badge.achieved
                ? 'inline-flex items-center gap-2 rounded-full bg-success/15 px-3.5 py-1.5 text-[14px] font-medium text-success-text'
                : 'inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-[14px] text-muted'
            }
          >
            {badge.achieved && <Check className="h-3.5 w-3.5" />}
            {t(`achievements.${badge.id}.title`)}
            {!badge.achieved && (
              <span className="tabular text-[13px]">
                {badge.progress}/{badge.target}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
