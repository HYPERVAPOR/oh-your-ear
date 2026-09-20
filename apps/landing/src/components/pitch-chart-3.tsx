import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { frequencyOf, playNote } from '@/lib/keys'

/** Low to high: the rows of the roll, and the order the runs are played in. */
const NOTES = [
  { name: 'C', midi: 60 },
  { name: 'C#', midi: 61 },
  { name: 'D', midi: 62 },
  { name: 'D#', midi: 63 },
  { name: 'E', midi: 64 },
  { name: 'F', midi: 65 },
  { name: 'F#', midi: 66 },
  { name: 'G', midi: 67 },
  { name: 'G#', midi: 68 },
  { name: 'A', midi: 69 },
  { name: 'A#', midi: 70 },
  { name: 'B', midi: 71 },
]

const STEPS = NOTES.length
/** The five rows whose key is black — the rows a roll shades, and the keys a keyboard
 *  shortens. */
const BLACK = new Set(['C#', 'D#', 'F#', 'G#', 'A#'])
const ROW = 100 / STEPS
const STEP = 100 / STEPS

/** Piano roll: pitch as rows, the octave as one chromatic run.
 *
 *  The data has no time axis, so the run is the honest way in — one note per step, low to
 *  high, which draws the scale as the diagonal a roll always shows for a rising figure.
 *  Clicking a clip plays it. Still flat: no 3D transform, so the hairlines stay hairlines. */
export function PitchChart3() {
  const { t } = useTranslation()
  const [played, setPlayed] = useState<number | null>(null)

  function play(note: (typeof NOTES)[number], index: number) {
    playNote(frequencyOf(note.midi))
    setPlayed(index)
  }

  function onKeyDown(event: KeyboardEvent, note: (typeof NOTES)[number], index: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    play(note, index)
  }

  return (
    <div
      role="group"
      aria-label={t('chart')}
      className="flex h-[240px] font-display [--keys:44px] sm:h-[260px] sm:[--keys:56px]"
    >
      {/* the keyboard: white rows with a stub of black key at the low end, and one label
          where a DAW puts it */}
      <div className="relative w-[var(--keys)] shrink-0 border border-r-0 border-hairline-strong">
        {NOTES.map((note, index) => (
          <div
            key={note.name}
            className={`absolute inset-x-0 border-t border-hairline first:border-t-0 ${BLACK.has(note.name) ? 'bg-surface-strong' : 'bg-surface'}`}
            style={{ bottom: `${index * ROW}%`, height: `${ROW}%` }}
          >
            {BLACK.has(note.name) && <span className="block h-full w-[55%] bg-ink" />}
            {note.name === 'C' && (
              <span className="tabular absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted">
                C4
              </span>
            )}
          </div>
        ))}
      </div>

      {/* the roll */}
      <div className="relative flex-1 border border-hairline-strong">
        {/* shaded rows = black keys, the way every roll draws them */}
        {NOTES.map((note, index) =>
          BLACK.has(note.name) ? (
            <span
              key={`row${note.name}`}
              className="absolute inset-x-0 bg-surface-strong/60"
              style={{ bottom: `${index * ROW}%`, height: `${ROW}%` }}
            />
          ) : null,
        )}

        {/* row rules, a step line per column, and a heavier line every four steps */}
        {NOTES.map((note, index) => (
          <span
            key={`h${note.name}`}
            className="absolute inset-x-0 h-px bg-hairline"
            style={{ bottom: `${index * ROW}%` }}
          />
        ))}
        {NOTES.map((note, index) =>
          index % 4 === 0 ? (
            <span
              key={`b${note.name}`}
              className="absolute inset-y-0 w-px bg-hairline-strong"
              style={{ left: `${index * STEP}%` }}
            />
          ) : (
            <span
              key={`s${note.name}`}
              className="absolute inset-y-0 w-px bg-hairline/70"
              style={{ left: `${index * STEP}%` }}
            />
          ),
        )}

        {/* one clip per semitone: row = pitch, column = order in the run */}
        {NOTES.map((note, index) => {
          const isPlayed = played === index
          return (
            <button
              key={note.name}
              type="button"
              aria-label={`${note.name}4 · ${frequencyOf(note.midi).toFixed(1)} Hz`}
              onPointerDown={() => play(note, index)}
              onKeyDown={(event) => onKeyDown(event, note, index)}
              className={`absolute cursor-pointer border text-[9px] leading-none ${isPlayed ? 'border-swatch-singleNote bg-swatch-singleNote text-on-primary' : 'border-ink bg-ink text-on-primary hover:opacity-88'}`}
              style={{
                left: `calc(${index * STEP}% + 1px)`,
                bottom: `calc(${index * ROW}% + 1px)`,
                width: `calc(${STEP}% - 3px)`,
                height: `calc(${ROW}% - 3px)`,
              }}
            >
              {note.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
