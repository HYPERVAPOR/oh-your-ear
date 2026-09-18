import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Chord, Note } from 'tonal'

import { Button } from '@/components/ui/button'
import { playChord } from '@/lib/audio'
import { CheckboxGroup, ConfigPanel } from '@/components/exercises/config-panel'
import { cn, feedbackPill, optionHighlight } from '@/lib/utils'
import { recordAnswer } from '@/lib/practice'
import { CHORD_TYPES, useExerciseConfig } from '@/lib/exercise-config'

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
  const pool = allowed.length > 0 ? allowed : [...CHORD_TYPES]
  const others = pool.filter((type) => type !== correct)
  const picked = shuffle(others).slice(0, 3)
  return shuffle([correct, ...picked])
}

interface ChordExerciseProps {
  onBack?: () => void
}

export function ChordExercise({ onBack }: ChordExerciseProps) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('chord')
  const allowedTypes = useMemo(
    () => (config.types.length > 0 ? config.types : [...CHORD_TYPES]),
    [config.types],
  )
  // A notebook entry seeds the exact question it wants re-practised.
  const seed = readSeed(useSearchParams()[0])
  const [round, setRound] = useState(() => seed ?? createRound(allowedTypes))
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  const { type, notes } = round
  const isCorrect = selected ? selected === type : null

  const startRound = useCallback(() => {
    const pool = config.types.length > 0 ? config.types : [...CHORD_TYPES]
    setRound(createRound(pool))
    setSelected(null)
  }, [config.types])

  function handlePlay() {
    playChord(notes)
  }

  function handleGuess(guess: string) {
    if (selected) return
    setSelected(guess)
    setTotal((prev) => prev + 1)
    const isRight = guess === type
    if (isRight) {
      setScore((prev) => prev + 1)
    }
    recordAnswer({
      exercise: 'chord',
      correct: isRight,
      chosen: guess,
      expected: type,
      prompt: { root: round.root, notes, type },
    })
  }

  const currentOptions = selected
    ? pickOptions(type, allowedTypes)
    : pickOptions(type, allowedTypes)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t('modules.chord')}</h1>
              <p className="text-xs text-muted-foreground">{t('exercises.randomTest')}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('score', { correct: score, total })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-6 text-center text-muted-foreground">{t('moduleHints.chord')}</p>

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
              : t('feedback.wrong', { answer: t(`chords.${type}`) })}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {currentOptions.map((chordType) => (
            <Button
              key={chordType}
              variant="outline"
              disabled={!!selected}
              onClick={() => handleGuess(chordType)}
              className={cn(
                'h-14 text-base leading-tight',
                selected && chordType === type && optionHighlight('correct'),
                selected === chordType && !isCorrect && optionHighlight('wrong'),
              )}
            >
              {t(`chords.${chordType}`)}
            </Button>
          ))}
        </div>

        <div className="mt-8 w-full max-w-md">
          <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
            <CheckboxGroup
              label={t('exerciseConfig.chordTypes')}
              options={CHORD_TYPES.map((chordType) => ({
                value: chordType,
                label: t(`chords.${chordType}`),
              }))}
              selected={config.types}
              onChange={(types) => updateConfig({ types })}
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

/** Chord tones as note names. Sharps keep the spelling consistent with the other
 * modules: F Ab Cb is theoretically right but reads worse than F G# B. */
function chordNotes(root: string, type: string): string[] {
  return Chord.get(type)
    .intervals.map((interval) => Note.transpose(root, interval))
    .map((note) => Note.fromMidiSharps(Note.midi(note) ?? 60))
}

function readSeed(params: URLSearchParams): { root: string; type: string; notes: string[] } | null {
  const root = params.get('root')
  const type = params.get('type')
  if (!root || !type || !CHORD_TYPES.includes(type as (typeof CHORD_TYPES)[number])) return null
  return { root, type, notes: chordNotes(root, type) }
}

function createRound(allowedTypes: string[]) {
  const pool = allowedTypes.length > 0 ? allowedTypes : [...CHORD_TYPES]
  const root = ROOT_POOL[Math.floor(Math.random() * ROOT_POOL.length)]
  const type = pool[Math.floor(Math.random() * pool.length)]
  return { root, type, notes: chordNotes(root, type) }
}
