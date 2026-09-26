import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { ExerciseShell } from '@/components/exercise-shell'
import { ModuleSettings, QuestionBody, makeQuestion, type AnswerEvent } from '@/components/question'
import { RoundSummary } from '@/components/round-summary'
import { Button } from '@/components/ui/button'
import { useActiveLevel, useLevelCatalog } from '@/lib/levels'
import { useRound, useRoundSize } from '@/lib/round'

export function IntervalExercise({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('common')
  const { data: catalog } = useLevelCatalog()
  const level = useActiveLevel(catalog ?? [], 'interval')
  const params = useSearchParams()[0]
  const urlRound = useRoundSize()
  const roundSize = level?.questions ?? urlRound
  const round = useRound(roundSize)

  // The question, whether it has been answered, and which question it is travel together:
  // moving on and clearing the answer are one state change, never two.
  const [step, setStep] = useState(() => ({
    index: 0,
    question: makeQuestion('interval', level?.config, params),
    answer: null as AnswerEvent | null,
  }))

  const next = useCallback(() => {
    // No seed: a notebook entry is replayed once, not on every question after it.
    setStep((prev) => ({
      index: prev.index + 1,
      question: makeQuestion('interval', level?.config),
      answer: null,
    }))
  }, [level?.config])

  if (round.finished) {
    return (
      <RoundSummary
        kind="interval"
        level={level}
        entries={round.entries}
        durationMs={round.durationMs}
        onRestart={() => {
          round.restart()
          next()
        }}
        onBack={onBack}
      />
    )
  }

  return (
    <ExerciseShell
      kind="interval"
      level={level}
      onBack={onBack}
      score={{ correct: round.correct, total: round.total }}
      progress={roundSize > 0 ? { done: round.total, size: roundSize } : undefined}
    >
      <QuestionBody
        key={step.index}
        question={step.question}
        onAnswer={(answer) => {
          setStep((prev) => ({ ...prev, answer }))
          round.record(answer)
        }}
      />

      <ModuleSettings kind="interval" />

      <div className="mt-8 flex min-h-[52px] items-center">
        {step.answer && (
          <Button size="lg" className="gap-2" onClick={next}>
            {t('actions.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </ExerciseShell>
  )
}
