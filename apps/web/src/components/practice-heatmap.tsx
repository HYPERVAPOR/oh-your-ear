import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { emptyRange, slice, type DailyBucket, type Granularity, type Period } from '@/lib/heatmap'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

const GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'year']

/** Four steps of one colour: nothing, then a third, two thirds, the fullest. */
const TIER_CLASS = ['bg-surface-strong', 'bg-success/35', 'bg-success/60', 'bg-success']

/** The day view keeps its own legend, because there the colour means "goal met". */
const DAY_LEGEND = ['none', 'partial', 'met'] as const

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const today = () => new Date().toISOString().slice(0, 10)

function format(period: Period, granularity: Granularity, language: string): string {
  const first = new Date(`${period.first}T00:00:00Z`)
  if (granularity === 'year') return period.first.slice(0, 4)
  if (granularity === 'month') {
    return new Intl.DateTimeFormat(language, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(first)
  }
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(first)
}

/**
 * The practice history, sliced four ways (PRD 7.1.4). One series of daily buckets is the
 * only source; the tabs change the size of a square, not the numbers. A day is the only
 * period with a goal to be judged against, so it is the only view whose legend says so.
 */
export function PracticeHeatmap() {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const [granularity, setGranularity] = useState<Granularity>('day')

  const { data } = useQuery({
    queryKey: ['daily-history'],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: history } = await apiClient.GET('/me/daily', {
        params: { query: { days: 371 } },
      })
      return history
    },
  })

  // Signed out, the grid is shown empty rather than absent: the reader can see what they
  // are being offered, and nothing jumps when they sign in.
  const days: DailyBucket[] = data?.days ?? emptyRange(today())
  const periods = slice(days, granularity)
  const day = granularity === 'day'

  // The calendar: a column per week, Mondays first. Leading blanks keep the rows aligned.
  const leading = day ? (new Date(`${periods[0]?.key}T00:00:00Z`).getUTCDay() + 6) % 7 : 0
  const columns = day ? Math.ceil((periods.length + leading) / 7) : 1
  const monthOf = new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'UTC' })
  const monthAt = new Map<number, string>()
  const labelled = new Set<string>()
  if (day) {
    periods.forEach((period, index) => {
      const month = period.key.slice(0, 7)
      if (new Date(`${period.key}T00:00:00Z`).getUTCDate() <= 7 && !labelled.has(month)) {
        labelled.add(month)
        monthAt.set(
          Math.floor((index + leading) / 7),
          monthOf.format(new Date(`${period.key}T00:00:00Z`)),
        )
      }
    })
  }

  const cellTitle = (period: Period) =>
    day
      ? t('heatmap.cellDay', { date: period.key, solved: period.solved, goal: period.goal })
      : t('heatmap.cellPeriod', {
          label: format(period, granularity, i18n.language),
          solved: period.solved,
          days: period.days,
        })

  const square = (period: Period) => (
    <span
      key={period.key}
      title={cellTitle(period)}
      data-tier={period.tier}
      className={cn(
        'h-2.5 w-2.5 shrink-0',
        TIER_CLASS[period.tier],
        period.last === days[days.length - 1]?.date && 'ring-1 ring-ink',
      )}
    />
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <p className="badge-label text-muted">{t('heatmap.title')}</p>
          {user && data && (
            <p className="tabular mt-1.5 text-[15px]">
              {t('heatmap.streaks', {
                current: data.currentStreak,
                longest: data.longestStreak,
              })}
            </p>
          )}
        </div>

        {/* One welded piece, like every other group of switches: one outline, a rule
            between neighbours. */}
        <div
          role="group"
          aria-label={t('heatmap.title')}
          className="flex items-stretch divide-x divide-hairline-strong border border-hairline-strong"
        >
          {GRANULARITIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={granularity === value}
              onClick={() => setGranularity(value)}
              className={cn(
                'h-8 px-2.5 text-[13px] transition-colors',
                granularity === value ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {t(`heatmap.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        {day ? (
          <div className="inline-flex flex-col gap-1">
            <div
              className="grid gap-[2px] pl-[19px]"
              style={{ gridTemplateColumns: `repeat(${columns}, 10px)` }}
            >
              {Array.from({ length: columns }, (_, column) => (
                <span
                  key={column}
                  className="whitespace-nowrap text-[10px] leading-[10px] text-muted"
                >
                  {monthAt.get(column) ?? ''}
                </span>
              ))}
            </div>

            <div className="flex gap-[6px]">
              <div
                className="grid gap-[2px] text-[10px] leading-[10px] text-muted"
                style={{ gridTemplateRows: 'repeat(7, 10px)' }}
              >
                {WEEKDAYS.map((label) => (
                  <span key={label} className="w-3">
                    {label}
                  </span>
                ))}
              </div>

              <div
                className="grid grid-flow-col grid-rows-7 gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${columns}, 10px)` }}
              >
                {Array.from({ length: leading }, (_, index) => (
                  <span key={`pad-${index}`} className="h-2.5 w-2.5" />
                ))}
                {periods.map(square)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[2px]">{periods.map(square)}</div>
        )}
      </div>

      <ul className="mt-4 flex items-center gap-4 text-[13px] text-muted">
        {day
          ? DAY_LEGEND.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-2.5 w-2.5',
                    key === 'met'
                      ? TIER_CLASS[3]
                      : key === 'partial'
                        ? TIER_CLASS[1]
                        : TIER_CLASS[0],
                  )}
                />
                {t(`heatmap.tier.${key}`)}
              </li>
            ))
          : ([3, 2, 1, 0] as const).map((tier) => (
              <li key={tier} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5', TIER_CLASS[tier])} />
                {t(`heatmap.relative.${tier}`)}
              </li>
            ))}
      </ul>
    </div>
  )
}
