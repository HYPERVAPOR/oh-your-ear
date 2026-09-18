import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Note } from 'tonal'

import { ExerciseShell, FeedbackNote, OptionTile } from '@/components/exercise-shell'
import { ConfigPanel, ConfigRow, Toggle } from '@/components/exercises/config-panel'
import { PlayButton } from '@/components/play-button'
import { Button } from '@/components/ui/button'
import { buildSingleNotePool, useExerciseConfig } from '@/lib/exercise-config'
import { recordAnswer } from '@/lib/practice'

function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

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

export function SingleNoteExercise({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('singleNote')
  const notePool = useMemo(() => buildSingleNotePool(config), [config])

  // A notebook entry seeds the exact question it wants re-practised.
  const seededNote = useSearchParams()[0].get('note')
  const [round, setRound] = useState(() => createRound(seededNote, notePool))
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const isCorrect = selected ? Note.midi(selected) === Note.midi(round.target) : null

  const handleGuess = useCallback(
    (guess: string) => {
      if (selected) return
      setSelected(guess)
      setTotal((prev) => prev + 1)

      const right = Note.midi(guess) === Note.midi(round.target)
      if (right) setScore((prev) => prev + 1)

      recordAnswer({
        exercise: 'singleNote',
        correct: right,
        chosen: guess,
        expected: round.target,
        prompt: { note: round.target },
      })
    },
    [selected, round.target],
  )

  const startRound = useCallback(() => {
    setRound(createRound(null, buildSingleNotePool(config)))
    setSelected(null)
  }, [config])

  return (
    <ExerciseShell kind="singleNote" onBack={onBack} score={{ correct: score, total }}>
      <PlayButton note={round.target} label={t('actions.play')} className="mb-10" />

      <div className="grid w-full grid-cols-4 gap-2.5">
        {round.options.map((note) => (
          <OptionTile
            key={note}
            disabled={!!selected}
            onClick={() => handleGuess(note)}
            className="tabular h-16"
            state={
              selected && Note.midi(note) === Note.midi(round.target)
                ? 'correct'
                : selected === note && !isCorrect
                  ? 'wrong'
                  : 'idle'
            }
          >
            {note}
          </OptionTile>
        ))}
      </div>

      {/* Reserved slots: answering must not move the tiles under the pointer. */}
      <div className="mt-6 flex min-h-[44px] items-center justify-center">
        {selected && (
          <FeedbackNote tone={isCorrect ? 'success' : 'error'}>
            {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer: round.target })}
          </FeedbackNote>
        )}
      </div>

      <div className="w-full">
        <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
          <ConfigRow label={t('exerciseConfig.keyFilter')}>
            <Toggle
              label={t('exerciseConfig.whiteKeys')}
              checked={config.whiteKeys}
              onChange={(whiteKeys) => updateConfig({ whiteKeys })}
            />
            <Toggle
              label={t('exerciseConfig.blackKeys')}
              checked={config.blackKeys}
              onChange={(blackKeys) => updateConfig({ blackKeys })}
            />
          </ConfigRow>
        </ConfigPanel>
      </div>

      <div className="mt-8 flex min-h-[52px] items-center">
        {selected && (
          <Button size="lg" className="gap-2" onClick={startRound}>
            {t('actions.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </ExerciseShell>
  )
}
