import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DEFAULT_GOAL,
  dayPercent,
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
 * The week's days and the month's days are the same square at the same size — the week is
 * simply the month with one row — and both spread their seven columns across the whole card,
 * which is what gives the weekday names above them their room. Today reads across the card
 * as a bar, so all three of those views end at the same x. The year is the one view at a
 * second scale — 371 days have to fit inside one card — so its column is fluid instead of
 * fixed: 8px at the dashboard's width, 10px when the card is wide, floored at 8px so a
 * filled and an empty square stay tellable apart (a phone falls back to scrolling there).
 */
export const CELL = 'size-5 shrink-0'
export const TIER_CLASS = ['bg-surface-strong', 'bg-success/35', 'bg-success']
/** The year's cell fills its track, so the square is as wide as whatever the card allows. */
const YEAR_CELL = 'aspect-square w-full'
/** 8px + 2px apart is exactly the dashboard card's width for 54 columns. */
const YEAR_TRACK = 'minmax(8px, 1fr)'
const YEAR_BOX = 'w-full max-w-[646px]'
const GAP = 'gap-0.5'
/** The axis takes the size of the cells it labels: 12px over the week's and month's 20px
 *  squares, 10px over the year's 8px ones. */
const AXIS = 'text-[12px] leading-[12px] text-muted'
const YEAR_AXIS = 'text-[10px] leading-[10px] text-muted'

/** English, and fixed: the axis is a scale, not a sentence. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Today: the count, and one bar. Twenty squares said the same thing a bar says, only one
 * question at a time — the bar is the same length as the week's row, so the two tabs read
 * as the same line, and it reuses the progress bar the rest of the app already draws
 * (track `surface-strong`, fill `primary`). It sits at 8px rather than the 4px of the rack
 * rows: this one is the whole view.
 */
export function DayView({ day }: { day: DailyBucket | undefined }) {
  const { t } = useTranslation('common')
  const solved = day?.solved ?? 0
  const goal = day && day.goal > 0 ? day.goal : DEFAULT_GOAL
  const percent = dayPercent(day, DEFAULT_GOAL)

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tabular text-[26px] font-medium leading-none">
          {t('plan.solvedOfGoal', { solved, goal })}
        </p>
        {day?.met && <p className="text-[13px] font-medium text-success-text">{t('home.met')}</p>}
      </div>
      <div aria-hidden="true" className="mt-4 h-2 w-full overflow-hidden bg-surface-strong">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/**
 * The calendar grid, one row per week, Monday first: seven columns spread across the card
 * with the square centred in each. The week tab is this grid with a single row, so the two
 * tabs share a ruler and a left edge as well as a cell — the only difference between them
 * is how much of the calendar is on screen.
 */
function CalendarGrid({
  squares,
  square,
}: {
  squares: Square[]
  square: (item: Square, cell: string) => ReactNode
}) {
  return (
    <div className={cn('grid w-full grid-cols-7 justify-items-center', GAP)}>
      {WEEKDAYS.map((label) => (
        <span key={label} className={AXIS}>
          {label}
        </span>
      ))}
      {squares.map((item) => square(item, CELL))}
    </div>
  )
}

/** This week: the calendar with a single row. */
export function WeekRow({
  days,
  today,
  square,
}: {
  days: DailyBucket[]
  today: string
  square: (item: Square, cell: string) => ReactNode
}) {
  return <CalendarGrid squares={week(days, today)} square={square} />
}

/** This month: the same grid, five or six rows of it. */
export function MonthGrid({
  days,
  today,
  square,
}: {
  days: DailyBucket[]
  today: string
  square: (item: Square, cell: string) => ReactNode
}) {
  return <CalendarGrid squares={month(days, today)} square={square} />
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
          <span key={column} className={cn(YEAR_AXIS, 'whitespace-nowrap')}>
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
