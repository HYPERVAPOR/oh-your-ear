import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { apiClient } from '@/api/client'
import type { components } from '@/api/schema'
import { ExerciseShell } from '@/components/exercise-shell'
import { QuestionBody, makeQuestion, type AnswerEvent } from '@/components/question'
import { RoundSummary } from '@/components/round-summary'
import { Button } from '@/components/ui/button'
import { MODULES, type ExerciseKind } from '@/components/ui/orb'
import { dailyPlan, sessionSize } from '@/lib/daily'
import { useRound } from '@/lib/round'

type StudyPlan = components['schemas']['StudyPlan']

/** The modules this plan practises, or all of them when it does not narrow it down. */
function focusOf(plan: StudyPlan): ExerciseKind[] {
  const focus = plan.focusExercises as ExerciseKind[]
  return focus.length > 0 ? focus : MODULES
}

/**
 * The day's practice as one sitting (PRD 5.0.1): the questions today still owes, spread
 * over the plan's focus modules and asked in one run rather than one module per visit.
 *
 * The server has no part in the order — questions are drawn in the browser like every
 * other screen — and each answer is reported as it lands, so the day's own count is what
 * says how far along this is. Leaving and coming back therefore resumes where it was,
 * with nothing stored about the session itself.
 */
export function Daily() {
  const navigate = useNavigate()
  const { data: plan, isPending } = useQuery({
    queryKey: ['study-plan'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/plan')
      return data
    },
  })

  if (isPending || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-44 animate-pulse bg-surface-strong" />
      </div>
    )
  }

  return <DailySession plan={plan} onBack={() => navigate('/')} />
}

/**
 * Split from the fetch so the day's size is read once, on the way in: the plan query keeps
 * refetching as answers land, and a session that shrank while it was being taken would
 * never reach its end.
 */
function DailySession({ plan, onBack }: { plan: StudyPlan; onBack: () => void }) {
  const { t } = useTranslation('common')
  const goal = plan.dailyGoal
  const doneAtStart = plan.today.solved

  const [queue, setQueue] = useState(() => dailyPlan(focusOf(plan), sessionSize(goal, doneAtStart)))
  const [step, setStep] = useState(() => ({
    index: 0,
    question: makeQuestion(queue[0] ?? 'singleNote'),
    answer: null as AnswerEvent | null,
  }))
  const round = useRound(queue.length)

  const next = useCallback(() => {
    setStep((prev) => ({
      index: prev.index + 1,
      question: makeQuestion(queue[prev.index + 1] ?? queue[0] ?? 'singleNote'),
      answer: null,
    }))
  }, [queue])

  const restart = useCallback(() => {
    const fresh = dailyPlan(focusOf(plan), sessionSize(goal, plan.today.solved))
    setQueue(fresh)
    setStep({ index: 0, question: makeQuestion(fresh[0] ?? 'singleNote'), answer: null })
    round.restart()
  }, [plan, goal, round])

  const kind = step.question.kind

  if (round.finished) {
    return (
      <RoundSummary
        kind={kind}
        title={t('daily.title')}
        label=""
        entries={round.entries}
        durationMs={round.durationMs}
        onRestart={restart}
        onBack={onBack}
      />
    )
  }

  return (
    <ExerciseShell
      kind={kind}
      title={t('daily.title')}
      // Which module is being asked, beside the heading: it changes from question to
      // question, and the reader should not have to infer it from the options.
      label={t(`modules.${kind}`)}
      onBack={onBack}
      score={{ correct: round.correct, total: round.total }}
      // The day's own progress, not this sitting's: it ends where the goal is. Capped,
      // because an extra round after the goal is met would otherwise read "17 / 3".
      progress={{ done: Math.min(doneAtStart + round.total, goal), size: goal }}
    >
      <QuestionBody
        key={step.index}
        question={step.question}
        onAnswer={(answer) => {
          setStep((prev) => ({ ...prev, answer }))
          round.record(answer)
        }}
      />

      {/* No settings here, for the same reason a question set has none: this is the day's
          work, and the place to change how hard the questions are is random practice. The
          module's own settings are what draws them; they are just not editable mid-sitting. */}

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
