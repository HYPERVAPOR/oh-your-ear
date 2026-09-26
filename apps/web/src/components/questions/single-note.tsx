import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note } from 'tonal'

import { FeedbackSlot, OptionTile } from '@/components/exercise-shell'
import { ConfigPanel, ConfigRow, Toggle } from '@/components/exercises/config-panel'
import { PlayButton } from '@/components/play-button'
import type { BodyProps } from '@/components/question'
import {
  buildSingleNotePool,
  useExerciseConfig,
  type SingleNoteConfig,
} from '@/lib/exercise-config'
import { recordAnswer } from '@/lib/practice'
import { shuffle } from '@/lib/utils'

export interface SingleNoteQuestion {
  kind: 'singleNote'
  target: string
  options: string[]
}

/** One draw for the whole question: picking the target and the options separately could
 *  leave the target out of its own option list. */
export function makeSingleNoteQuestion(
  config: SingleNoteConfig,
  params?: URLSearchParams | null,
): SingleNoteQuestion {
  const pool = buildSingleNotePool(config)
  // A notebook entry seeds the exact question it wants re-practised.
  const target = params?.get('note') ?? pool[Math.floor(Math.random() * pool.length)]
  const distractors = shuffle(pool.filter((note) => note !== target)).slice(0, 7)

  return { kind: 'singleNote', target, options: shuffle([target, ...distractors]) }
}

export function SingleNoteBody({ question, onAnswer }: BodyProps<SingleNoteQuestion>) {
  const { t } = useTranslation('common')
  const [selected, setSelected] = useState<string | null>(null)
  // Nothing is answerable before it has been heard once: choosing first is guessing,
  // and the tiles cannot tell you that they are only waiting for a first listen.
  const [heard, setHeard] = useState(false)

  const isCorrect = selected ? Note.midi(selected) === Note.midi(question.target) : null

  function guess(note: string) {
    if (selected) return
    setSelected(note)

    const right = Note.midi(note) === Note.midi(question.target)
    recordAnswer({
      exercise: 'singleNote',
      correct: right,
      chosen: note,
      expected: question.target,
      prompt: { note: question.target },
    })
    onAnswer({ correct: right, question: question.target, chosen: note, expected: question.target })
  }

  return (
    <>
      <PlayButton
        note={question.target}
        label={t('actions.play')}
        className="mb-10"
        onPlay={() => setHeard(true)}
      />

      <div className="grid w-full grid-cols-4 gap-2.5">
        {question.options.map((note) => (
          <OptionTile
            key={note}
            disabled={!heard || !!selected}
            onClick={() => guess(note)}
            className={`tabular h-16${heard ? '' : ' opacity-50'}`}
            state={
              selected && Note.midi(note) === Note.midi(question.target)
                ? 'correct'
                : selected === note && !isCorrect
                  ? 'wrong'
                  : 'idle'
            }
          >
            {note}
          </OptionTile>
        ))}
      </div>

      <FeedbackSlot correct={selected ? isCorrect : null}>
        {isCorrect ? t('feedback.correct') : t('feedback.wrong', { answer: question.target })}
      </FeedbackSlot>
    </>
  )
}

export function SingleNoteSettings() {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('singleNote')

  return (
    <div className="w-full">
      <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
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
