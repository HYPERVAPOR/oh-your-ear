import { useSearchParams } from 'react-router-dom'

import type { ExerciseKind } from '@/components/ui/orb'

/**
 * A level is a parameter set, not an abstract difficulty score. Every knob is one
 * the exercise already understands, which is what lets a level run through the
 * normal practice screen with its own settings instead of a parallel code path.
 */
export interface Level {
  /** Stable id, used by the API as the progress key. */
  id: string
  module: ExerciseKind
  /** Round size for this level. */
  questions: number
  /** Accuracy (0–1) needed to pass and unlock the next level. */
  passMark: number
  config: LevelConfig
}

/** The subset of exercise configuration a level may pin. */
export interface LevelConfig {
  /** single note, melody: which keys are in play. */
  whiteKeys?: boolean
  blackKeys?: boolean
  /** single note: pitch range preset. */
  range?: string
  /** interval: allowed interval ids. */
  intervals?: string[]
  /** chord: allowed chord type ids. */
  types?: string[]
  /** melody: length and playback speed. */
  length?: number
  speed?: string
  /** rhythm: pattern length and allowed durations. */
  patternLength?: number
  durations?: number[]
}

/** Everything the level chains share. */
const PASS_MARK = 0.8

const WHITE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
const ALL_INTERVALS = ['1P', '2m', '2M', '3m', '3M', '4P', '5P', '6m', '6M', '7m', '7M', '8P']
const TRIADS = ['major', 'minor', 'diminished', 'augmented']
const SEVENTHS = ['maj7', 'min7', '7']

/**
 * The five chains, easy to hard. Difficulty comes from widening the material and
 * from how much has to be told apart at once, not from a number.
 */
export const LEVELS: Level[] = [
  // Single note: five white keys, then the whole octave, then accidentals.
  {
    id: 'singleNote-1',
    module: 'singleNote',
    questions: 5,
    passMark: PASS_MARK,
    config: { whiteKeys: true, blackKeys: false, range: 'narrow' },
  },
  {
    id: 'singleNote-2',
    module: 'singleNote',
    questions: 10,
    passMark: PASS_MARK,
    config: { whiteKeys: true, blackKeys: false, range: 'medium' },
  },
  {
    id: 'singleNote-3',
    module: 'singleNote',
    questions: 10,
    passMark: PASS_MARK,
    config: { whiteKeys: true, blackKeys: true, range: 'medium' },
  },
  {
    id: 'singleNote-4',
    module: 'singleNote',
    questions: 10,
    passMark: PASS_MARK,
    config: { whiteKeys: true, blackKeys: true, range: 'wide' },
  },

  // Interval: size only, then quality, then the wide leaps.
  {
    id: 'interval-1',
    module: 'interval',
    questions: 5,
    passMark: PASS_MARK,
    config: { intervals: ['2m', '2M', '3m', '3M'] },
  },
  {
    id: 'interval-2',
    module: 'interval',
    questions: 8,
    passMark: PASS_MARK,
    config: { intervals: ['2m', '2M', '3m', '3M', '4P', '5P'] },
  },
  {
    id: 'interval-3',
    module: 'interval',
    questions: 10,
    passMark: PASS_MARK,
    config: { intervals: ['1P', '2m', '2M', '3m', '3M', '4P', '5P', '8P'] },
  },
  {
    id: 'interval-4',
    module: 'interval',
    questions: 10,
    passMark: PASS_MARK,
    config: { intervals: ALL_INTERVALS },
  },

  // Chord: triads, then sevenths, then everything.
  {
    id: 'chord-1',
    module: 'chord',
    questions: 5,
    passMark: PASS_MARK,
    config: { types: ['major', 'minor'] },
  },
  { id: 'chord-2', module: 'chord', questions: 8, passMark: PASS_MARK, config: { types: TRIADS } },
  {
    id: 'chord-3',
    module: 'chord',
    questions: 10,
    passMark: PASS_MARK,
    config: { types: [...TRIADS, 'maj7', 'min7'] },
  },
  {
    id: 'chord-4',
    module: 'chord',
    questions: 10,
    passMark: PASS_MARK,
    config: { types: [...TRIADS, ...SEVENTHS] },
  },

  // Melody: three notes, slower, then longer and faster.
  {
    id: 'melody-1',
    module: 'melody',
    questions: 5,
    passMark: PASS_MARK,
    config: { length: 3, speed: 'slow', whiteKeys: true, blackKeys: false, range: 'narrow' },
  },
  {
    id: 'melody-2',
    module: 'melody',
    questions: 8,
    passMark: PASS_MARK,
    config: { length: 4, speed: 'normal', whiteKeys: true, blackKeys: false, range: 'medium' },
  },
  {
    id: 'melody-3',
    module: 'melody',
    questions: 10,
    passMark: PASS_MARK,
    config: { length: 5, speed: 'normal', whiteKeys: true, blackKeys: true, range: 'medium' },
  },
  {
    id: 'melody-4',
    module: 'melody',
    questions: 10,
    passMark: PASS_MARK,
    config: { length: 6, speed: 'fast', whiteKeys: true, blackKeys: true, range: 'wide' },
  },

  // Rhythm: quarter notes only, then eighths, then longer patterns.
  {
    id: 'rhythm-1',
    module: 'rhythm',
    questions: 5,
    passMark: PASS_MARK,
    config: { patternLength: 3, durations: [1] },
  },
  {
    id: 'rhythm-2',
    module: 'rhythm',
    questions: 8,
    passMark: PASS_MARK,
    config: { patternLength: 4, durations: [1, 0.5] },
  },
  {
    id: 'rhythm-3',
    module: 'rhythm',
    questions: 10,
    passMark: PASS_MARK,
    config: { patternLength: 6, durations: [1, 0.5] },
  },
  {
    id: 'rhythm-4',
    module: 'rhythm',
    questions: 10,
    passMark: PASS_MARK,
    config: { patternLength: 8, durations: [1, 0.5] },
  },
]

/** The chain for one module, in play order. */
export function levelsFor(module: ExerciseKind): Level[] {
  return LEVELS.filter((level) => level.module === module)
}

export function findLevel(id: string | null): Level | undefined {
  if (!id) return undefined
  return LEVELS.find((level) => level.id === id)
}

/** What one user has done with one level, as the API reports it. */
export interface LevelProgressEntry {
  levelId: string
  passed: boolean
  bestAccuracy: number
}

/** The level to continue a chain with: the first one not passed yet. */
export function currentLevel(
  module: ExerciseKind,
  progress: Map<string, LevelProgressEntry>,
): Level | undefined {
  const chain = levelsFor(module)
  return chain.find((level) => !progress.get(level.id)?.passed) ?? chain[chain.length - 1]
}

/** True when every level of the chain is passed. */
export function chainComplete(
  module: ExerciseKind,
  progress: Map<string, LevelProgressEntry>,
): boolean {
  const chain = levelsFor(module)
  return chain.length > 0 && chain.every((level) => progress.get(level.id)?.passed)
}

/** The level after this one, or undefined at the end of a chain. */
export function nextLevel(id: string): Level | undefined {
  const level = findLevel(id)
  if (!level) return undefined
  const chain = levelsFor(level.module)
  return chain[chain.findIndex((item) => item.id === id) + 1]
}

/**
 * The level the current screen was opened with, if any. A level pins the exercise
 * configuration and the round size, which is what lets a question set run through
 * the normal practice screen.
 */
export function useActiveLevel(module: ExerciseKind): Level | undefined {
  const level = findLevel(useSearchParams()[0].get('level'))
  return level?.module === module ? level : undefined
}

export { WHITE }
