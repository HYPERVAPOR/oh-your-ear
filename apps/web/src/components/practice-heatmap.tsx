import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import {
  DEFAULT_GOAL,
  emptyRange,
  goalSlots,
  month,
  week,
  weekdayIndex,
  year,
  type DailyBucket,
  type Level,
  type Square,
} from '@/lib/heatmap'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

const LEVELS: Level[] = ['day', 'week', 'month', 'year']

/** Three steps of one colour: nothing, partly done, the day's goal met. */
const TIER_CLASS = ['bg-surface-strong', 'bg-success/35', 'bg-success']

const LEGEND = ['none', 'partial', 'met'] as const
const LEGEND_CLASS = { none: TIER_CLASS[0], partial: TIER_CLASS[1], met: TIER_CLASS[2] }

/** English, and fixed: the axis is a scale, not a sentence. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const squareClass = 'h-2.5 w-2.5 shrink-0'

/**
 * The practice history as one calendar at four magnifications (PRD 7.1.4): today's goal
 * as a strip of squares, this week, this month, and the year. A square is a day — or, on
 * the day view, one of the questions the day's goal asks for — and it is always coloured
 * against that day's own goal.
 */
export function PracticeHeatmap() {
  const { t } = useTranslation('common')
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

  const cellTitle = (square: Square) =>
    t('heatmap.cell', {
      date: square.date,
      solved: square.day?.solved ?? 0,
      goal: square.day?.goal ?? 0,
    })

  const square = (item: Square) =>
    item.date === null ? (
      <span key="blank" className={squareClass} />
    ) : (
      <span
        key={item.date}
        title={cellTitle(item)}
        data-tier={item.tier}
        className={cn(
          squareClass,
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

      <div className="mt-4 overflow-x-auto pb-1">
        {level === 'day' && <DayStrip goal={todayBucket} />}
        {level === 'week' && <WeekRow days={days} today={today} square={square} />}
        {level === 'month' && <MonthGrid days={days} today={today} square={square} />}
        {level === 'year' && <YearGrid days={days} square={square} />}
      </div>

      <ul className="mt-4 flex items-center gap-4 text-[13px] text-muted">
        {LEGEND.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className={cn(squareClass, LEGEND_CLASS[key])} />
            {t(`heatmap.tier.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Today: one square per question the goal asks for, filled as they are answered. */
function DayStrip({ goal }: { goal: DailyBucket | undefined }) {
  const slots = goalSlots(goal, DEFAULT_GOAL)

  return (
    <div aria-hidden="true" className="flex flex-wrap gap-[2px]">
      {slots.map((slot) => (
        <span
          key={slot.key}
          data-filled={slot.filled}
          className={cn(squareClass, slot.filled ? 'bg-success' : 'bg-surface-strong')}
        />
      ))}
    </div>
  )
}

/** This week: seven days under their weekday names. */
function WeekRow({
  days,
  today,
  square,
}: {
  days: DailyBucket[]
  today: string
  square: (item: Square) => ReactNode
}) {
  const squares = week(days, today)

  return (
    <div className="inline-grid grid-cols-[repeat(7,16px)] justify-items-center gap-[2px]">
      {WEEKDAYS.map((label) => (
        <span key={label} className="text-[10px] leading-[10px] text-muted">
          {label}
        </span>
      ))}
      {squares.map(square)}
    </div>
  )
}

/** This month, as a calendar: the weekday header, blanks, then its days. */
function MonthGrid({
  days,
  today,
  square,
}: {
  days: DailyBucket[]
  today: string
  square: (item: Square) => ReactNode
}) {
  const squares = month(days, today)

  return (
    <div className="inline-grid grid-cols-[repeat(7,16px)] justify-items-center gap-[2px]">
      {WEEKDAYS.map((label) => (
        <span key={label} className="text-[10px] leading-[10px] text-muted">
          {label}
        </span>
      ))}
      {squares.map(square)}
    </div>
  )
}

/** The year: a column per week, Monday first, with the weekday names down the side. */
function YearGrid({ days, square }: { days: DailyBucket[]; square: (item: Square) => ReactNode }) {
  const squares = year(days)
  const leading = squares.length > 0 ? weekdayIndex(squares[0].date as string) : 0
  const columns = Math.ceil((squares.length + leading) / 7)

  return (
    <div className="inline-flex gap-[6px]">
      <div className="grid grid-rows-[repeat(7,10px)] gap-[2px] text-[10px] leading-[10px] text-muted">
        {WEEKDAYS.map((label) => (
          <span key={label} className="w-[26px]">
            {label}
          </span>
        ))}
      </div>
      <div
        className="grid grid-flow-col grid-rows-7 gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${columns}, 10px)` }}
      >
        {Array.from({ length: leading }, (_, index) => (
          <span key={`pad-${index}`} className={squareClass} />
        ))}
        {squares.map(square)}
      </div>
    </div>
  )
}
