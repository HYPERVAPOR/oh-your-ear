import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Interval, Note } from 'tonal'

import { ExerciseShell, FeedbackNote, OptionTile } from '@/components/exercise-shell'
import { ConfigPanel, ToggleGroup } from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import { playSequence } from '@/lib/audio'
import {
  INTERVAL_OPTIONS,
  pickAllowedIntervalSemitones,
  useExerciseConfig,
} from '@/lib/exercise-config'
import { recordAnswer } from '@/lib/practice'

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
  const others = shuffle(pool.filter((ivl) => ivl !== correct)).slice(0, 3)
  return shuffle([correct, ...others])
}

function pickRoot(): string {
  return ROOT_POOL[Math.floor(Math.random() * ROOT_POOL.length)]
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

export function IntervalExercise({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('interval')
  const allowedSemitones = useMemo(() => pickAllowedIntervalSemitones(config), [config])
  const allowedIntervals = useMemo(() => config.intervals, [config.intervals])

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

    const right = guess === correctInterval
    if (right) setScore((prev) => prev + 1)

    recordAnswer({
      exercise: 'interval',
      correct: right,
      chosen: guess,
      expected: correctInterval,
      prompt: { root: round.root, second: round.second, interval: correctInterval },
    })
  }

  return (
    <ExerciseShell kind="interval" onBack={onBack} score={{ correct: score, total }}>
      <Button size="hero" className="mb-10" onClick={handlePlay}>
        {t('actions.play')}
      </Button>

      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
        {round.options.map((ivl) => (
          <OptionTile
            key={ivl}
            disabled={!!selected}
            onClick={() => handleGuess(ivl)}
            className="h-16 leading-tight"
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

      <div className="mt-6 flex min-h-[44px] items-center justify-center">
        {selected && (
          <FeedbackNote tone={isCorrect ? 'success' : 'error'}>
            {isCorrect
              ? t('feedback.correct')
              : t('feedback.wrong', { answer: t(`intervals.${correctInterval}`) })}
          </FeedbackNote>
        )}
      </div>

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
