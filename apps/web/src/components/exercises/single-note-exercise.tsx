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
import { useActiveLevel, useLevelCatalog } from '@/lib/levels'
import { useRound, useRoundSize } from '@/lib/round'
import { RoundSummary } from '@/components/round-summary'

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
  const { data: catalog } = useLevelCatalog()
  const level = useActiveLevel(catalog ?? [], 'singleNote')
  // A question-set level pins the scope; otherwise the user's own settings apply.
  const active = useMemo(() => ({ ...config, ...level?.config }), [config, level])
  const notePool = useMemo(() => buildSingleNotePool(active), [active])

  // A notebook entry seeds the exact question it wants re-practised.
  const seededNote = useSearchParams()[0].get('note')
  const urlRound = useRoundSize()
  const roundSize = level?.questions ?? urlRound
  const round = useRound(roundSize)
  const [question, setQuestion] = useState(() => createRound(seededNote, notePool))
  const [selected, setSelected] = useState<string | null>(null)
  // Nothing is answerable before it has been heard once: choosing first is guessing,
  // and the tiles cannot tell you that they are only waiting for a first listen.
  const [heard, setHeard] = useState(false)

  const isCorrect = selected ? Note.midi(selected) === Note.midi(question.target) : null

  const handleGuess = useCallback(
    (guess: string) => {
      if (selected) return
      setSelected(guess)

      const right = Note.midi(guess) === Note.midi(question.target)
      round.record({
        question: question.target,
        chosen: guess,
        expected: question.target,
        correct: right,
      })

      recordAnswer({
        exercise: 'singleNote',
        correct: right,
        chosen: guess,
        expected: question.target,
        prompt: { note: question.target },
      })
    },
    [selected, question.target, round],
  )

  const startRound = useCallback(() => {
    setQuestion(createRound(null, buildSingleNotePool(active)))
    setSelected(null)
    setHeard(false)
  }, [active])

  if (round.finished) {
    return (
      <RoundSummary
        kind="singleNote"
        level={level}
        entries={round.entries}
        durationMs={round.durationMs}
        onRestart={() => {
          round.restart()
          startRound()
        }}
        onBack={onBack}
      />
    )
  }

  return (
    <ExerciseShell
      kind="singleNote"
      level={level}
      onBack={onBack}
      score={{ correct: round.correct, total: round.total }}
      progress={roundSize > 0 ? { done: round.total, size: roundSize } : undefined}
    >
      <PlayButton
        note={question.target}
        label={t('actions.play')}
        className="mb-10"
        onPlay={() => setHeard(true)}
      />

      <div className="grid w-full grid-cols-4 gap-2.5">
        {question.options.map((note) => (
          <OptionTile
            key={note}
            disabled={!heard || !!selected}
            onClick={() => handleGuess(note)}
            className={`tabular h-16${heard ? '' : ' opacity-50'}`}
            state={
              selected && Note.midi(note) === Note.midi(question.target)
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
            {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer: question.target })}
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
