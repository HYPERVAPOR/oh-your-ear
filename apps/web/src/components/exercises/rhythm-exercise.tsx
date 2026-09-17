import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Music } from 'lucide-react'
import * as Tone from 'tone'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BPM = 100
const BEAT_DURATION = 60 / BPM
const PATTERN_LENGTH = 4
const TAP_TOLERANCE = 0.2

function generatePattern(): number[] {
  const pattern: number[] = []
  let remaining = PATTERN_LENGTH
  while (remaining > 0) {
    const choices = remaining >= 1 ? [1, 0.5] : [0.5]
    const dur = choices[Math.floor(Math.random() * choices.length)]
    pattern.push(dur)
    remaining -= dur
  }
  return pattern
}

function toTransportTime(quarterNotes: number): string {
  const sixteenths = Math.round(quarterNotes * 4)
  const bars = Math.floor(sixteenths / 16)
  const quarters = Math.floor((sixteenths % 16) / 4)
  const sixteenth = sixteenths % 4
  return `${bars}:${quarters}:${sixteenth}`
}

function getExpectedTimes(pattern: number[]): number[] {
  let cumulative = 0
  return pattern.map((dur) => {
    const time = cumulative * BEAT_DURATION
    cumulative += dur
    return time
  })
}

function countMatches(expected: number[], actual: number[], tolerance: number): number {
  const used = new Set<number>()
  let matched = 0
  for (const target of expected) {
    let bestIndex = -1
    let bestDiff = Infinity
    for (let i = 0; i < actual.length; i++) {
      if (used.has(i)) continue
      const diff = Math.abs(actual[i] - target)
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff
        bestIndex = i
      }
    }
    if (bestIndex !== -1) {
      used.add(bestIndex)
      matched++
    }
  }
  return matched
}

interface RhythmExerciseProps {
  onBack?: () => void
}

export function RhythmExercise({ onBack }: RhythmExerciseProps) {
  const { t } = useTranslation('common')
  const [pattern, setPattern] = useState(generatePattern)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'tapping' | 'result'>('idle')
  const [roundScore, setRoundScore] = useState(0)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const clickSynthRef = useRef<Tone.MembraneSynth | null>(null)
  const tapSynthRef = useRef<Tone.MembraneSynth | null>(null)
  const startTimeRef = useRef(0)
  const tapsRef = useRef<number[]>([])
  const patternEndRef = useRef<number | null>(null)

  const startRound = useCallback(() => {
    setPattern(generatePattern())
    tapsRef.current = []
    setRoundScore(0)
    setPhase('idle')
  }, [])

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

    const expected = getExpectedTimes(pattern)
    for (const time of expected) {
      Tone.Transport.scheduleOnce(
        (when) => {
          clickSynthRef.current?.triggerAttackRelease('C2', '32n', when)
        },
        toTransportTime(time / BEAT_DURATION),
      )
    }

    const endTime = PATTERN_LENGTH * BEAT_DURATION
    Tone.Transport.scheduleOnce(() => {
      Tone.Transport.stop()
      setPhase('tapping')
    }, toTransportTime(PATTERN_LENGTH))

    tapsRef.current = []
    setPhase('playing')
    startTimeRef.current = performance.now() / 1000
    Tone.Transport.start()

    // Safety fallback in case scheduled end callback is missed.
    patternEndRef.current = window.setTimeout(
      () => {
        setPhase((current) => (current === 'playing' ? 'tapping' : current))
      },
      endTime * 1000 + 500,
    )
  }, [pattern])

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
    const expected = getExpectedTimes(pattern)
    const matched = countMatches(expected, tapsRef.current, TAP_TOLERANCE)
    setRoundScore(matched)
    setScore((prev) => prev + matched)
    setTotal((prev) => prev + expected.length)
    setPhase('result')
  }, [pattern])

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
            <h1 className="text-lg font-semibold">{t('modules.rhythm')}</h1>
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
              {t('score', { correct: roundScore, total: getExpectedTimes(pattern).length })}
            </p>
          </div>
        )}

        {phase !== 'idle' && phase !== 'playing' && (
          <Button variant="secondary" onClick={startRound}>
            {t('actions.newRhythm')}
          </Button>
        )}
      </main>
    </div>
  )
}
