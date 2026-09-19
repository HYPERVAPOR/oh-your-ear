import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** One answered question, kept for the summary's review list. */
export interface RoundEntry {
  question: string
  chosen: string
  expected: string
  correct: boolean
  /** When the answer landed, so elapsed time is measured to the last answer. */
  at: number
}

export interface RoundState {
  entries: RoundEntry[]
  correct: number
  total: number
  /** A round is only finite when a size was given; practice mode is endless. */
  finished: boolean
  durationMs: number
  record: (entry: Omit<RoundEntry, 'at'>) => void
  restart: () => void
}

/**
 * Counts the questions of one round. `size` of 0 means the endless practice mode,
 * where nothing is ever "finished".
 */
export function useRound(size: number): RoundState {
  const [entries, setEntries] = useState<RoundEntry[]>([])
  const [startedAt, setStartedAt] = useState(() => Date.now())

  const record = useCallback(
    (entry: Omit<RoundEntry, 'at'>) => {
      setEntries((prev) =>
        size > 0 && prev.length >= size ? prev : [...prev, { ...entry, at: Date.now() }],
      )
    },
    [size],
  )

  const restart = useCallback(() => {
    setEntries([])
    setStartedAt(Date.now())
  }, [])

  const total = entries.length
  const correct = entries.filter((entry) => entry.correct).length
  const last = entries[entries.length - 1]

  return {
    entries,
    correct,
    total,
    finished: size > 0 && total >= size,
    durationMs: last ? last.at - startedAt : 0,
    record,
    restart,
  }
}

/**
 * Round size from the URL: `?round=10` runs a fixed round, anything else is the
 * endless practice mode. A question set supplies it through the same parameter.
 */
export function useRoundSize(): number {
  const raw = useSearchParams()[0].get('round')
  const size = Number(raw)

  if (!Number.isInteger(size) || size < 1 || size > 50) return 0
  return size
}
