import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Music } from 'lucide-react'
import * as Tone from 'tone'

import { ExerciseShell, FeedbackNote } from '@/components/exercise-shell'
import { ConfigPanel, NumberField, ToggleGroup } from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import { recordAnswer } from '@/lib/practice'
import { useRound, useRoundSize } from '@/lib/round'
import { RoundSummary } from '@/components/round-summary'
import { useExerciseConfig } from '@/lib/exercise-config'
import {
  BPM,
  TAP_TOLERANCE,
  countMatches,
  generatePattern,
  getExpectedTimes,
  toTransportTime,
} from '@/lib/rhythm'

interface RhythmExerciseProps {
  onBack?: () => void
}

export function RhythmExercise({ onBack }: RhythmExerciseProps) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('rhythm')
  const beatDuration = useMemo(() => 60 / BPM, [])
  const [pattern, setPattern] = useState(() =>
    generatePattern(config.patternLength, config.durations),
  )
  const [phase, setPhase] = useState<'idle' | 'playing' | 'tapping' | 'result'>('idle')
  const roundSize = useRoundSize()
  const round = useRound(roundSize)
  const [roundScore, setRoundScore] = useState(0)

  const clickSynthRef = useRef<Tone.MembraneSynth | null>(null)
  const tapSynthRef = useRef<Tone.MembraneSynth | null>(null)
  const startTimeRef = useRef(0)
  const tapsRef = useRef<number[]>([])
  const patternEndRef = useRef<number | null>(null)

  const durationOptions = useMemo(
    () => [
      { value: '1', label: t('exerciseConfig.quarterNote') },
      { value: '0.5', label: t('exerciseConfig.eighthNote') },
    ],
    [t],
  )

  const startRound = useCallback(() => {
    setPattern(generatePattern(config.patternLength, config.durations))
    tapsRef.current = []
    setRoundScore(0)
    setPhase('idle')
  }, [config])

  const handlePlay = useCallback(async () => {
    await Tone.start()

    if (!clickSynthRef.current) {
      clickSynthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      }).toDestination()
    }
    if (!tapSynthRef.current) {
      tapSynthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 3,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.08 },
      }).toDestination()
    }

    Tone.Transport.cancel()
    Tone.Transport.stop()
    Tone.Transport.position = 0
    Tone.Transport.bpm.value = BPM

    const expected = getExpectedTimes(pattern, beatDuration)
    for (const time of expected) {
      Tone.Transport.scheduleOnce(
        (when) => {
          clickSynthRef.current?.triggerAttackRelease('C2', '32n', when)
        },
        toTransportTime(time / beatDuration),
      )
    }

    Tone.Transport.scheduleOnce(() => {
      Tone.Transport.stop()
      setPhase('tapping')
    }, toTransportTime(config.patternLength))

    tapsRef.current = []
    setPhase('playing')
    startTimeRef.current = performance.now() / 1000
    Tone.Transport.start()

    patternEndRef.current = window.setTimeout(
      () => {
        setPhase((current) => (current === 'playing' ? 'tapping' : current))
      },
      config.patternLength * beatDuration * 1000 + 500,
    )
  }, [pattern, beatDuration, config.patternLength])

  const recordTap = useCallback(() => {
    if (phase !== 'tapping' && phase !== 'playing') return
    const now = performance.now() / 1000
    const relative = now - startTimeRef.current
    tapSynthRef.current?.triggerAttackRelease('G3', '32n')
    tapsRef.current = [...tapsRef.current, relative]
  }, [phase])

  const expectedCount = getExpectedTimes(pattern, beatDuration).length

  const handleFinish = useCallback(() => {
    if (patternEndRef.current) {
      clearTimeout(patternEndRef.current)
      patternEndRef.current = null
    }
    const expected = getExpectedTimes(pattern, beatDuration)
    const matched = countMatches(expected, tapsRef.current, TAP_TOLERANCE)
    setRoundScore(matched)
    setPhase('result')
    round.record({
      question: t('round.rhythmQuestion', { count: expected.length, bpm: BPM }),
      chosen: `${matched}/${expected.length}`,
      expected: `${expected.length}/${expected.length}`,
      correct: matched === expected.length,
    })
    // Rhythm is judged per round, not per answer: a round only counts when every
    // beat was hit.
    recordAnswer({
      exercise: 'rhythm',
      correct: matched === expected.length,
      chosen: `${matched}/${expected.length}`,
      prompt: { pattern, bpm: BPM },
    })
  }, [pattern, beatDuration, round, t])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'Space' && phase === 'tapping') {
        event.preventDefault()
        recordTap()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, recordTap])

  // The round's next question is this screen's "new rhythm".
  if (round.finished) {
    return (
      <RoundSummary
        kind="rhythm"
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
      kind="rhythm"
      onBack={onBack}
      score={{ correct: round.correct, total: round.total }}
      progress={roundSize > 0 ? { done: round.total, size: roundSize } : undefined}
    >
      <Button size="hero" className="mb-10" onClick={handlePlay} disabled={phase === 'playing'}>
        {phase === 'playing' ? t('actions.playing') : t('actions.play')}
      </Button>

      {/* The pad is always present so the interaction teaches itself and the page
          does not jump between phases; it only accepts taps while tapping. */}
      <div className="flex min-h-[232px] flex-col items-center justify-start gap-5">
        {phase !== 'result' && (
          <>
            <p className="text-[15px] text-body">
              {phase === 'tapping'
                ? t('exercises.tapHint')
                : phase === 'playing'
                  ? t('actions.playing')
                  : t('exercises.rhythmIdle')}
            </p>
            <button
              type="button"
              disabled={phase !== 'tapping'}
              onMouseDown={recordTap}
              aria-label={t('actions.tap')}
              className="flex h-36 w-36 items-center justify-center rounded-full bg-primary text-on-primary transition-all active:scale-95 disabled:bg-surface-strong disabled:text-muted-soft"
            >
              <Music className="h-12 w-12" />
            </button>
            {phase === 'playing' && (
              <p className="text-[13px] text-muted">{t('exercises.tapArmed')}</p>
            )}
            {phase === 'tapping' && (
              <Button variant="outline" onClick={handleFinish}>
                {t('actions.finish')}
              </Button>
            )}
          </>
        )}

        {phase === 'result' && (
          <>
            <FeedbackNote tone={roundScore === expectedCount ? 'success' : 'error'}>
              {t('score', { correct: roundScore, total: expectedCount })}
            </FeedbackNote>
            <Button size="lg" onClick={startRound}>
              {t('actions.newRhythm')}
            </Button>
          </>
        )}
      </div>

      <div className="mt-8 w-full">
        <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
          <NumberField
            label={t('exerciseConfig.patternLength')}
            value={config.patternLength}
            min={2}
            max={8}
            onChange={(patternLength) => updateConfig({ patternLength })}
          />
          <ToggleGroup
            label={t('exerciseConfig.durations')}
            options={durationOptions}
            selected={config.durations.map(String)}
            onChange={(selected) =>
              updateConfig({ durations: selected.map(Number).sort((a, b) => b - a) })
            }
          />
        </ConfigPanel>
      </div>
    </ExerciseShell>
  )
}
