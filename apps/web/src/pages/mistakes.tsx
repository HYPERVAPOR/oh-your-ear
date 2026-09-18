import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import type { components } from '@/api/schema'

type ExerciseKind = components['schemas']['ExerciseKind']
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold">{t('mistakes.title')}</h1>
          <Link to="/me" className="text-sm text-muted-foreground hover:text-foreground">
            {t('auth.account')}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setFilter(kind)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filter === kind
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {kind === 'all' ? t('mistakes.filterAll') : t(`modules.${kind}`)}
            </button>
          ))}
        </div>

        {data && data.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">{t('mistakes.empty')}</p>
        )}

        <ul className="mt-6 space-y-3">
          {data?.map((mistake) => (
            <li
              key={mistake.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {questionLabel(mistake)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t(`modules.${mistake.exercise}`)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('mistakes.answer', { answer: answerLabel(mistake) })}
                  {' · '}
                  {t('mistakes.wrongCount', { count: mistake.wrongCount })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={practiceLink(mistake)}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
