import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Note } from 'tonal'

import { Button } from '@/components/ui/button'
import { PlayButton } from '@/components/play-button'
import { BooleanToggle, ConfigPanel } from '@/components/exercises/config-panel'
import { cn, feedbackPill, optionHighlight } from '@/lib/utils'
import { recordAnswer } from '@/lib/practice'
import { buildSingleNotePool, useExerciseConfig } from '@/lib/exercise-config'

interface SingleNoteRound {
  target: string
  options: string[]
}

/** One draw for the whole round: picking the target and the options separately
 *  could leave the target out of its own option list. */
function createRound(seed: string | null, pool: string[]): SingleNoteRound {
  const target = seed ?? pool[Math.floor(Math.random() * pool.length)]
  const distractors = shuffle(pool.filter((note) => note !== target)).slice(0, 7)
  return { target, options: shuffle([target, ...distractors]) }
}

function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

interface SingleNoteExerciseProps {
  onBack?: () => void
}

export function SingleNoteExercise({ onBack }: SingleNoteExerciseProps) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('singleNote')
  const notePool = useMemo(() => buildSingleNotePool(config), [config])
  // A notebook entry seeds the exact question it wants re-practised.
  const seededNote = useSearchParams()[0].get('note')
  const [round, setRound] = useState(() => createRound(seededNote, notePool))
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const startRound = useCallback(() => {
    setRound(createRound(null, buildSingleNotePool(config)))
    setSelected(null)
  }, [config])

  const handleGuess = useCallback(
    (guess: string) => {
      if (selected) return
      setSelected(guess)
      setTotal((prev) => prev + 1)
      const isRight = Note.midi(guess) === Note.midi(round.target)
      if (isRight) {
        setScore((prev) => prev + 1)
      }
      recordAnswer({
        exercise: 'singleNote',
        correct: isRight,
        chosen: guess,
        expected: round.target,
        prompt: { note: round.target },
      })
    },
    [selected, round.target],
  )

  const isCorrect = selected ? Note.midi(selected) === Note.midi(round.target) : null

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t('modules.singleNote')}</h1>
              <p className="text-xs text-muted-foreground">{t('exercises.randomTest')}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('score', { correct: score, total })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-6 text-center text-muted-foreground">{t('exercises.instruction')}</p>

        <div className="mb-8">
          <PlayButton note={round.target} label={t('actions.play')} />
        </div>

        {selected && (
          <div
            className={cn(
              'mb-6 rounded-md px-4 py-2 text-center text-sm font-medium',
              feedbackPill(isCorrect),
            )}
          >
            {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer: round.target })}
          </div>
        )}

        <div className="grid w-full grid-cols-4 gap-3">
          {round.options.map((note) => (
            <Button
              key={note}
              variant="outline"
              disabled={!!selected}
              onClick={() => handleGuess(note)}
              className={cn(
                'h-14 text-lg',
                selected &&
                  Note.midi(note) === Note.midi(round.target) &&
                  optionHighlight('correct'),
                selected === note && !isCorrect && optionHighlight('wrong'),
              )}
            >
              {note}
            </Button>
          ))}
        </div>

        <div className="mt-8 w-full max-w-md">
          <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
            <div className="space-y-3">
              <BooleanToggle
                label={t('exerciseConfig.whiteKeys')}
                checked={config.whiteKeys}
                onChange={(whiteKeys) => updateConfig({ whiteKeys })}
              />
              <BooleanToggle
                label={t('exerciseConfig.blackKeys')}
                checked={config.blackKeys}
                onChange={(blackKeys) => updateConfig({ blackKeys })}
              />
            </div>
          </ConfigPanel>
        </div>

        {selected && (
          <Button className="mt-8 gap-1" onClick={startRound}>
            {t('actions.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </main>
    </div>
  )
}
