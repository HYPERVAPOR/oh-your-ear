import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Day = {
  date: string
  solved: number
  correct: number
  goal: number
}

/** The three states a day can be in: goal met, partly done, or nothing. */
function tier(day: Day): 'met' | 'partial' | 'none' {
  if (day.solved <= 0) return 'none'
  return day.goal > 0 && day.solved >= day.goal ? 'met' : 'partial'
}

const TIER_CLASS = {
  met: 'bg-success',
  partial: 'bg-success/35',
  none: 'bg-surface-strong',
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/** A grid cell: either a day, or a blank before the range starts. */
type Cell = { key: string; day?: Day }

/**
 * Calendar heatmap of the last year, one column per week, aimed at the "did I
 * practise today" question: dark = the day's goal was met, light = partly done,
 * grey = nothing.
 */
export function DailyHeatmap() {
  const { t, i18n } = useTranslation('common')

  const { data } = useQuery({
    queryKey: ['daily-history'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: history } = await apiClient.GET('/me/daily', {
        params: { query: { days: 371 } },
      })
      return history
    },
  })

  if (!data || data.days.length === 0) return null

  const days: Day[] = data.days
  const today = days[days.length - 1].date
  const monthOf = new Intl.DateTimeFormat(i18n.language, { month: 'short' })

  // Pad the first week so every column starts on Monday.
  const leading = (new Date(days[0].date).getDay() + 6) % 7
  const cells: Cell[] = []
  for (let i = 0; i < leading; i++) cells.push({ key: `pad-${i}` })
  days.forEach((day) => cells.push({ key: day.date, day }))
  const columns = Math.ceil(cells.length / 7)

  // Which column each month starts in, for the axis above the grid.
  const monthAt = new Map<number, string>()
  const labelled = new Set<string>()
  cells.forEach((cell, index) => {
    if (!cell.day) return
    const date = new Date(cell.day.date)
    const month = cell.day.date.slice(0, 7)
    const column = Math.floor(index / 7)
    // Only the week a month starts in gets the label, and only once.
    if (date.getDate() <= 7 && !labelled.has(month)) {
      labelled.add(month)
      monthAt.set(column, monthOf.format(date))
    }
  })

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="badge-label text-muted">{t('daily.history')}</p>
          <p className="tabular mt-1.5 text-[15px]">
            {t('daily.streaks', {
              current: data.currentStreak,
              longest: data.longestStreak,
            })}
          </p>
        </div>

        <ul className="flex items-center gap-4 text-[13px] text-muted">
          {(['met', 'partial', 'none'] as const).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-[3px]', TIER_CLASS[key])} />
              {t(`daily.tier.${key}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
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
              {cells.map((cell) =>
                cell.day ? (
                  <span
                    key={cell.key}
                    title={t('daily.cellTitle', {
                      date: cell.day.date,
                      solved: cell.day.solved,
                      goal: cell.day.goal,
                    })}
                    data-tier={tier(cell.day)}
                    className={cn(
                      'h-2.5 w-2.5 rounded-[3px]',
                      TIER_CLASS[tier(cell.day)],
                      cell.day.date === today && 'ring-1 ring-ink',
                    )}
                  />
                ) : (
                  <span key={cell.key} className="h-2.5 w-2.5" />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
