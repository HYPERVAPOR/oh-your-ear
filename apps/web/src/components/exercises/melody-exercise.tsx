import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Note } from 'tonal'

import { ExerciseShell, FeedbackNote, OptionTile } from '@/components/exercise-shell'
import {
  ConfigPanel,
  ConfigRow,
  NumberField,
  SelectField,
  Toggle,
} from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import { playSequence } from '@/lib/audio'
import { useExerciseConfig } from '@/lib/exercise-config'
import { buildMelodyPool, makeMelodyQuestion, melodyGap, readMelodySeed } from '@/lib/melody'
import { recordAnswer } from '@/lib/practice'
import { useRound, useRoundSize } from '@/lib/round'
import { RoundSummary } from '@/components/round-summary'

interface RollScale {
  low: number
  span: number
}

/** Shared pitch scale, so options are drawn on the same axis and their
 *  differences are visible instead of every card being stretched to fit. */
function rollScale(options: string[][]): RollScale {
  const midis = options.flat().map((note) => Note.midi(note) ?? 60)
  const low = Math.min(...midis)
  return { low, span: Math.max(Math.max(...midis) - low, 1) }
}

/** Mini piano roll: pitch becomes height, order becomes left-to-right. */
function MelodyRoll({ notes, scale }: { notes: string[]; scale: RollScale }) {
  // A repeated pitch is two bars, so identity is the pitch plus which time it occurs.
  const occurrences = new Map<string, number>()
  const bars = notes.map((note) => {
    const occurrence = occurrences.get(note) ?? 0
    occurrences.set(note, occurrence + 1)
    return { key: `${note}#${occurrence}`, midi: Note.midi(note) ?? 60 }
  })

  // One fixed slot per note: a longer melody is drawn wider, and the strip lines up
  // with the note names instead of floating in the middle of the card.
  const slot = 12

  return (
    <svg
      width={bars.length * slot}
      height={30}
      viewBox={`0 0 ${bars.length * slot} 40`}
      aria-hidden="true"
      className="opacity-55 transition-opacity group-hover:opacity-80"
    >
      {bars.map((bar, position) => {
        const height = 6 + ((bar.midi - scale.low) / scale.span) * 26
        return (
          <rect
            key={bar.key}
            x={position * slot + 1}
            y={34 - height}
            width={slot - 3}
            height={height}
            rx={1.5}
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}

export function MelodyExercise({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('melody')

  // A notebook entry hands over the exact melody it wants re-practised.
  const seed = readMelodySeed(useSearchParams()[0].get('melody'))
  const newQuestion = useCallback(
    (seeded?: string[]) => makeMelodyQuestion(config.length, buildMelodyPool(config), 4, seeded),
    [config],
  )

  const roundSize = useRoundSize()
  const round = useRound(roundSize)
  const [question, setQuestion] = useState(() => newQuestion(seed))
  const [selected, setSelected] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const gap = melodyGap(config)
  const scale = useMemo(() => rollScale(question.options), [question])
  const isCorrect = selected === null ? null : selected === question.answerIndex
  const answer = question.notes.join(' ')

  const playMelody = useCallback(
    async (notes: string[]) => {
      setPlaying(true)
      // Turns the per-note gap into the total duration of the phrase.
      await playSequence(notes, '8n', gap)
      setTimeout(() => setPlaying(false), notes.length * gap * 1000)
    },
    [gap],
  )

  function handleGuess(index: number) {
    if (selected !== null) return

    setSelected(index)
    const right = index === question.answerIndex
    round.record({
      question: answer,
      chosen: question.options[index].join(' '),
      expected: answer,
      correct: right,
    })

    recordAnswer({
      exercise: 'melody',
      correct: right,
      chosen: question.options[index].join(' '),
      expected: answer,
      prompt: { notes: question.notes, length: question.notes.length },
    })
  }

  function startRound() {
    setQuestion(newQuestion())
    setSelected(null)
  }

  if (round.finished) {
    return (
      <RoundSummary
        kind="melody"
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
      kind="melody"
      onBack={onBack}
      score={{ correct: round.correct, total: round.total }}
      progress={roundSize > 0 ? { done: round.total, size: roundSize } : undefined}
    >
      <div className="mb-10 flex items-center gap-2.5">
        <Button
          size="hero"
          onClick={() => playMelody(question.notes)}
          disabled={playing}
          className="gap-2"
        >
          {playing ? t('actions.playing') : t('actions.play')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => playMelody(question.notes)}
          disabled={playing}
        >
          {t('actions.replay')}
        </Button>
      </div>

      <div className="grid w-full gap-2.5 sm:grid-cols-2">
        {question.options.map((option, index) => (
          <OptionTile
            key={option.join(' ')}
            disabled={selected !== null}
            onClick={() => handleGuess(index)}
            className="group flex flex-col items-start gap-2.5 px-4 py-3.5 text-[15px] leading-none"
            state={
              selected !== null && index === question.answerIndex
                ? 'correct'
                : selected === index && !isCorrect
                  ? 'wrong'
                  : 'idle'
            }
          >
            <span className="tracking-[0.02em]">{option.join(' ')}</span>
            <MelodyRoll notes={option} scale={scale} />
          </OptionTile>
        ))}
      </div>

      <div className="mt-6 flex min-h-[44px] items-center justify-center">
        {selected !== null && (
          <FeedbackNote tone={isCorrect ? 'success' : 'error'}>
            {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer })}
          </FeedbackNote>
        )}
      </div>

      <div className="w-full">
        <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
          <NumberField
            label={t('exerciseConfig.melodyLength')}
            value={config.length}
            min={3}
            max={8}
            onChange={(length) => updateConfig({ length })}
          />
          <SelectField
            label={t('exerciseConfig.speed')}
            value={config.speed}
            onChange={(speed) => updateConfig({ speed })}
            options={[
              { value: 'slow', label: t('exerciseConfig.speedSlow') },
              { value: 'normal', label: t('exerciseConfig.speedNormal') },
              { value: 'fast', label: t('exerciseConfig.speedFast') },
            ]}
          />
          <SelectField
            label={t('exerciseConfig.range')}
            value={config.range}
            onChange={(range) => updateConfig({ range })}
            options={[
              { value: 'narrow', label: t('exerciseConfig.rangeNarrow') },
              { value: 'medium', label: t('exerciseConfig.rangeMedium') },
              { value: 'wide', label: t('exerciseConfig.rangeWide') },
            ]}
          />
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
        {selected !== null && (
          <Button size="lg" className="gap-2" onClick={startRound}>
            {t('actions.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </ExerciseShell>
  )
}
