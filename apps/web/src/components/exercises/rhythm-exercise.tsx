import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Music } from 'lucide-react'
import * as Tone from 'tone'

import { Button } from '@/components/ui/button'
import { CheckboxGroup, ConfigPanel, SliderField } from '@/components/exercises/config-panel'
import { cn } from '@/lib/utils'
import { recordAnswer } from '@/lib/practice'
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
  const [roundScore, setRoundScore] = useState(0)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

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

  const handleFinish = useCallback(() => {
    if (patternEndRef.current) {
      clearTimeout(patternEndRef.current)
      patternEndRef.current = null
    }
    const expected = getExpectedTimes(pattern, beatDuration)
    const matched = countMatches(expected, tapsRef.current, TAP_TOLERANCE)
    setRoundScore(matched)
    setScore((prev) => prev + matched)
    setTotal((prev) => prev + expected.length)
    setPhase('result')
    // Rhythm is judged per round, not per answer: a round only counts when every
    // beat was hit.
    recordAnswer({
      exercise: 'rhythm',
      correct: matched === expected.length,
      chosen: `${matched}/${expected.length}`,
    })
  }, [pattern, beatDuration])

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t('modules.rhythm')}</h1>
              <p className="text-xs text-muted-foreground">{t('exercises.randomTest')}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('score', { correct: score, total })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-8 text-center text-muted-foreground">{t('exercises.instructionRhythm')}</p>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={handlePlay} disabled={phase === 'playing'}>
            {phase === 'playing' ? t('actions.playing') : t('actions.play')}
          </Button>
          <Button
            variant="outline"
            onClick={handleFinish}
            disabled={phase !== 'tapping' && phase !== 'playing'}
          >
            {t('actions.finish')}
          </Button>
        </div>

        {phase === 'tapping' && (
          <div className="mb-8 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">{t('exercises.tapHint')}</p>
            <button
              type="button"
              onMouseDown={recordTap}
              className={cn(
                'flex h-40 w-40 items-center justify-center rounded-full border-4 border-primary',
                'bg-primary/10 text-primary shadow-lg transition-transform active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              aria-label={t('actions.tap')}
            >
              <Music className="h-16 w-16" />
            </button>
          </div>
        )}

        {phase === 'result' && (
          <div className="mb-8 rounded-md bg-muted px-6 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {t('score', {
                correct: roundScore,
                total: getExpectedTimes(pattern, beatDuration).length,
              })}
            </p>
          </div>
        )}

        {phase !== 'idle' && phase !== 'playing' && (
          <Button variant="secondary" onClick={startRound}>
            {t('actions.newRhythm')}
          </Button>
        )}

        <div className="mt-8 w-full max-w-md">
          <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
            <div className="space-y-4">
              <SliderField
                label={t('exerciseConfig.patternLength')}
                value={config.patternLength}
                min={2}
                max={8}
                onChange={(patternLength) => updateConfig({ patternLength })}
              />
              <CheckboxGroup
                label={t('exerciseConfig.durations')}
                options={durationOptions}
                selected={config.durations.map(String)}
                onChange={(selected) =>
                  updateConfig({ durations: selected.map(Number).sort((a, b) => b - a) })
                }
              />
            </div>
          </ConfigPanel>
        </div>
      </main>
    </div>
  )
}
