import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Card } from '@/components/ui/card'
import { PracticeTrend } from '@/components/practice-trend'
import { ModuleSwatch, MODULES, MODULE_SWATCH } from '@/components/ui/orb'
import { cn } from '@/lib/utils'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="badge-label text-muted">{label}</p>
      <p className="tabular mt-1.5 font-display text-[32px] font-medium leading-none">{value}</p>
    </div>
  )
}

/** Totals, per-module accuracy, and a daily trend. */
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
        <h2 className="font-display text-[22px] font-medium leading-tight">{t('stats.title')}</h2>
        <p className="mt-3 text-[15px] text-muted">{t('stats.empty')}</p>
      </Card>
    )
  }

  const accuracy = Math.round(data.accuracy * 100)
  const activeDays = data.daily.filter((day) => day.solved > 0).length

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-[22px] font-medium leading-tight">{t('stats.title')}</h2>

      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label={t('stats.solved')} value={data.solved} />
        <Stat label={t('stats.accuracy')} value={`${accuracy}%`} />
        <Stat label={t('stats.activeDays')} value={activeDays} />
        <Stat label={t('stats.streak')} value={data.streak} />
      </div>

      <PracticeTrend daily={data.daily} />

      <h3 className="badge-label mt-8 text-muted">{t('stats.byExercise')}</h3>
      {/* All five modules, practised or not: an empty column says something too, and a chart
          whose bars appear as you use a module is one you cannot compare month to month.

          Fixed-width columns with the figure taking the width of the card's column, so five of
          them read as a chart instead of as a layout: the bars keep their width and the space
          between them is what grows. The gridlines carry the scale — 0, half, all of it — and
          the bars are read against them; the bars themselves are ink, black on paper and white
          on night, the same as every other mark in this card. The top band is where a column's
          own value goes when the column is at 100%, so nothing is ever written outside the plot.

          The axis is a row of underlines, one per module in that module's own colour — the same
          mark the level tabs use — instead of five names: at this size the names were the widest
          thing in the figure (English ones wrap). What the underline cannot say, the card that
          floats over a column on hover does — name, colour, accuracy, tried, right. It stays in
          the document with `opacity-0` rather than being hidden, so a screen reader reads all
          five while nobody is hovering, and the value printed on the column steps aside for it. */}
      <div className="mt-4 flex max-w-md text-[12px]">
        <div className="flex h-56 w-8 shrink-0 flex-col text-right text-muted tabular">
          <span aria-hidden="true" className="h-6" />
          <div className="relative flex-1">
            <span className="absolute top-0 right-0 -translate-y-1/2">100%</span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">50%</span>
            <span className="absolute top-full right-0 -translate-y-1/2">0%</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-56 flex-col">
            <span aria-hidden="true" className="h-6" />
            <div className="relative flex-1 border-l border-hairline-strong">
              <span className="absolute inset-x-0 top-0 border-t border-hairline" />
              <span className="absolute inset-x-0 top-1/2 border-t border-hairline" />
              <span className="absolute inset-x-0 bottom-0 border-t border-hairline-strong" />

              <div className="flex h-full justify-between px-2">
                {MODULES.map((kind, index) => {
                  const entry = data.byExercise[kind]
                  const solved = entry?.solved ?? 0
                  const correct = entry?.correct ?? 0
                  const percent = entry ? Math.round(entry.accuracy * 100) : 0
                  // The two end cards hug the plot's edge instead of centring on their column:
                  // a 160px card centred on the outermost bar hangs off the card on a phone.
                  const anchor =
                    index === 0
                      ? 'left-0'
                      : index === MODULES.length - 1
                        ? 'right-0'
                        : 'left-1/2 -translate-x-1/2'

                  return (
                    <div key={kind} className="group relative w-4">
                      {solved > 0 && (
                        <span
                          className="absolute inset-x-0 bottom-0 bg-primary"
                          style={{ height: `${percent}%` }}
                        />
                      )}
                      <span
                        className="absolute inset-x-0 mb-1 text-center tabular text-muted transition-opacity group-hover:opacity-0"
                        style={{ bottom: `${percent}%` }}
                      >
                        {solved > 0 ? `${percent}%` : '—'}
                      </span>

                      {/* Floats over the column's own top, and holds still: it is a readout, not
                          a thing to click, so it must never take the pointer away from the bar
                          underneath it. */}
                      <div
                        className={`pointer-events-none absolute z-10 mb-2 w-40 rounded-xl border border-hairline-strong bg-surface px-3 py-2 text-left opacity-0 transition-opacity group-hover:opacity-100 ${anchor}`}
                        style={{ bottom: `${percent}%` }}
                      >
                        <div className="flex items-center gap-2 text-[13px]">
                          <ModuleSwatch kind={kind} />
                          {t(`modules.${kind}`)}
                        </div>
                        <div className="tabular mt-1.5 text-[13px]">
                          {t('stats.accuracy')} {solved > 0 ? `${percent}%` : '—'}
                        </div>
                        <div className="tabular mt-0.5 text-muted">
                          {t('stats.cardTally', { solved, correct })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* The axis: one underline per module, in that module's own colour and as wide as its
              column, so the mark sits exactly under the bar it names. */}
          <div className="mt-1.5 flex justify-between px-2">
            {MODULES.map((kind) => (
              <span key={kind} className="w-4">
                <span className={cn('block h-0.5', MODULE_SWATCH[kind])} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
