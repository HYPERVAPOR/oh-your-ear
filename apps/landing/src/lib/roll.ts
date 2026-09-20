/** The piano roll's arithmetic, kept out of the component so it can be tested.
 *
 *  A bar is 4/4 in sixteenths, so sixteen steps; the pitch axis is the octave from C4
 *  (midi 60) to B4 (71). Notes are { step, length } in steps and never leave the bar. */

export const STEPS = 16
export const LOW = 60
export const HIGH = 71

export interface Note {
  id: string
  midi: number
  step: number
  length: number
}

export type NoteInput = Omit<Note, 'id'>

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** Drag the body: whole steps right, whole rows up, and never past either wall. */
export function moveNote(note: Note, steps: number, rows: number): Note {
  return {
    ...note,
    step: clamp(note.step + steps, 0, STEPS - note.length),
    midi: clamp(note.midi + rows, LOW, HIGH),
  }
}

/** Drag one edge. The far edge stays put, so a resize can never move the note's anchor —
 *  and a note never gets shorter than the one step that a sixteenth is. */
export function resizeNote(note: Note, edge: 'start' | 'end', steps: number): Note {
  if (edge === 'end') {
    return { ...note, length: clamp(note.length + steps, 1, STEPS - note.step) }
  }
  const step = clamp(note.step + steps, 0, note.step + note.length - 1)
  return { ...note, step, length: note.step + note.length - step }
}

/** Ableton's rule, and the reason a roll never looks like a pile: two notes on the same
 *  pitch cannot overlap. The later one wins and cuts the earlier one at its own start; an
 *  earlier note that is swallowed whole disappears. Different pitches are free to overlap —
 *  that is what a chord is.
 *
 *  `priority` is the note the reader is holding. It wins in both directions: the note
 *  before it is cut, the note after it is pushed along, and nothing is lost silently
 *  unless there is no room left in the bar. */
export function normalize(notes: Note[], priority?: string): Note[] {
  const result: Note[] = []
  for (const midi of new Set(notes.map((note) => note.midi))) {
    const row = notes
      .filter((note) => note.midi === midi)
      .sort((a, b) => a.step - b.step || a.length - b.length)
    const kept: Note[] = []
    for (const note of row) {
      const last = kept[kept.length - 1]
      if (!last || last.step + last.length <= note.step) {
        kept.push(note)
        continue
      }
      if (last.id === priority) {
        // what was moved outranks what was already there: push the neighbour along
        const step = last.step + last.length
        if (step < STEPS) kept.push({ ...note, step, length: Math.min(note.length, STEPS - step) })
        continue
      }
      // otherwise the later note cuts the earlier one, at the later note's own start
      const length = note.step - last.step
      if (length > 0) kept[kept.length - 1] = { ...last, length }
      else kept.pop()
      kept.push(note)
    }
    result.push(...kept)
  }
  return result.sort((a, b) => a.step - b.step || a.midi - b.midi)
}

/** One bar of music, so a reader has something to hear the moment the page loads: a
 *  handful of events, some of them chords, lengths of a sixteenth to a beat, and the
 *  pitches leaning on the C major scale with the occasional accidental. */
export function randomBar(random: () => number = Math.random): NoteInput[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
  const scale = [0, 2, 4, 5, 7, 9, 11]
  const lengths = [1, 2, 2, 4]
  const notes: NoteInput[] = []
  const taken = new Set<string>()

  for (const step of [0, 2, 4, 6, 8, 10, 12, 14]) {
    if (random() < 0.25) continue
    const root = pick(scale) + (random() < 0.85 ? 0 : 1)
    const voices = random() < 0.3 ? (random() < 0.5 ? 2 : 3) : 1
    const length = pick(lengths)
    for (let voice = 0; voice < voices; voice += 1) {
      const midi = clamp(LOW + ((root + voice * 4) % 12), LOW, HIGH)
      const key = `${step}:${midi}`
      if (taken.has(key)) continue
      taken.add(key)
      notes.push({ midi, step, length: Math.min(length, STEPS - step) })
    }
  }

  // Never return an empty bar: a random draw that muted every event would look broken.
  if (notes.length === 0) notes.push({ midi: 60, step: 0, length: 4 })
  return notes
}
