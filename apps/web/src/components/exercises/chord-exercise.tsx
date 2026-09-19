import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Chord, Note } from 'tonal'

import { ExerciseShell, FeedbackNote, OptionTile } from '@/components/exercise-shell'
import { ConfigPanel, ToggleGroup } from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import { playChord } from '@/lib/audio'
import { CHORD_TYPES, useExerciseConfig } from '@/lib/exercise-config'
import { recordAnswer } from '@/lib/practice'
import { useActiveLevel, useLevelCatalog } from '@/lib/levels'
import { useRound, useRoundSize } from '@/lib/round'
import { RoundSummary } from '@/components/round-summary'

const ROOT_POOL = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4']

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
  const others = shuffle(pool.filter((type) => type !== correct)).slice(0, 3)
  return shuffle([correct, ...others])
}

/** Chord tones as note names. Sharps keep the spelling consistent with the other
 *  modules: F Ab Cb is theoretically right but reads worse than F G# B. */
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

export function ChordExercise({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('chord')
  const { data: catalog } = useLevelCatalog()
  const level = useActiveLevel(catalog ?? [], 'chord')
  const active = useMemo(() => ({ ...config, ...level?.config }), [config, level])
  const allowedTypes = useMemo(
    () => (active.types.length > 0 ? active.types : [...CHORD_TYPES]),
    [active.types],
  )

  const seed = readSeed(useSearchParams()[0])
  const urlRound = useRoundSize()
  const roundSize = level?.questions ?? urlRound
  const round = useRound(roundSize)
  const [question, setQuestion] = useState(() => seed ?? createRound(allowedTypes))
  const [options, setOptions] = useState(() =>
    pickOptions(seed?.type ?? question.type, allowedTypes),
  )
  const [selected, setSelected] = useState<string | null>(null)

  const { type, notes } = question
  const isCorrect = selected ? selected === type : null

  const startRound = useCallback(() => {
    const pool = active.types.length > 0 ? active.types : [...CHORD_TYPES]
    const next = createRound(pool)
    setQuestion(next)
    setOptions(pickOptions(next.type, pool))
    setSelected(null)
  }, [active.types])

  if (round.finished) {
    return (
      <RoundSummary
        kind="chord"
        level={level}
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

  function handleGuess(guess: string) {
    if (selected) return
    setSelected(guess)

    const right = guess === type
    round.record({
      question: notes.join(' '),
      chosen: t(`chords.${guess}`),
      expected: t(`chords.${type}`),
      correct: right,
    })

    recordAnswer({
      exercise: 'chord',
      correct: right,
      chosen: guess,
      expected: type,
      prompt: { root: question.root, notes, type },
    })
  }

  return (
    <ExerciseShell
      kind="chord"
      onBack={onBack}
      score={{ correct: round.correct, total: round.total }}
      progress={roundSize > 0 ? { done: round.total, size: roundSize } : undefined}
    >
      <Button size="hero" className="mb-10" onClick={() => playChord(notes)}>
        {t('actions.play')}
      </Button>

      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
        {options.map((chordType) => (
          <OptionTile
            key={chordType}
            disabled={!!selected}
            onClick={() => handleGuess(chordType)}
            className="h-16 leading-tight"
            state={
              selected && chordType === type
                ? 'correct'
                : selected === chordType && !isCorrect
                  ? 'wrong'
                  : 'idle'
            }
          >
            {t(`chords.${chordType}`)}
          </OptionTile>
        ))}
      </div>

      <div className="mt-6 flex min-h-[44px] items-center justify-center">
        {selected && (
          <FeedbackNote tone={isCorrect ? 'success' : 'error'}>
            {isCorrect
              ? t('feedback.correct')
              : t('feedback.wrong', { answer: t(`chords.${type}`) })}
          </FeedbackNote>
        )}
      </div>

      <div className="w-full">
        <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
          <ToggleGroup
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
