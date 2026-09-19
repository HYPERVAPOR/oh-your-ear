import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { ExerciseShell } from '@/components/exercise-shell'
import { Card } from '@/components/ui/card'
import type { ExerciseKind } from '@/components/ui/orb'
import type { RoundEntry } from '@/lib/round'
import { useAuthStore } from '@/stores/auth-store'

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="badge-label text-muted">{label}</p>
      <p className="tabular mt-1.5 text-[32px] font-light leading-none">{value}</p>
    </div>
  )
}

/** What a finished round shows: the numbers, then every question, in order. */
export function RoundSummary({
  kind,
  entries,
  durationMs,
  onRestart,
  onBack,
}: {
  kind: ExerciseKind
  entries: RoundEntry[]
  durationMs: number
  onRestart: () => void
  onBack?: () => void
}) {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  const correct = entries.filter((entry) => entry.correct).length
  const accuracy = entries.length > 0 ? Math.round((correct / entries.length) * 100) : 0
  const seconds = Math.round(durationMs / 1000)

  return (
    <ExerciseShell
      kind={kind}
      onBack={onBack}
      score={{ correct, total: entries.length }}
      instruction={false}
    >
      <Card className="w-full p-6 sm:p-7">
        <h2 className="text-[22px] font-light leading-tight">{t('round.title')}</h2>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <Figure label={t('round.correct')} value={correct} />
          <Figure label={t('round.accuracy')} value={`${accuracy}%`} />
          <Figure label={t('round.duration')} value={`${seconds}s`} />
        </div>

        <h3 className="badge-label mt-8 text-muted">{t('round.review')}</h3>
        <ol className="mt-3 divide-y divide-hairline">
          {entries.map((entry, index) => (
            <li
              key={`${entry.question}-${entry.at}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <span className="flex items-baseline gap-3">
                <span className="tabular w-5 text-[13px] text-muted">{index + 1}</span>
                <span className="tabular text-[15px]">{entry.question}</span>
              </span>
              <span
                className={
                  entry.correct
                    ? 'tabular text-[14px] text-success-text'
                    : 'tabular text-[14px] text-error-text'
                }
              >
                {entry.correct
                  ? t('round.answeredCorrect', { answer: entry.chosen })
                  : t('round.answeredWrong', { chosen: entry.chosen, answer: entry.expected })}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[16px] font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            {t('round.restart')}
          </button>
          <Link
            to="/"
            className="text-[15px] text-muted underline underline-offset-4 hover:text-ink"
          >
            {t('round.exit')}
          </Link>
        </div>

        {!user && (
          <p className="mt-5 text-[14px] text-muted">
            {t('round.guestHint')}{' '}
            <Link to="/login" className="underline underline-offset-4">
              {t('actions.login')}
            </Link>
          </p>
        )}
      </Card>
    </ExerciseShell>
  )
}
