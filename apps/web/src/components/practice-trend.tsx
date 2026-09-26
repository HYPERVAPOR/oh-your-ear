import { useTranslation } from 'react-i18next'

import type { components } from '@/api/schema'

type Daily = components['schemas']['DailyProgress']

/** The last two weeks, one bar per day: how many questions were answered, against a scale that
 *  ends at the busiest of those days.
 *
 *  It is drawn the way the module chart below it is drawn — a scale down the left, gridlines
 *  across, every day that has a count printing it above its own bar — because the same complaint
 *  applied to both: a bar chart of daily counts that only explains itself inside a hover title
 *  reads as decoration. The floor of 10% keeps a single answered question a mark rather than a
 *  hairline, and the label follows the bar it belongs to, floor included. */
export function PracticeTrend({ daily }: { daily: Daily[] }) {
  const { t } = useTranslation('common')
  const peak = Math.max(...daily.map((day) => day.solved), 1)

  return (
    <>
      <h3 className="badge-label mt-8 text-muted">{t('stats.trend', { days: daily.length })}</h3>
      {/* The same vocabulary as the chart below it, because the same complaint applied: a bar
        chart of daily counts that only explains itself inside a hover title reads as
        decoration. The scale runs 0 to the busiest day (a round 20 would be a tidier axis and
        a worse chart), every day that has a count prints it, and the label sits on the bar's
        own top — so the shape is readable without touching anything. */}
      <div className="mt-3 flex max-w-md text-[12px]">
        <div className="flex h-20 w-8 shrink-0 flex-col text-right text-muted tabular">
          <span aria-hidden="true" className="h-6" />
          <div className="relative flex-1">
            <span className="absolute top-0 right-0 -translate-y-1/2">{peak}</span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">
              {Math.round(peak / 2)}
            </span>
            <span className="absolute top-full right-0 -translate-y-1/2">0</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-20 flex-col">
            <span aria-hidden="true" className="h-6" />
            <div
              className="relative flex flex-1 items-end gap-1.5 border-l border-b border-hairline-strong"
              role="img"
              aria-label={t('stats.trendLabel', {
                from: daily[0]?.date ?? '',
                to: daily[daily.length - 1]?.date ?? '',
                solved: daily.reduce((sum, day) => sum + day.solved, 0),
              })}
            >
              <span className="absolute inset-x-0 top-0 border-t border-hairline" />
              <span className="absolute inset-x-0 top-1/2 border-t border-hairline" />

              {/* The same card the module chart floats over its columns, instead of the
                  browser's own tooltip: `title` waits a second, cannot be styled, and says
                  nothing next to the rest of this card. It holds still and stays in the
                  document with `opacity-0` rather than being hidden, so what is written on the
                  bars is not the only copy of it. The first and last ride the plot's edge —
                  fourteen narrow columns leave no room to centre a card on the ends. */}
              {daily.map((day, index) => {
                // A floor of 10%, so a day with a single answer is a mark rather than a hairline.
                const height =
                  day.solved > 0 ? Math.max(10, Math.round((day.solved / peak) * 100)) : 0
                const anchor =
                  index === 0
                    ? 'left-0'
                    : index === daily.length - 1
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2'

                return (
                  <div key={day.date} className="group relative h-full flex-1">
                    {height > 0 && (
                      <>
                        <span
                          className="absolute inset-x-0 bottom-0 rounded-sm bg-primary"
                          style={{ height: `${height}%` }}
                        />
                        <span
                          className="absolute inset-x-0 mb-0.5 text-center tabular text-muted transition-opacity group-hover:opacity-0"
                          style={{ bottom: `${height}%` }}
                        >
                          {day.solved}
                        </span>
                      </>
                    )}

                    <div
                      className={`pointer-events-none absolute z-10 mb-1.5 w-36 rounded-xl border border-hairline-strong bg-surface px-3 py-2 text-left opacity-0 transition-opacity group-hover:opacity-100 ${anchor}`}
                      style={{ bottom: `${height}%` }}
                    >
                      <div className="tabular text-[13px]">{day.date}</div>
                      <div className="tabular mt-0.5 text-muted">
                        {t('stats.daySolved', { count: day.solved })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[13px] text-muted">
            <span className="tabular">{daily[0]?.date}</span>
            <span className="tabular">{daily[daily.length - 1]?.date}</span>
          </div>
        </div>
      </div>
    </>
  )
}
