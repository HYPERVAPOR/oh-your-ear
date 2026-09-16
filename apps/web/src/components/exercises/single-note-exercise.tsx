import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Note } from 'tonal'

import { Button } from '@/components/ui/button'
import { PlayButton } from '@/components/play-button'
import { cn } from '@/lib/utils'

const NOTE_POOL = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickTarget(): string {
  return NOTE_POOL[Math.floor(Math.random() * NOTE_POOL.length)]
}

interface SingleNoteExerciseProps {
  onBack?: () => void
}

export function SingleNoteExercise({ onBack }: SingleNoteExerciseProps) {
  const { t } = useTranslation('common')
  const [target, setTarget] = useState(pickTarget)
  const [options, setOptions] = useState(() => shuffle(NOTE_POOL))
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const startRound = useCallback(() => {
    setTarget(pickTarget())
    setOptions(shuffle(NOTE_POOL))
    setSelected(null)
  }, [])

  const handleGuess = useCallback(
    (guess: string) => {
      if (selected) return
      setSelected(guess)
      setTotal((prev) => prev + 1)
      if (Note.midi(guess) === Note.midi(target)) {
        setScore((prev) => prev + 1)
      }
    },
    [selected, target]
  )

  const isCorrect = selected ? Note.midi(selected) === Note.midi(target) : null

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{t('modules.singleNote')}</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('score', { correct: score, total })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-6 text-center text-muted-foreground">{t('exercises.instruction')}</p>

        <div className="mb-8">
          <PlayButton note={target} label={t('actions.play')} />
        </div>

        {selected && (
          <div
            className={cn(
              'mb-6 rounded-md px-4 py-2 text-center text-sm font-medium',
              isCorrect
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
            )}
          >
            {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer: target })}
          </div>
        )}

        <div className="grid w-full grid-cols-4 gap-3">
          {options.map((note) => (
            <Button
              key={note}
              variant="outline"
              disabled={!!selected}
              onClick={() => handleGuess(note)}
              className={cn(
                'h-14 text-lg',
                selected && Note.midi(note) === Note.midi(target) &&
                  'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200',
                selected === note && !isCorrect &&
                  'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'
              )}
            >
              {note}
            </Button>
          ))}
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
