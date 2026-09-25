import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DEFAULT_GOAL,
  goalSlots,
  leadingBlanks,
  month,
  week,
  weekdayIndex,
  year,
  type DailyBucket,
  type Square,
} from '@/lib/heatmap'
import { cn } from '@/lib/utils'

/**
 * The drawing vocabulary — one cell, one ruler, one left edge (PRD 7.1.4).
 *
 * A square is a unit of progress, so the same 16px square is used for today's questions, a
 * week's days and a month's days: switching between those three changes the shape of the
 * grid, never its ruler. Today and this week both read across the whole card — the day's
 * twenty questions and the week's seven days are spread over the same length, which is what
 * gives the weekday names above their room — while the month stays a compact calendar page,
 * because a month is a grid of rows and columns rather than a line. The year is the one
 * view at a second scale — 371 days have to fit inside one card — so its column is fluid
 * instead of fixed: 8px at the dashboard's width, 10px when the card is wide, floored at
 * 8px so a filled and an empty square stay tellable apart (a phone falls back to scrolling
 * there). Every view starts at the same x.
 */
export const CELL = 'size-4 shrink-0'
export const TIER_CLASS = ['bg-surface-strong', 'bg-success/35', 'bg-success']
/** The year's cell fills its track, so the square is as wide as whatever the card allows. */
const YEAR_CELL = 'aspect-square w-full'
/** 8px + 2px apart is exactly the dashboard card's width for 54 columns. */
const YEAR_TRACK = 'minmax(8px, 1fr)'
const YEAR_BOX = 'w-full max-w-[646px]'
const GAP = 'gap-0.5'
const AXIS = 'text-[10px] leading-[10px] text-muted'

/** English, and fixed: the axis is a scale, not a sentence. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Today: the count, and one square per question the goal asks for. */
export function DayView({ day }: { day: DailyBucket | undefined }) {
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
      {/* 铺满整行、格子均分，和「周」同一个长度（见文件头）。不折行：屏幕窄到放不下就横向滚动，
          跟年档一个待遇 —— 折行会让最后一行被均分拉散，那比滚动更难看。 */}
      <div aria-hidden="true" className="mt-3 flex w-full justify-between">
        {slots.map((slot) => (
          <span key={slot.key} className={cn(CELL, slot.filled ? TIER_CLASS[2] : TIER_CLASS[0])} />
        ))}
      </div>
    </div>
  )
}

/** This week: seven days spread across the card, each under its weekday name — the names
 *  need that room, and a week is a line rather than a calendar page. */
export function WeekRow({
  days,
  today,
  square,
}: {
  days: DailyBucket[]
  today: string
  square: (item: Square, cell: string) => ReactNode
}) {
  return (
    <div className="flex w-full justify-between">
      {week(days, today).map((item, index) => (
        <div key={item.key} className="flex flex-col items-center gap-0.5">
          <span className={AXIS}>{WEEKDAYS[index]}</span>
          {square(item, CELL)}
        </div>
      ))}
    </div>
  )
}

/** This month, as a calendar: the weekday header, blanks, then its days. */
export function MonthGrid({
  days,
  today,
  square,
}: {
  days: DailyBucket[]
  today: string
  square: (item: Square, cell: string) => ReactNode
}) {
  return (
    <div className={cn('inline-grid grid-cols-[repeat(7,16px)]', GAP)}>
      {WEEKDAYS.map((label) => (
        <span key={label} className={AXIS}>
          {label}
        </span>
      ))}
      {month(days, today).map((item) => square(item, CELL))}
    </div>
  )
}

/** The year: a column per week, Monday first, with the weekday names down the side and a
 *  month ruler across the top — without it there is no way to read where in the year a
 *  column sits. */
export function YearGrid({
  days,
  square,
  language,
}: {
  days: DailyBucket[]
  square: (item: Square, cell: string) => ReactNode
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
    <div className={cn('flex flex-col gap-1', YEAR_BOX)}>
      <div
        className={cn('grid', GAP)}
        style={{ gridTemplateColumns: `repeat(${columns}, ${YEAR_TRACK})` }}
      >
        {Array.from({ length: columns }, (_, column) => (
          <span key={column} className={cn(AXIS, 'whitespace-nowrap')}>
            {ruler.get(column) ?? ''}
          </span>
        ))}
      </div>

      <div
        className={cn('grid grid-flow-col grid-rows-7', GAP)}
        style={{ gridTemplateColumns: `repeat(${columns}, ${YEAR_TRACK})` }}
      >
        {pads.map((pad) => (
          <span key={pad.key} className={YEAR_CELL} />
        ))}
        {squares.map((item) => square(item, YEAR_CELL))}
      </div>
    </div>
  )
}
