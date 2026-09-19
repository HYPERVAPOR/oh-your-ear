import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { ExerciseShell } from '@/components/exercise-shell'
import { Card } from '@/components/ui/card'
import type { ExerciseKind } from '@/components/ui/orb'
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { pickText, useLevelCatalog, type Level } from '@/lib/levels'
import type { RoundEntry } from '@/lib/round'
import { useAuthStore } from '@/stores/auth-store'

/** Route segment for a module, shared with the question-set page. */
export function modulePath(module: ExerciseKind): string {
  return module === 'singleNote' ? 'single-note' : module
}

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
  level,
  entries,
  durationMs,
  onRestart,
  onBack,
}: {
  kind: ExerciseKind
  /** Set when this round was a question-set level; the summary then judges it. */
  level?: Level
  entries: RoundEntry[]
  durationMs: number
  onRestart: () => void
  onBack?: () => void
}) {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const [saved, setSaved] = useState<{ passed: boolean; bestAccuracy: number } | null>(null)

  // How today stands against the daily goal, so a round says where it left you.
  const { data: plan } = useQuery({
    queryKey: ['study-plan'],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/plan')
      return data
    },
  })
  const reported = useRef(false)

  const correct = entries.filter((entry) => entry.correct).length
  const accuracy = entries.length > 0 ? Math.round((correct / entries.length) * 100) : 0
  const seconds = Math.round(durationMs / 1000)
  const { data: catalog } = useLevelCatalog()
  const passed = accuracy / 100 >= (level?.passMark ?? 1)
  const chain = level ? (catalog ?? []).find((set) => set.module === kind)?.levels : undefined
  const next =
    level && chain ? chain[chain.findIndex((item) => item.slug === level.slug) + 1] : undefined

  // One report per finished round, and only for signed-in users: guests keep
  // their progress nowhere, which is the point of the mode being an account feature.
  useEffect(() => {
    if (!level || !user || reported.current || entries.length === 0) return
    reported.current = true

    void (async () => {
      try {
        const { data } = await apiClient.POST('/me/levels/{id}', {
          params: { path: { id: level.slug } },
          body: {
            module: kind,
            correct,
            total: entries.length,
            passMark: level.passMark,
          },
        })
        if (data) setSaved({ passed: data.passed, bestAccuracy: data.bestAccuracy })
      } catch {
        // Let a later render try again rather than losing the result.
        reported.current = false
      }
    })()
  }, [level, kind, user, entries.length, correct])

  return (
    <ExerciseShell
      kind={kind}
      onBack={onBack}
      score={{ correct, total: entries.length }}
      instruction={false}
    >
      <Card className="w-full p-6 sm:p-7">
        <h2 className="text-[22px] font-light leading-tight">
          {level
            ? t('round.levelTitle', { level: pickText(level.title, i18n.language) })
            : t('round.title')}
        </h2>

        {level && (
          <p className="mt-2 text-[15px] text-body">
            {passed
              ? next
                ? t('round.levelPassedNext')
                : t('round.levelPassedEnd')
              : t('round.levelFailed', { mark: Math.round(level.passMark * 100) })}
            {saved && (
              <span className="text-muted">
                {' '}
                {t('round.levelBest', { percent: Math.round(saved.bestAccuracy * 100) })}
              </span>
            )}
          </p>
        )}

        {plan && (
          <p className="mt-3 text-[15px] text-body">
            {t('daily.afterRound', {
              solved: plan.today.solved,
              goal: plan.dailyGoal,
              remaining: Math.max(plan.dailyGoal - plan.today.solved, 0),
            })}
          </p>
        )}

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
          {level && passed && next && (
            <Link
              to={`/exercise/${modulePath(kind)}?level=${next.slug}`}
              className="inline-flex h-12 items-center rounded-full border border-hairline-strong px-6 text-[16px] font-medium transition-colors hover:bg-surface-strong"
            >
              {t('round.nextLevel')}
            </Link>
          )}
          {level && (
            <Link
              to="/levels"
              className="text-[15px] text-muted underline underline-offset-4 hover:text-ink"
            >
              {t('round.allLevels')}
            </Link>
          )}
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
