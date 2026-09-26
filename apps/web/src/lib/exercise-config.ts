import { useCallback, useState } from 'react'
import { Interval, Note } from 'tonal'

export type ExerciseType = 'singleNote' | 'interval' | 'chord' | 'melody' | 'rhythm'

export const SINGLE_NOTE_WHITE_KEYS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
export const SINGLE_NOTE_BLACK_KEYS = ['C#4', 'D#4', 'F#4', 'G#4', 'A#4']

export const INTERVAL_OPTIONS = [
  '1P',
  '2m',
  '2M',
  '3m',
  '3M',
  '4P',
  '5P',
  '6m',
  '6M',
  '7m',
  '7M',
  '8P',
] as const

export const CHORD_TYPES = [
  'major',
  'minor',
  'diminished',
  'augmented',
  'maj7',
  'min7',
  '7',
] as const

export interface SingleNoteConfig {
  whiteKeys: boolean
  blackKeys: boolean
  /** Pitch range preset: narrow / medium / wide (see RANGES). */
  range: string
}

/** Pitch ranges, as the lowest and highest note a level may use. */
export const RANGES: Record<string, [string, string]> = {
  narrow: ['C4', 'B4'],
  medium: ['C4', 'C5'],
  wide: ['C3', 'C5'],
}

const FALLBACK_POOL = ['C4', 'D4', 'E4', 'F4', 'G4']

/**
 * The notes an exercise may draw from: every semitone of the range that survives
 * the white/black filter, spelled with sharps like the option labels are.
 */
export function buildRangePool(range: string, whiteKeys: boolean, blackKeys: boolean): string[] {
  const [from, to] = RANGES[range] ?? RANGES.medium
  const low = Note.midi(from)
  const high = Note.midi(to)
  if (low === null || high === null) return [...FALLBACK_POOL]

  const notes: string[] = []
  for (let midi = low; midi <= high; midi++) {
    const name = Note.fromMidiSharps(midi)
    const black = name.includes('#')
    if (black ? blackKeys : whiteKeys) notes.push(name)
  }

  return notes.length > 0 ? notes : [...FALLBACK_POOL]
}

export interface IntervalConfig {
  intervals: string[]
}

export interface ChordConfig {
  types: string[]
}

export interface MelodyConfig {
  length: number
  whiteKeys: boolean
  blackKeys: boolean
  /** Playback speed preset (see MELODY_SPEEDS). */
  speed: string
  /** Pitch range preset: narrow / medium / wide. */
  range: string
}

export interface RhythmConfig {
  patternLength: number
  durations: number[]
}

export interface ExerciseConfigMap {
  singleNote: SingleNoteConfig
  interval: IntervalConfig
  chord: ChordConfig
  melody: MelodyConfig
  rhythm: RhythmConfig
}

export const defaultConfigs: ExerciseConfigMap = {
  singleNote: { whiteKeys: true, blackKeys: true, range: 'medium' },
  interval: { intervals: [...INTERVAL_OPTIONS] },
  chord: { types: [...CHORD_TYPES] },
  melody: { length: 5, whiteKeys: true, blackKeys: true, speed: 'normal', range: 'medium' },
  rhythm: { patternLength: 4, durations: [1, 0.5] },
}

function storageKey(type: ExerciseType) {
  return `oye:config:${type}`
}

/**
 * What the reader has set for one module, read from storage.
 *
 * A screen that draws questions reads this instead of holding the config in state: the
 * settings panel writes to storage, so the next question picks up an edit either way, and
 * a screen that mixes modules has no single config to hold.
 */
export function readExerciseConfig<T extends ExerciseType>(type: T): ExerciseConfigMap[T] {
  try {
    const raw = localStorage.getItem(storageKey(type))
    if (raw) {
      const parsed = JSON.parse(raw) as ExerciseConfigMap[T]
      return { ...defaultConfigs[type], ...parsed }
    }
  } catch {
    // ignore corrupt storage
  }
  return { ...defaultConfigs[type] }
}

function writeConfig<T extends ExerciseType>(type: T, config: ExerciseConfigMap[T]) {
  try {
    localStorage.setItem(storageKey(type), JSON.stringify(config))
  } catch {
    // ignore storage errors
  }
}

export function useExerciseConfig<T extends ExerciseType>(type: T) {
  const [config, setConfig] = useState<ExerciseConfigMap[T]>(() => readExerciseConfig(type))

  const updateConfig = useCallback(
    (patch: Partial<ExerciseConfigMap[T]>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch } as ExerciseConfigMap[T]
        writeConfig(type, next)
        return next
      })
    },
    [type],
  )

  const resetConfig = useCallback(() => {
    const next = { ...defaultConfigs[type] }
    writeConfig(type, next)
    setConfig(next)
  }, [type])

  return { config, updateConfig, resetConfig }
}

export function buildSingleNotePool(config: SingleNoteConfig): string[] {
  return buildRangePool(config.range, config.whiteKeys, config.blackKeys)
}

export function pickAllowedIntervalSemitones(config: IntervalConfig): number[] {
  const semitones = config.intervals
    .map((ivl) => Interval.semitones(ivl))
    .filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 12)
  return semitones.length > 0 ? semitones : [1]
}

export function pickAllowedChordType(config: ChordConfig): string {
  const types = config.types.length > 0 ? config.types : [...CHORD_TYPES]
  return types[Math.floor(Math.random() * types.length)]
}
