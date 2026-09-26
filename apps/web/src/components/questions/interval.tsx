import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Interval, Note } from 'tonal'

import { FeedbackSlot, OptionTile } from '@/components/exercise-shell'
import { ConfigPanel, ToggleGroup } from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import type { BodyProps } from '@/components/question'
import { playSequence } from '@/lib/audio'
import {
  INTERVAL_OPTIONS,
  pickAllowedIntervalSemitones,
  useExerciseConfig,
  type IntervalConfig,
} from '@/lib/exercise-config'
import { recordAnswer } from '@/lib/practice'
import { shuffle } from '@/lib/utils'

const ROOT_POOL = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']

function pickOptions(correct: string, allowed: string[]): string[] {
  const pool = allowed.length > 0 ? allowed : [...INTERVAL_OPTIONS]
  const others = shuffle(pool.filter((ivl) => ivl !== correct)).slice(0, 3)
  return shuffle([correct, ...others])
}

function pickSemitones(allowed: number[]): number {
  const pool = allowed.length > 0 ? allowed : [1]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Second note of the interval, spelled with sharps so the notebook and the other
 *  modules agree: Db5 and C#5 are the same key, and only one of them is used here. */
function computeSecond(root: string, semitones: number): string {
  const interval = Interval.fromSemitones(semitones)
  return Note.fromMidiSharps(Note.midi(Note.transpose(root, interval)) ?? 60)
}

export interface IntervalQuestion {
  kind: 'interval'
  root: string
  semitones: number
  second: string
  options: string[]
}

/** A notebook entry seeds the exact interval it wants re-practised. */
function readSeed(params?: URLSearchParams | null): { root: string; semitones: number } | null {
  const root = params?.get('root')
  const interval = params?.get('interval')
  if (!root || !interval) return null

  const semitones = Interval.get(interval)?.semitones
  if (semitones === undefined) return null
  return { root, semitones }
}

/** One draw for the whole question. Choosing the root, the interval and the options
 *  independently left the played pair and the option list out of step with the
 *  answer, which made the first question of a session unanswerable. */
export function makeIntervalQuestion(
  config: IntervalConfig,
  params?: URLSearchParams | null,
): IntervalQuestion {
  const allowedSemitones = pickAllowedIntervalSemitones(config)
  const seed = readSeed(params)
  const root = seed?.root ?? ROOT_POOL[Math.floor(Math.random() * ROOT_POOL.length)]
  const semitones = seed?.semitones ?? pickSemitones(allowedSemitones)

  return {
    kind: 'interval',
    root,
    semitones,
    second: computeSecond(root, semitones),
    options: pickOptions(Interval.fromSemitones(semitones), config.intervals),
  }
}

export function IntervalBody({ question, onAnswer }: BodyProps<IntervalQuestion>) {
  const { t } = useTranslation('common')
  const [selected, setSelected] = useState<string | null>(null)
  // Nothing is answerable before it has been heard once: choosing first is guessing,
  // and the tiles cannot tell you that they are only waiting for a first listen.
  const [heard, setHeard] = useState(false)

  const correctInterval = Interval.fromSemitones(question.semitones)
  const isCorrect = selected ? selected === correctInterval : null

  function handlePlay() {
    setHeard(true)
    playSequence([question.root, question.second])
  }

  function guess(interval: string) {
    if (selected) return
    setSelected(interval)

    const right = interval === correctInterval
    recordAnswer({
      exercise: 'interval',
      correct: right,
      chosen: interval,
      expected: correctInterval,
      prompt: { root: question.root, second: question.second, interval: correctInterval },
    })
    onAnswer({
      correct: right,
      question: `${question.root} → ${question.second}`,
      chosen: t(`intervals.${interval}`),
      expected: t(`intervals.${correctInterval}`),
    })
  }

  return (
    <>
      <Button size="hero" className="mb-10" onClick={handlePlay}>
        {t('actions.play')}
      </Button>

      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
        {question.options.map((ivl) => (
          <OptionTile
            key={ivl}
            disabled={!heard || !!selected}
            onClick={() => guess(ivl)}
            className={`h-16 leading-tight${heard ? '' : ' opacity-50'}`}
            state={
              selected && ivl === correctInterval
                ? 'correct'
                : selected === ivl && !isCorrect
                  ? 'wrong'
                  : 'idle'
            }
          >
            {t(`intervals.${ivl}`)}
          </OptionTile>
        ))}
      </div>

      <FeedbackSlot correct={selected ? isCorrect : null}>
        {isCorrect
          ? t('feedback.correct')
          : t('feedback.wrong', { answer: t(`intervals.${correctInterval}`) })}
      </FeedbackSlot>
    </>
  )
}

export function IntervalSettings() {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('interval')

  return (
    <div className="w-full">
      <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
        <ToggleGroup
          label={t('exerciseConfig.intervals')}
          options={INTERVAL_OPTIONS.map((ivl) => ({ value: ivl, label: t(`intervals.${ivl}`) }))}
          selected={config.intervals}
          onChange={(intervals) => updateConfig({ intervals })}
        />
      </ConfigPanel>
    </div>
  )
}
