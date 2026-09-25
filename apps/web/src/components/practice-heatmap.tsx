import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { emptyRange, type DailyBucket, type Level, type Square } from '@/lib/heatmap'
import { CELL, DayView, MonthGrid, TIER_CLASS, WeekRow, YearGrid } from '@/components/heatmap-views'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

const LEVELS: Level[] = ['day', 'week', 'month', 'year']

const BODY = 'flex h-[118px] items-center overflow-x-auto'
const CALENDAR_LEGEND = ['none', 'partial', 'met'] as const
/** The day view's squares are questions, not days, so they say something else. */
const SLOT_LEGEND = ['todo', 'done'] as const

/**
 * The practice history as one calendar at four magnifications (PRD 7.1.4): today's goal as
 * a strip of squares — the day's progress, drawn once and only here — this week, this
 * month, and the year. A square is a day everywhere except on the day view, where it is
 * one of the questions the goal asks for, and it is always coloured against that day's own
 * goal.
 */
export function PracticeHeatmap() {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const [level, setLevel] = useState<Level>('day')

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

  // Signed out, the calendar is shown empty rather than absent: the reader can see what
  // they are being offered, and nothing jumps when they sign in.
  const days: DailyBucket[] = data?.days ?? emptyRange(new Date().toISOString().slice(0, 10))
  // The server decides which day "today" is; its last bucket is that day.
  const today = days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10)
  const todayBucket = days.find((day) => day.date === today) ?? days[days.length - 1]

  const square = (item: Square, cell: string) =>
    item.date === null ? (
      <span key={item.key} className={cell} />
    ) : (
      <span
        key={item.key}
        title={t('heatmap.cell', {
          date: item.date,
          solved: item.day?.solved ?? 0,
          goal: item.day?.goal ?? 0,
        })}
        data-tier={item.tier}
        className={cn(
          cell,
          TIER_CLASS[item.tier === 3 ? 2 : item.tier],
          item.date === today && 'ring-1 ring-ink',
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
          {LEVELS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={level === value}
              onClick={() => setLevel(value)}
              className={cn(
                'h-8 px-2.5 text-[13px] transition-colors',
                level === value ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {t(`heatmap.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('mt-4', BODY)}>
        {level === 'day' && <DayView day={todayBucket} />}
        {level === 'week' && <WeekRow days={days} today={today} square={square} />}
        {level === 'month' && <MonthGrid days={days} today={today} square={square} />}
        {level === 'year' && <YearGrid days={days} square={square} language={i18n.language} />}
      </div>

      <ul className="mt-4 flex items-center gap-4 text-[13px] text-muted">
        {level === 'day'
          ? SLOT_LEGEND.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span className={cn(CELL, key === 'done' ? TIER_CLASS[2] : TIER_CLASS[0])} />
                {t(`heatmap.slot.${key}`)}
              </li>
            ))
          : CALENDAR_LEGEND.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    CELL,
                    key === 'met'
                      ? TIER_CLASS[2]
                      : key === 'partial'
                        ? TIER_CLASS[1]
                        : TIER_CLASS[0],
                  )}
                />
                {t(`heatmap.tier.${key}`)}
              </li>
            ))}
      </ul>
    </div>
  )
}
