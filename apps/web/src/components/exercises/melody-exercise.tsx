import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Note } from 'tonal'

import { Button } from '@/components/ui/button'
import { BooleanToggle, ConfigPanel, SliderField } from '@/components/exercises/config-panel'
import { playSequence } from '@/lib/audio'
import { useExerciseConfig } from '@/lib/exercise-config'
import { buildMelodyPool, makeMelodyQuestion, melodyGap, readMelodySeed } from '@/lib/melody'
import { recordAnswer } from '@/lib/practice'
import { cn, feedbackPill, optionHighlight } from '@/lib/utils'

interface MelodyExerciseProps {
  onBack?: () => void
}

/** Mini piano roll: pitch becomes height, order becomes left-to-right. */
function MelodyRoll({ notes }: { notes: string[] }) {
  // A repeated pitch is two bars, so identity is the pitch plus which time it occurs.
  const occurrences = new Map<string, number>()
  const bars = notes.map((note) => {
    const occurrence = occurrences.get(note) ?? 0
    occurrences.set(note, occurrence + 1)
    return { key: `${note}#${occurrence}`, midi: Note.midi(note) ?? 60 }
  })

  const midis = bars.map((bar) => bar.midi)
  const low = Math.min(...midis)
  const span = Math.max(Math.max(...midis) - low, 1)

  return (
    <svg viewBox={`0 0 ${bars.length * 10} 40`} className="h-10 w-full" aria-hidden="true">
      {bars.map((bar, position) => {
        const height = 8 + ((bar.midi - low) / span) * 24
        return (
          <rect
            key={bar.key}
            x={position * 10 + 1}
            y={34 - height}
            width={8}
            height={height}
            rx={1.5}
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function MelodyExercise({ onBack }: MelodyExerciseProps) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('melody')

  // A notebook entry hands over the exact melody it wants re-practised.
  const seed = readMelodySeed(useSearchParams()[0].get('melody'))
  const newQuestion = useCallback(
    (seeded?: string[]) => makeMelodyQuestion(config.length, buildMelodyPool(config), 4, seeded),
    [config],
  )

  const [question, setQuestion] = useState(() => newQuestion(seed))
  const [selected, setSelected] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const gap = melodyGap(config)
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
    setTotal((prev) => prev + 1)
    const right = index === question.answerIndex
    if (right) setScore((prev) => prev + 1)

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t('modules.melody')}</h1>
              <p className="text-xs text-muted-foreground">{t('exercises.randomTest')}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('score', { correct: score, total })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-6 text-center text-muted-foreground">{t('exercises.instructionMelody')}</p>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => playMelody(question.notes)} disabled={playing}>
            {playing ? t('actions.playing') : t('actions.play')}
          </Button>
          <Button variant="outline" onClick={() => playMelody(question.notes)} disabled={playing}>
            {t('actions.replay')}
          </Button>
        </div>

        {selected !== null && (
          <div
            className={cn(
              'mb-6 rounded-md px-4 py-2 text-center text-sm font-medium',
              feedbackPill(!!isCorrect),
            )}
          >
            {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer })}
          </div>
        )}

        <div className="grid w-full gap-3 sm:grid-cols-2">
          {question.options.map((option, index) => (
            <button
              key={option.join(' ')}
              type="button"
              disabled={selected !== null}
              onClick={() => handleGuess(index)}
              className={cn(
                'flex flex-col gap-2 rounded-md border border-border p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:hover:bg-background',
                selected !== null && index === question.answerIndex && optionHighlight('correct'),
                selected === index && !isCorrect && optionHighlight('wrong'),
              )}
            >
              <MelodyRoll notes={option} />
              <span className="text-sm font-medium tracking-wide">{option.join(' ')}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 w-full max-w-md">
          <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
            <div className="space-y-4">
              <SliderField
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

        {selected !== null && (
          <Button className="mt-8 gap-1" onClick={startRound}>
            {t('actions.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </main>
    </div>
  )
}
