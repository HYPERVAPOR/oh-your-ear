import { Note } from 'tonal'

import { buildRangePool, type MelodyConfig } from '@/lib/exercise-config'

/** The notes a melody may use, honouring the range and the key filters. */
export function buildMelodyPool(config: MelodyConfig): string[] {
  return buildRangePool(config.range, config.whiteKeys, config.blackKeys)
}

/** Melody questions: one melody is played, several variants are offered. */
export interface MelodyQuestion {
  notes: string[]
  options: string[][]
  answerIndex: number
}

/** Playback gap per note, in seconds. */
export const MELODY_SPEEDS: Record<string, number> = {
  slow: 0.7,
  normal: 0.45,
  fast: 0.28,
}

/** Playback speed for this config, in seconds between notes. */
export function melodyGap(config: MelodyConfig): number {
  return MELODY_SPEEDS[config.speed] ?? MELODY_SPEEDS.normal
}

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

function randomMelody(length: number, pool: string[]): string[] {
  return Array.from({ length }, () => pick(pool))
}

/**
 * Variant of a melody with one or two notes swapped, so the difference is
 * audible but not trivially rejectable.
 */
function mutate(melody: string[], pool: string[]): string[] {
  const variant = [...melody]
  const changes = 1 + Math.floor(Math.random() * 2)

  for (let i = 0; i < changes; i++) {
    const position = Math.floor(Math.random() * variant.length)
    let replacement = pick(pool)
    let guard = 0
    while (replacement === variant[position] && guard++ < 20) {
      replacement = pick(pool)
    }
    variant[position] = replacement
  }

  return variant
}

function fingerprint(melody: string[]): string {
  return melody.join(' ')
}

/**
 * Builds a question: the correct melody plus variants that each differ from it
 * by one or two notes, de-duplicated and shuffled.
 */
export function makeMelodyQuestion(
  length: number,
  pool: string[],
  optionCount = 4,
  seed?: string[],
): MelodyQuestion {
  const correct = seed && seed.length > 0 ? [...seed] : randomMelody(length, pool)
  const seen = new Set([fingerprint(correct)])
  const options: string[][] = [correct]

  let guard = 0
  while (options.length < optionCount && guard++ < 100) {
    const variant = mutate(correct, pool)
    const key = fingerprint(variant)
    if (seen.has(key)) continue
    seen.add(key)
    options.push(variant)
  }

  const answerIndex = Math.floor(Math.random() * options.length)
  ;[options[0], options[answerIndex]] = [options[answerIndex], options[0]]

  return { notes: correct, options, answerIndex }
}

/** Reads a melody handed over by the mistake notebook, e.g. `?melody=C4,E4,G4`. */
export function readMelodySeed(value: string | null): string[] | undefined {
  if (!value) return undefined

  const notes = value
    .split(',')
    .map((note) => note.trim())
    .filter((note) => Note.midi(note) !== null)

  return notes.length > 0 ? notes : undefined
}
