import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chord, Note } from 'tonal'

import { FeedbackSlot, OptionTile } from '@/components/exercise-shell'
import { ConfigPanel, ToggleGroup } from '@/components/exercises/config-panel'
import { Button } from '@/components/ui/button'
import type { BodyProps } from '@/components/question'
import { playChord } from '@/lib/audio'
import { CHORD_TYPES, useExerciseConfig, type ChordConfig } from '@/lib/exercise-config'
import { recordAnswer } from '@/lib/practice'
import { shuffle } from '@/lib/utils'

const ROOT_POOL = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4']

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

export interface ChordQuestion {
  kind: 'chord'
  root: string
  type: string
  notes: string[]
  options: string[]
}

/** A notebook entry seeds the exact chord it wants re-practised. */
function readSeed(
  params?: URLSearchParams | null,
): { root: string; type: string; notes: string[] } | null {
  const root = params?.get('root')
  const type = params?.get('type')
  if (!root || !type || !CHORD_TYPES.includes(type as (typeof CHORD_TYPES)[number])) return null
  return { root, type, notes: chordNotes(root, type) }
}

export function makeChordQuestion(
  config: ChordConfig,
  params?: URLSearchParams | null,
): ChordQuestion {
  const pool = config.types.length > 0 ? config.types : [...CHORD_TYPES]
  const seed = readSeed(params)
  const root = seed?.root ?? ROOT_POOL[Math.floor(Math.random() * ROOT_POOL.length)]
  const type = seed?.type ?? pool[Math.floor(Math.random() * pool.length)]

  return {
    kind: 'chord',
    root,
    type,
    notes: chordNotes(root, type),
    options: pickOptions(type, pool),
  }
}

export function ChordBody({ question, onAnswer }: BodyProps<ChordQuestion>) {
  const { t } = useTranslation('common')
  const [selected, setSelected] = useState<string | null>(null)
  // Nothing is answerable before it has been heard once: choosing first is guessing,
  // and the tiles cannot tell you that they are only waiting for a first listen.
  const [heard, setHeard] = useState(false)

  const { type, notes } = question
  const isCorrect = selected ? selected === type : null

  function guess(chordType: string) {
    if (selected) return
    setSelected(chordType)

    const right = chordType === type
    recordAnswer({
      exercise: 'chord',
      correct: right,
      chosen: chordType,
      expected: type,
      prompt: { root: question.root, notes, type },
    })
    onAnswer({
      correct: right,
      question: notes.join(' '),
      chosen: t(`chords.${chordType}`),
      expected: t(`chords.${type}`),
    })
  }

  return (
    <>
      <Button
        size="hero"
        className="mb-10"
        onClick={() => {
          setHeard(true)
          playChord(notes)
        }}
      >
        {t('actions.play')}
      </Button>

      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
        {question.options.map((chordType) => (
          <OptionTile
            key={chordType}
            disabled={!heard || !!selected}
            onClick={() => guess(chordType)}
            className={`h-16 leading-tight${heard ? '' : ' opacity-50'}`}
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

      <FeedbackSlot correct={selected ? isCorrect : null}>
        {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer: t(`chords.${type}`) })}
      </FeedbackSlot>
    </>
  )
}

export function ChordSettings() {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('chord')

  return (
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
  )
}
