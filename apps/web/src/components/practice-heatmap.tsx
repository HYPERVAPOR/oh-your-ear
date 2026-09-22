import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import {
  DEFAULT_GOAL,
  emptyRange,
  goalSlots,
  leadingBlanks,
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

/**
 * Every square is the same 10px cell, whichever way it is arranged, and every view sits in
 * the same box: switching tabs must not move the card. The year is the tallest, so its
 * height is the box's height.
 */
const SQUARE = 'h-2.5 w-2.5 shrink-0'
const BODY = 'flex h-[118px] items-center overflow-x-auto'
const AXIS = 'text-[10px] leading-[10px] text-muted'

/** English, and fixed: the axis is a scale, not a sentence. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Three steps of one colour for the calendars: nothing, partly done, the goal met. */
const TIER_CLASS = ['bg-surface-strong', 'bg-success/35', 'bg-success']
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

  const square = (item: Square) =>
    item.date === null ? (
      <span key={item.key} className={SQUARE} />
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
          SQUARE,
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
                <span className={cn(SQUARE, key === 'done' ? TIER_CLASS[2] : TIER_CLASS[0])} />
                {t(`heatmap.slot.${key}`)}
              </li>
            ))
          : CALENDAR_LEGEND.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    SQUARE,
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

/** Today: the count, and one square per question the goal asks for. */
function DayView({ day }: { day: DailyBucket | undefined }) {
  const { t } = useTranslation('common')
  const slots = goalSlots(day, DEFAULT_GOAL)
  const solved = day?.solved ?? 0
  const goal = day && day.goal > 0 ? day.goal : DEFAULT_GOAL

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tabular text-[26px] font-medium leading-none">
          {t('plan.solvedOfGoal', { solved, goal })}
        </p>
        {day?.met && <p className="text-[13px] font-medium text-success-text">{t('home.met')}</p>}
      </div>
      <div aria-hidden="true" className="mt-3 flex flex-wrap gap-[2px]">
        {slots.map((slot) => (
          <span
            key={slot.key}
            className={cn(SQUARE, slot.filled ? TIER_CLASS[2] : TIER_CLASS[0])}
          />
        ))}
      </div>
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
  return (
    <div className="inline-grid grid-cols-[repeat(7,16px)] justify-items-center gap-[2px]">
      {WEEKDAYS.map((label) => (
        <span key={label} className={AXIS}>
          {label}
        </span>
      ))}
      {week(days, today).map(square)}
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
  return (
    <div className="inline-grid grid-cols-[repeat(7,16px)] justify-items-center gap-[2px]">
      {WEEKDAYS.map((label) => (
        <span key={label} className={AXIS}>
          {label}
        </span>
      ))}
      {month(days, today).map(square)}
    </div>
  )
}

/** The year: a column per week, Monday first, with the weekday names down the side and a
 *  month ruler across the top — without it there is no way to read where in the year a
 *  column sits. */
function YearGrid({
  days,
  square,
  language,
}: {
  days: DailyBucket[]
  square: (item: Square) => ReactNode
  language: string
}) {
  const squares = year(days)
  const leading = squares.length > 0 ? weekdayIndex(squares[0].date as string) : 0
  const columns = Math.ceil((squares.length + leading) / 7)
  const pads = squares.length > 0 ? leadingBlanks(squares[0].date as string) : []
  const monthOf = new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' })

  // Only the week a month starts in gets a label, and only once.
  const ruler = new Map<number, string>()
  const labelled = new Set<string>()
  squares.forEach((item, offset) => {
    if (item.date === null) return
    const yearMonth = item.date.slice(0, 7)
    const date = new Date(`${item.date}T00:00:00Z`)
    if (date.getUTCDate() > 7 || labelled.has(yearMonth)) return
    labelled.add(yearMonth)
    ruler.set(Math.floor((offset + leading) / 7), monthOf.format(date))
  })

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className="grid gap-[2px] pl-[32px]"
        style={{ gridTemplateColumns: `repeat(${columns}, 10px)` }}
      >
        {Array.from({ length: columns }, (_, column) => (
          <span key={column} className={cn(AXIS, 'whitespace-nowrap')}>
            {ruler.get(column) ?? ''}
          </span>
        ))}
      </div>

      <div className="inline-flex gap-[6px]">
        <div className="grid grid-rows-[repeat(7,10px)] gap-[2px]">
          {WEEKDAYS.map((label) => (
            <span key={label} className={cn(AXIS, 'w-[26px]')}>
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${columns}, 10px)` }}
        >
          {pads.map((pad) => (
            <span key={pad.key} className={SQUARE} />
          ))}
          {squares.map(square)}
        </div>
      </div>
    </div>
  )
}
