/** The piano roll's arithmetic, kept out of the component so it can be tested.
 *
 *  A bar is 4/4 in sixteenths, so sixteen steps, and the default phrase is two bars: the
 *  grid is thirty-two steps wide. The pitch axis is eighteen rows, C4 (midi 60) to F5 (77) —
 *  the six rows above B4 are what the phrase's top note needs. Notes are { step, length }
 *  in steps and never leave either wall. */

export const STEPS_PER_BAR = 16
export const STEPS = STEPS_PER_BAR * 2
export const LOW = 60
export const HIGH = 77

export interface Note {
  id: string
  midi: number
  step: number
  length: number
}

export type NoteInput = Omit<Note, 'id'>

/** What the roll opens on: two bars transcribed from a MIDI file of "Never Gonna Give You
 *  Up" (4/4, 96 ticks to the beat, so 24 ticks to a sixteenth) — the intro's figure, then
 *  the same figure left hanging on a held chord.
 *
 *  Two things had to give to put it on a sixteenth grid:
 *
 *  - **Register.** The source sits on C3–F4. Transposed up 12 semitones its lowest note
 *    lands on the roll's C4 and its highest on F5, six rows above the old ceiling — which
 *    is where the eighteen-row axis comes from. Intervals are untouched.
 *  - **The turn at the end of bar one.** Four notes across half a beat (32nds) cannot exist
 *    on a sixteenth grid, so the two that fall between steps are dropped: the descent reads
 *    F5 → D5 into the downbeat instead of F5 → Eb5 → D5 → C5.
 *
 *    step  0  Eb + Bb      step  8  D  + C    step 16  Eb + Bb   (bar two)
 *    step  3  F  + C       step 11  G  + D    step 19  F  + C
 *    step  6  C            step 14  F5        step 22  C  + F    held to the end
 *                          step 15  D5
 */
export const OPENING_PHRASE: NoteInput[] = [
  { midi: 63, step: 0, length: 3 },
  { midi: 70, step: 0, length: 3 },
  { midi: 65, step: 3, length: 5 },
  { midi: 72, step: 3, length: 5 },
  { midi: 60, step: 6, length: 2 },
  { midi: 62, step: 8, length: 3 },
  { midi: 72, step: 8, length: 3 },
  { midi: 67, step: 11, length: 3 },
  { midi: 74, step: 11, length: 3 },
  { midi: 77, step: 14, length: 1 },
  { midi: 74, step: 15, length: 1 },
  { midi: 63, step: 16, length: 3 },
  { midi: 70, step: 16, length: 3 },
  { midi: 65, step: 19, length: 3 },
  { midi: 72, step: 19, length: 3 },
  { midi: 60, step: 22, length: 10 },
  { midi: 65, step: 22, length: 10 },
]

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

/** Two bars of music, so a reader has something to hear the moment the page loads: a
 *  handful of events, some of them chords, lengths of a sixteenth to a beat, and the
 *  pitches leaning on the C major scale with the occasional accidental. */
export function randomPhrase(random: () => number = Math.random): NoteInput[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
  const scale = [0, 2, 4, 5, 7, 9, 11]
  const lengths = [1, 2, 2, 4]
  const notes: NoteInput[] = []
  const taken = new Set<string>()

  for (let step = 0; step < STEPS; step += 2) {
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

  // Never return an empty phrase: a random draw that muted every event would look broken.
  if (notes.length === 0) notes.push({ midi: 60, step: 0, length: 4 })
  return notes
}
