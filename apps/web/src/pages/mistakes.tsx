import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { apiClient } from '@/api/client'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Card, EmptyState } from '@/components/ui/card'
import { ModuleSwatch } from '@/components/ui/orb'
import type { ExerciseKind } from '@/components/ui/orb'
import { cn } from '@/lib/utils'
import { iconKey } from '@oh-your-ear/shared/pref-controls'
import type { components } from '@/api/schema'

type Mistake = components['schemas']['Mistake']

const FILTERS: (ExerciseKind | 'all')[] = [
  'all',
  'singleNote',
  'interval',
  'chord',
  'melody',
  'rhythm',
]

/** Where re-practising a notebook entry should send the user. */
function practiceLink(mistake: Mistake): string {
  const prompt = mistake.prompt ?? {}

  switch (mistake.exercise) {
    case 'singleNote':
      return `/exercise/single-note?note=${encodeURIComponent(String(prompt.note ?? ''))}`
    case 'interval':
      return `/exercise/interval?root=${encodeURIComponent(String(prompt.root ?? ''))}&interval=${encodeURIComponent(String(prompt.interval ?? ''))}`
    case 'chord':
      return `/exercise/chord?root=${encodeURIComponent(String(prompt.root ?? ''))}&type=${encodeURIComponent(String(prompt.type ?? ''))}`
    case 'melody': {
      const notes = Array.isArray(prompt.notes) ? prompt.notes.join(',') : ''
      return `/exercise/melody?melody=${encodeURIComponent(notes)}`
    }
    default:
      // Rhythm patterns have no per-question seed yet; the module itself is the drill.
      return '/exercise/rhythm'
  }
}

/** The notebook: questions missed and not yet answered correctly again. */
export function Mistakes() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ExerciseKind | 'all'>('all')

  const { data } = useQuery({
    queryKey: ['mistakes', filter],
    queryFn: async () => {
      const { data: mistakes } = await apiClient.GET('/me/mistakes', {
        params: { query: filter === 'all' ? {} : { exercise: filter } },
      })
      return mistakes
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/me/mistakes/{id}', { params: { path: { id } } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mistakes'] }),
  })

  function answerLabel(mistake: Mistake) {
    if (mistake.exercise === 'interval') return t(`intervals.${mistake.answer}`)
    if (mistake.exercise === 'chord') return t(`chords.${mistake.answer}`)
    return mistake.answer
  }

  function questionLabel(mistake: Mistake) {
    const prompt = mistake.prompt ?? {}

    switch (mistake.exercise) {
      case 'singleNote':
        return String(prompt.note ?? '')
      case 'interval':
        return `${prompt.root} → ${prompt.second}`
      case 'chord':
        return Array.isArray(prompt.notes) ? prompt.notes.join(' ') : String(prompt.type ?? '')
      case 'melody':
        return Array.isArray(prompt.notes) ? prompt.notes.join(' ') : ''
      case 'rhythm':
        return t('mistakes.rhythmPattern', {
          count: Array.isArray(prompt.pattern) ? prompt.pattern.length : 0,
          bpm: prompt.bpm ?? '—',
        })
      default:
        return ''
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 px-6 py-12 sm:py-16">
        {/* Gutter outside the 1200px box and the same width as the header: with the
            padding inside, this column sat 300px inboard of the bar above it. */}
        <div className="mx-auto w-full max-w-[1200px]">
          {/* Up to the account screen, not home: the notebook is one of its sub-pages.
              Same 32px key as the account page, in the content column, not in the bar. */}
          <Link
            to="/me"
            className={`${iconKey} mb-5 no-underline`}
            aria-label={t('actions.back')}
            title={t('actions.back')}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </Link>

          <h1 className="font-display text-[30px] font-medium leading-tight sm:text-[36px]">
            {t('mistakes.title')}
          </h1>

          <div className="mt-7 flex flex-wrap gap-2">
            {FILTERS.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={filter === kind}
                onClick={() => setFilter(kind)}
                className={cn(
                  'rounded-none border px-3.5 py-1.5 text-[14px] transition-colors',
                  filter === kind
                    ? 'border-transparent bg-surface-strong font-medium text-ink'
                    : 'border-hairline text-muted-soft hover:border-hairline-strong hover:text-ink',
                )}
              >
                {kind === 'all' ? t('mistakes.filterAll') : t(`modules.${kind}`)}
              </button>
            ))}
          </div>

          {data && data.length === 0 && (
            <EmptyState className="mt-10">{t('mistakes.empty')}</EmptyState>
          )}

          {data && data.length > 0 && (
            <Card className="mt-8 divide-y divide-hairline overflow-hidden">
              {data.map((mistake) => (
                <div
                  key={mistake.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2.5 text-[16px] font-medium">
                      <ModuleSwatch kind={mistake.exercise as ExerciseKind} />
                      <span className="tabular truncate">{questionLabel(mistake)}</span>
                    </p>
                    {/* Indented to the question label, so the swatch reads as a bullet. */}
                    <p className="mt-1 flex flex-wrap gap-x-3 pl-[20px] text-[14px] text-muted">
                      <span>{t('mistakes.answer', { answer: answerLabel(mistake) })}</span>
                      <span>{t('mistakes.wrongCount', { count: mistake.wrongCount })}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to={practiceLink(mistake)}
                      className="text-[15px] font-medium underline underline-offset-4"
                    >
                      {t('mistakes.practice')}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove.mutate(mistake.id)}
                      disabled={remove.isPending}
                    >
                      {t('mistakes.remove')}
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
