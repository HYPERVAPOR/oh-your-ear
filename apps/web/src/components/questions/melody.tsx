import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note } from 'tonal'

import { FeedbackSlot, OptionTile } from '@/components/exercise-shell'
import {
  ConfigPanel,
  ConfigRow,
  NumberField,
  SelectField,
  Toggle,
} from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import type { BodyProps } from '@/components/question'
import { playSequence } from '@/lib/audio'
import { useExerciseConfig, type MelodyConfig } from '@/lib/exercise-config'
import {
  buildMelodyPool,
  makeMelodyQuestion as drawMelody,
  melodyGap,
  readMelodySeed,
} from '@/lib/melody'
import { recordAnswer } from '@/lib/practice'

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

export interface MelodyQuestion {
  kind: 'melody'
  notes: string[]
  options: string[][]
  answerIndex: number
  /** Seconds between two notes of the phrase: the body's own playback tempo. */
  gap: number
}

/** A notebook entry hands over the exact melody it wants re-practised. */
export function makeMelodyQuestion(
  config: MelodyConfig,
  params?: URLSearchParams | null,
): MelodyQuestion {
  const seed = readMelodySeed(params?.get('melody') ?? null)
  const drawn = drawMelody(config.length, buildMelodyPool(config), 4, seed)

  return { kind: 'melody', ...drawn, gap: melodyGap(config) }
}

export function MelodyBody({ question, onAnswer }: BodyProps<MelodyQuestion>) {
  const { t } = useTranslation('common')
  const [selected, setSelected] = useState<number | null>(null)
  // Nothing is answerable before it has been heard once: choosing first is guessing,
  // and the tiles cannot tell you that they are only waiting for a first listen.
  const [heard, setHeard] = useState(false)
  const [playing, setPlaying] = useState(false)

  const scale = useMemo(() => rollScale(question.options), [question])
  const isCorrect = selected === null ? null : selected === question.answerIndex
  const answer = question.notes.join(' ')

  const playMelody = useCallback(async () => {
    setHeard(true)
    setPlaying(true)
    // Turns the per-note gap into the total duration of the phrase.
    await playSequence(question.notes, '8n', question.gap)
    setTimeout(() => setPlaying(false), question.notes.length * question.gap * 1000)
  }, [question])

  function guess(index: number) {
    if (selected !== null) return
    setSelected(index)

    const right = index === question.answerIndex
    recordAnswer({
      exercise: 'melody',
      correct: right,
      chosen: question.options[index].join(' '),
      expected: answer,
      prompt: { notes: question.notes, length: question.notes.length },
    })
    onAnswer({
      correct: right,
      question: answer,
      chosen: question.options[index].join(' '),
      expected: answer,
    })
  }

  return (
    <>
      <Button size="hero" onClick={playMelody} disabled={playing} className="mb-10 gap-2">
        {playing ? t('actions.playing') : t('actions.play')}
      </Button>

      <div className="grid w-full gap-2.5 sm:grid-cols-2">
        {question.options.map((option, index) => (
          <OptionTile
            key={option.join(' ')}
            disabled={!heard || selected !== null}
            onClick={() => guess(index)}
            className={`group flex flex-col items-start gap-2.5 px-4 py-3.5 text-[15px] leading-none${heard ? '' : ' opacity-50'}`}
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

      <FeedbackSlot correct={isCorrect}>
        {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer })}
      </FeedbackSlot>
    </>
  )
}

export function MelodySettings() {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('melody')

  return (
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
  )
}
