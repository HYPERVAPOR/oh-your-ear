import type { ReactNode } from 'react'

import {
  ChordBody,
  ChordSettings,
  makeChordQuestion,
  type ChordQuestion,
} from '@/components/questions/chord'
import {
  IntervalBody,
  IntervalSettings,
  makeIntervalQuestion,
  type IntervalQuestion,
} from '@/components/questions/interval'
import {
  MelodyBody,
  MelodySettings,
  makeMelodyQuestion,
  type MelodyQuestion,
} from '@/components/questions/melody'
import {
  RhythmBody,
  RhythmSettings,
  makeRhythmQuestion,
  type RhythmQuestion,
} from '@/components/questions/rhythm'
import {
  SingleNoteBody,
  SingleNoteSettings,
  makeSingleNoteQuestion,
  type SingleNoteQuestion,
} from '@/components/questions/single-note'
import type { ExerciseKind } from '@/components/ui/orb'
import { readExerciseConfig } from '@/lib/exercise-config'
import type { LevelConfig } from '@/lib/levels'

/**
 * One question, whichever module it came from. Every question carries what its body needs
 * to play it and judge it, so a screen that mixes modules needs nothing else — which is
 * what lets the daily session hand over from a note to an interval to a chord without
 * knowing what any of them are.
 */
export type Question =
  SingleNoteQuestion | IntervalQuestion | ChordQuestion | MelodyQuestion | RhythmQuestion

/**
 * What a body reports once the reader has committed to an answer. The three strings are
 * for the round's review list; the answer itself has already been reported by the body,
 * which is the only place that knows the module's own record shape.
 */
export interface AnswerEvent {
  correct: boolean
  question: string
  chosen: string
  expected: string
}

export interface BodyProps<Q> {
  question: Q
  onAnswer: (answer: AnswerEvent) => void
}

/**
 * One question for a module, with the reader's own settings unless a question set pins
 * them. The settings are read from storage at this moment rather than held in state: a
 * panel that writes them and a question drawn from them cannot drift apart, and a screen
 * that mixes modules has no single config to hold.
 */
export function makeQuestion(
  kind: ExerciseKind,
  level?: LevelConfig,
  params?: URLSearchParams | null,
): Question {
  switch (kind) {
    case 'singleNote':
      return makeSingleNoteQuestion({ ...readExerciseConfig('singleNote'), ...level }, params)
    case 'interval':
      return makeIntervalQuestion({ ...readExerciseConfig('interval'), ...level }, params)
    case 'chord':
      return makeChordQuestion({ ...readExerciseConfig('chord'), ...level }, params)
    case 'melody':
      return makeMelodyQuestion({ ...readExerciseConfig('melody'), ...level }, params)
    case 'rhythm':
      return makeRhythmQuestion({ ...readExerciseConfig('rhythm'), ...level })
  }
}

/** The body of one question, dispatched to its module. */
export function QuestionBody({
  question,
  onAnswer,
}: {
  question: Question
  onAnswer: (answer: AnswerEvent) => void
}): ReactNode {
  switch (question.kind) {
    case 'singleNote':
      return <SingleNoteBody question={question} onAnswer={onAnswer} />
    case 'interval':
      return <IntervalBody question={question} onAnswer={onAnswer} />
    case 'chord':
      return <ChordBody question={question} onAnswer={onAnswer} />
    case 'melody':
      return <MelodyBody question={question} onAnswer={onAnswer} />
    case 'rhythm':
      return <RhythmBody question={question} onAnswer={onAnswer} />
  }
}

/**
 * The current module's settings. The whole component is remounted when the module
 * changes (its caller keys it), because a hook cannot take a module that changes from
 * question to question.
 */
export function ModuleSettings({ kind }: { kind: ExerciseKind }): ReactNode {
  switch (kind) {
    case 'singleNote':
      return <SingleNoteSettings />
    case 'interval':
      return <IntervalSettings />
    case 'chord':
      return <ChordSettings />
    case 'melody':
      return <MelodySettings />
    case 'rhythm':
      return <RhythmSettings />
  }
}
