import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { frequencyOf, playNote } from '@/lib/keys'

/** The x axis: one octave from C4, in the order a keyboard is laid out rather than the
 *  order a scale is. The y axis is the pitch of each note, in Hz. */
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

/** A truncated axis, and labelled as one: 250–500Hz is what an octave from C4 spans, and
 *  starting at zero would waste the bottom half of the plot on nothing. The four rules
 *  land on round numbers — 300/350/400/450 — which is why the grid reads as a scale. */
const FLOOR = 250
const CEILING = 500
const TICKS = [300, 350, 400, 450]

const percent = (hz: number) => ((hz - FLOOR) / (CEILING - FLOOR)) * 100

/** The 2D take on the pitch chart: same data, drawn flat.
 *
 *  No 3D transform anywhere, which is the point of trying it — a hairline inside a 3D
 *  context gets rasterized into a texture and resampled, and comes back dotted (see the
 *  memory note). Flat, a 1px rule is exactly one pixel. Everything else is the house
 *  vocabulary: square corners, hairlines, a monospace readout for every value. */
export function PitchChart2D() {
  const { t } = useTranslation()
  const [played, setPlayed] = useState<string | null>(null)

  function play(note: (typeof NOTES)[number]) {
    playNote(frequencyOf(note.midi))
    setPlayed(note.name)
  }

  function onKeyDown(event: KeyboardEvent, note: (typeof NOTES)[number]) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    play(note)
  }

  return (
    <div
      role="group"
      aria-label={t('chart')}
      className="flex h-[240px] gap-3 font-display [--labels:20px] sm:h-[260px]"
    >
      {/* the y axis: values only, so the plot itself stays empty of text */}
      <div className="relative w-8 shrink-0">
        <span className="absolute right-0 top-0 text-[10px] uppercase tracking-[0.14em] text-muted-soft">
          Hz
        </span>
        <div className="absolute inset-x-0 bottom-[var(--labels)] top-4">
          {TICKS.map((hz) => (
            <span
              key={hz}
              className="tabular absolute right-0 -translate-y-1/2 pr-1 text-[10px] text-muted"
              style={{ bottom: `${percent(hz)}%` }}
            >
              {hz}
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex-1 border border-hairline-strong">
        <div className="absolute inset-x-0 bottom-[var(--labels)] top-0">
          {/* graph paper on the round numbers, and the y axis itself in ink */}
          {TICKS.map((hz) => (
            <span
              key={hz}
              className="absolute inset-x-0 h-px bg-hairline"
              style={{ bottom: `${percent(hz)}%` }}
            />
          ))}
          <span className="absolute inset-y-0 left-0 w-0.5 bg-ink" />
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" />

          <div className="grid h-full grid-cols-12">
            {NOTES.map((note) => {
              const hz = frequencyOf(note.midi)
              const isPlayed = played === note.name
              return (
                <button
                  key={note.name}
                  type="button"
                  aria-label={`${note.name}4 · ${hz.toFixed(1)} Hz`}
                  onPointerDown={() => play(note)}
                  onKeyDown={(event) => onKeyDown(event, note)}
                  className="relative cursor-pointer border-r border-hairline last:border-r-0 hover:bg-surface-strong/60"
                >
                  {/* Solid, not outlined: an outlined bar reads as an empty box at a glance,
                      and the whole point of the plot is the shape the fills draw. */}
                  <span
                    className={`absolute inset-x-0 bottom-0 mx-auto w-2.5 ${isPlayed ? 'bg-swatch-singleNote' : 'bg-ink'}`}
                    style={{ height: `${percent(hz)}%` }}
                  />
                  {/* the value sits on top of its own bar, the way a readout would */}
                  <span
                    className={`tabular absolute inset-x-0 -translate-y-full text-center text-[10px] leading-[1.2] ${isPlayed ? 'text-swatch-singleNote' : 'text-muted'}`}
                    style={{ bottom: `${percent(hz)}%` }}
                  >
                    {hz.toFixed(0)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* the x axis, aligned by the same seven columns as the bars */}
        <div className="absolute inset-x-0 bottom-0 grid h-[var(--labels)] grid-cols-12">
          {NOTES.map((note) => (
            <span
              key={note.name}
              className={`text-center text-[10px] uppercase leading-[var(--labels)] tracking-[0.04em] ${played === note.name ? 'text-swatch-singleNote' : 'text-ink'}`}
            >
              {note.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
