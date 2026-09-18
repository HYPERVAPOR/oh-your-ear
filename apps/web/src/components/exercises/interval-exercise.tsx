import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Interval, Note } from 'tonal'

import { Button } from '@/components/ui/button'
import { playSequence } from '@/lib/audio'
import { CheckboxGroup, ConfigPanel } from '@/components/exercises/config-panel'
import { cn, feedbackPill, optionHighlight } from '@/lib/utils'
import { recordAnswer } from '@/lib/practice'
import {
  INTERVAL_OPTIONS,
  pickAllowedIntervalSemitones,
  useExerciseConfig,
} from '@/lib/exercise-config'

const ROOT_POOL = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']

function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickOptions(correct: string, allowed: string[]): string[] {
  const pool = allowed.length > 0 ? allowed : [...INTERVAL_OPTIONS]
  const others = pool.filter((ivl) => ivl !== correct)
  const picked = shuffle(others).slice(0, 3)
  return shuffle([correct, ...picked])
}

interface IntervalExerciseProps {
  onBack?: () => void
}

export function IntervalExercise({ onBack }: IntervalExerciseProps) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('interval')
  const allowedSemitones = useMemo(() => pickAllowedIntervalSemitones(config), [config])
  const allowedIntervals = useMemo(
    () => config.intervals.filter((ivl) => config.intervals.includes(ivl)),
    [config.intervals],
  )
  // A notebook entry seeds the exact question it wants re-practised.
  const seed = readSeed(useSearchParams()[0])
  const [round, setRound] = useState(() => createRound(seed, allowedSemitones, allowedIntervals))
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const correctInterval = Interval.fromSemitones(round.semitones)
  const isCorrect = selected ? selected === correctInterval : null

  const startRound = useCallback(() => {
    setRound(createRound(null, pickAllowedIntervalSemitones(config), config.intervals))
    setSelected(null)
  }, [config])

  function handlePlay() {
    playSequence([round.root, round.second])
  }

  function handleGuess(guess: string) {
    if (selected) return
    setSelected(guess)
    setTotal((prev) => prev + 1)
    const isRight = guess === correctInterval
    if (isRight) {
      setScore((prev) => prev + 1)
    }
    recordAnswer({
      exercise: 'interval',
      correct: isRight,
      chosen: guess,
      expected: correctInterval,
      prompt: { root: round.root, second: round.second, interval: correctInterval },
    })
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
              <h1 className="text-lg font-semibold">{t('modules.interval')}</h1>
              <p className="text-xs text-muted-foreground">{t('exercises.randomTest')}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('score', { correct: score, total })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-6 text-center text-muted-foreground">{t('moduleHints.interval')}</p>

        <div className="mb-8">
          <Button onClick={handlePlay}>{t('actions.play')}</Button>
        </div>

        {selected && (
          <div
            className={cn(
              'mb-6 rounded-md px-4 py-2 text-center text-sm font-medium',
              feedbackPill(isCorrect),
            )}
          >
            {isCorrect
              ? t('feedback.correct')
              : t('feedback.wrong', { answer: t(`intervals.${correctInterval}`) })}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {round.options.map((ivl) => (
            <Button
              key={ivl}
              variant="outline"
              disabled={!!selected}
              onClick={() => handleGuess(ivl)}
              className={cn(
                'h-14 text-base leading-tight',
                selected && ivl === correctInterval && optionHighlight('correct'),
                selected === ivl && !isCorrect && optionHighlight('wrong'),
              )}
            >
              {t(`intervals.${ivl}`)}
            </Button>
          ))}
        </div>

        <div className="mt-8 w-full max-w-md">
          <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
            <CheckboxGroup
              label={t('exerciseConfig.intervals')}
              options={INTERVAL_OPTIONS.map((ivl) => ({
                value: ivl,
                label: t(`intervals.${ivl}`),
              }))}
              selected={config.intervals}
              onChange={(intervals) => updateConfig({ intervals })}
            />
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

interface IntervalRound {
  root: string
  semitones: number
  second: string
  options: string[]
}

/** One draw for the whole round. Choosing the root, the interval and the options
 *  independently left the played pair and the option list out of step with the
 *  answer, which made the first question of a session unanswerable. */
function createRound(
  seed: { root: string; semitones: number } | null,
  allowedSemitones: number[],
  allowedIntervals: string[],
): IntervalRound {
  const root = seed?.root ?? pickRoot()
  const semitones = seed?.semitones ?? pickSemitones(allowedSemitones)

  return {
    root,
    semitones,
    second: computeSecond(root, semitones),
    options: pickOptions(Interval.fromSemitones(semitones), allowedIntervals),
  }
}

function readSeed(params: URLSearchParams): { root: string; semitones: number } | null {
  const root = params.get('root')
  const interval = params.get('interval')
  if (!root || !interval) return null
  const semitones = Interval.get(interval)?.semitones
  if (semitones === undefined) return null
  return { root, semitones }
}

function pickRoot(): string {
  return ROOT_POOL[Math.floor(Math.random() * ROOT_POOL.length)]
}

function pickSemitones(allowed: number[]): number {
  const pool = allowed.length > 0 ? allowed : [1]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Second note of the interval. Spelled with sharps so the notebook and the other
 * modules agree: Db5 and C#5 are the same key, and only one of them is used here. */
function computeSecond(root: string, semitones: number): string {
  const interval = Interval.fromSemitones(semitones)
  return Note.fromMidiSharps(Note.midi(Note.transpose(root, interval)) ?? 60)
}
