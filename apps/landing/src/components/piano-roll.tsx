import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Dices, Play, RotateCcwSquare, Square } from 'lucide-react'

import { audioMeter, audioNow, createBus, frequencyOf, playNote } from '@/lib/keys'
import { bars, drawMeter } from '@/lib/meter'
import {
  HIGH,
  LOW,
  OPENING_PHRASE,
  STEPS,
  STEPS_PER_BAR,
  moveNote,
  normalize,
  randomPhrase,
  resizeNote,
  type Note,
  type NoteInput,
} from '@/lib/roll'

/** The rows of the roll, low to high. The five black keys get the shaded rows. */
const ROWS = Array.from({ length: HIGH - LOW + 1 }, (_, index) => LOW + index)
const BLACK = new Set([1, 3, 6, 8, 10])
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Midi 60 is C4, so the octave is one less than the twelves in the number. Spelled out
 *  rather than assumed: the axis reaches F5, and a hard-coded "4" would mislabel it. */
const labelOf = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

const ROW_PCT = 100 / ROWS.length
const STEP_PCT = 100 / STEPS
const MIN_STEP = 1
/** The tempo the phrase is written at, and one sixteenth of a bar at that tempo. A step at
 *  80bpm lasts 0.188s: quick enough that the phrase sounds like music instead of a
 *  demonstration, slow enough to follow one block across the grid. */
const BPM = 80
const SIXTEENTH = 60 / BPM / 4
const PHRASE = STEPS * SIXTEENTH
/** How long the meter keeps drawing after the sound stops, in frames. Its bar count is not
 *  fixed: it is one bar per ~4px of whatever width the row gives it. */
const METER_TAIL = 40

let nextId = 0
const withIds = (notes: NoteInput[]): Note[] =>
  notes.map((note) => ({ ...note, id: `n${nextId++}` }))

type Edge = 'move' | 'start' | 'end'
interface Drag {
  id: string
  edge: Edge
  from: { x: number; y: number }
  steps: number
  rows: number
  /** The pitch last auditioned, so crossing rows plays each one once. */
  heard: number
}

/** Write a note's geometry onto its element. Used for the drag preview and again on
 *  release: React only writes the style keys whose values it saw change, so after a drag
 *  that ends where it started the element would keep whatever the preview left there. */
function place(element: HTMLElement | null, note: { step: number; length: number; midi: number }) {
  if (!element) return
  element.style.left = `${note.step * STEP_PCT}%`
  element.style.width = `${note.length * STEP_PCT}%`
  element.style.bottom = `${(note.midi - LOW) * ROW_PCT}%`
}

/** A one-bar piano roll you can edit, edited the way a DAW's is.
 *
 *  Pointer rules follow Ableton: a click selects and nothing else, a double click writes a
 *  note (or removes one), dragging the body moves it, dragging an edge changes its length.
 *  Everything snaps to the grid — and the preview during a drag is the *snapped* position,
 *  because a ghost that floats freely under the pointer is prettier and useless.
 *
 *  Nothing enters React state while the pointer is down: the drag moves the one element
 *  that is being dragged and commits on release, so a fast pointer cannot outrun the
 *  renderer. */
export function PianoRoll() {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<Note[]>(() => normalize(withIds(OPENING_PHRASE)))
  const [selected, setSelected] = useState<string | null>(null)
  const roll = useRef<HTMLDivElement | null>(null)
  const drag = useRef<Drag | null>(null)
  const head = useRef<HTMLSpanElement | null>(null)
  const frame = useRef(0)
  /** The bus the current bar is playing through, so Stop can drop it. */
  const bus = useRef<GainNode | null>(null)
  const [playing, setPlaying] = useState(false)
  const meter = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(0)
  const quiet = useRef(0)

  const play = (midi: number) => {
    playNote(frequencyOf(midi))
    wake()
  }

  /** Draw the output while there is output to draw, then stop. Nothing loops at rest: the
   *  meter is woken by a note and puts itself out a beat after the sound does. */
  function wake() {
    if (drawing.current) return
    const canvas = meter.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ink = getComputedStyle(canvas).color
    let data: Uint8Array | null = null
    // a fresh run starts quiet: the counter means "frames since the sound stopped", and
    // carrying the last run's total over would end this one on its first silent frame
    quiet.current = 0
    const tick = () => {
      const analyser = audioMeter()
      if (analyser) {
        data ??= new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        // a bar of about 3px at whatever width the row hands out, plus the 1px gap
        const count = Math.max(12, Math.round(canvas.clientWidth / 4))
        drawMeter(context, canvas, bars(data, count), ink, window.devicePixelRatio || 1)
      }
      quiet.current = (data?.some((value) => value > 12) ?? false) ? 0 : quiet.current + 1
      if (quiet.current > METER_TAIL) {
        drawing.current = 0
        return
      }
      drawing.current = requestAnimationFrame(tick)
    }
    drawing.current = requestAnimationFrame(tick)
  }

  /** Commit an edit through the overlap rule. `priority` is whatever the reader just
   *  touched: it wins against its neighbours instead of being trimmed by them. */
  function commit(next: Note[], priority?: string) {
    setNotes(normalize(next, priority))
  }

  /** Play the bar: every note scheduled on the audio clock up front, and one short
   *  requestAnimationFrame loop to move the playhead. Nothing runs after the bar ends. */
  function togglePlay() {
    wake()
    if (playing) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      // Dropping the bus is what makes Stop a stop: the notes of the bar are already on
      // the audio clock, so nothing short of disconnecting them silences them.
      bus.current?.disconnect()
      bus.current = null
      setPlaying(false)
      return
    }
    const start = (audioNow() ?? 0) + 0.06
    const through = createBus()
    bus.current = through
    for (const note of notes) {
      playNote(frequencyOf(note.midi), start + note.step * SIXTEENTH, through)
    }
    setPlaying(true)
    const tick = () => {
      const now = audioNow()
      const line = head.current
      if (!line || now === null) return
      const progress = (now - start) / PHRASE
      if (progress >= 1) {
        line.style.left = '0%'
        line.style.opacity = '0'
        frame.current = 0
        setPlaying(false)
        return
      }
      line.style.left = `${progress * 100}%`
      line.style.opacity = '1'
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  /** Cell size in px, read per gesture — the layout can change under a long drag. */
  function cell(): { w: number; h: number } | null {
    const box = roll.current?.getBoundingClientRect()
    return box ? { w: box.width / STEPS, h: box.height / ROWS.length } : null
  }

  function noteElement(id: string): HTMLElement | null {
    return roll.current?.querySelector<HTMLElement>(`[data-note="${id}"]`) ?? null
  }

  function startDrag(event: PointerEvent, note: Note, edge: Edge) {
    event.stopPropagation()
    drag.current = {
      id: note.id,
      edge,
      from: { x: event.clientX, y: event.clientY },
      steps: 0,
      rows: 0,
      heard: note.midi,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelected(note.id)
  }

  function onPointerMove(event: PointerEvent) {
    const gesture = drag.current
    const size = cell()
    const note = gesture && notes.find((candidate) => candidate.id === gesture.id)
    const element = gesture && noteElement(gesture.id)
    if (!gesture || !size || !note || !element) return

    gesture.steps = Math.round((event.clientX - gesture.from.x) / size.w)
    gesture.rows = -Math.round((event.clientY - gesture.from.y) / size.h)
    const preview =
      gesture.edge === 'move'
        ? moveNote(note, gesture.steps, gesture.rows)
        : resizeNote(note, gesture.edge, gesture.steps)

    place(element, preview)
    if (gesture.edge === 'move' && preview.midi !== gesture.heard) {
      gesture.heard = preview.midi
      play(preview.midi)
    }
  }

  function endDrag() {
    const gesture = drag.current
    drag.current = null
    if (!gesture) return
    const note = notes.find((candidate) => candidate.id === gesture.id)
    if (!note) return

    // A press that never moved is a click: select it, and put it back where it was.
    const moved = gesture.steps !== 0 || gesture.rows !== 0
    if (!moved) {
      place(noteElement(note.id), note)
      setSelected(note.id)
      return
    }

    const committed =
      gesture.edge === 'move'
        ? moveNote(note, gesture.steps, gesture.rows)
        : resizeNote(note, gesture.edge, gesture.steps)
    place(noteElement(note.id), committed)
    commit(
      notes.map((candidate) => (candidate.id === note.id ? committed : candidate)),
      note.id,
    )
    if (gesture.edge === 'move') play(committed.midi)
  }

  /** Double click: on a note to remove it, on empty grid to write one there. */
  function onDoubleClick(event: PointerEvent<HTMLDivElement>) {
    const id = (event.target as HTMLElement).closest('[data-note]')?.getAttribute('data-note')
    if (id) {
      commit(notes.filter((note) => note.id !== id))
      setSelected(null)
      return
    }
    const size = cell()
    const box = roll.current?.getBoundingClientRect()
    if (!size || !box) return
    const step = Math.floor((event.clientX - box.left) / size.w)
    const midi = HIGH - Math.floor((event.clientY - box.top) / size.h)
    const written: Note = { id: `n${nextId++}`, midi, step, length: MIN_STEP }
    // The written note wins: whatever it lands on is cut or replaced.
    commit([...notes, written], written.id)
    setSelected(written.id)
    play(midi)
  }

  function onKeyDown(event: KeyboardEvent, note: Note) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      commit(notes.filter((candidate) => candidate.id !== note.id))
      setSelected(null)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      play(note.midi)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t('chart')}
        className="flex h-[192px] font-display [--keys:38px] [@media(max-height:700px)]:h-[160px] sm:h-[220px] sm:[--keys:48px]"
      >
        {/* The keyboard: one row per semitone, black keys shortened. The keys ignore the
            colour scheme — white keys are white and black keys are black in either theme,
            because that is what a keyboard looks like. The *grid's* shaded rows below are a
            different thing: that shading is the roll's, and follows the theme like a DAW's
            does. */}
        <div className="relative w-[var(--keys)] shrink-0 border border-r-0 border-hairline-strong">
          {ROWS.map((midi) => (
            <button
              key={midi}
              type="button"
              aria-label={`${labelOf(midi)} · ${frequencyOf(midi).toFixed(1)} Hz`}
              onPointerDown={() => play(midi)}
              className="absolute inset-x-0 cursor-pointer border-t border-[#d6d3d1] bg-white first:border-t-0 hover:opacity-88"
              style={{ bottom: `${(midi - LOW) * ROW_PCT}%`, height: `${ROW_PCT}%` }}
            >
              {BLACK.has(midi % 12) && <span className="block h-full w-[55%] bg-[#0c0a09]" />}
              {midi === LOW && (
                <span className="tabular absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[#777169]">
                  {labelOf(LOW)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          ref={roll}
          className="relative flex-1 border border-hairline-strong"
          onPointerDown={() => setSelected(null)}
          onDoubleClick={onDoubleClick}
        >
          {/* shaded rows for the black keys, then the rules: one per row, one per step, a
              heavier line on every beat, and a 2px line between the two bars */}
          {ROWS.filter((midi) => BLACK.has(midi % 12)).map((midi) => (
            <span
              key={`black${midi}`}
              className="pointer-events-none absolute inset-x-0 bg-surface-strong/60"
              style={{ bottom: `${(midi - LOW) * ROW_PCT}%`, height: `${ROW_PCT}%` }}
            />
          ))}
          {ROWS.map((midi) => (
            <span
              key={`row${midi}`}
              className="pointer-events-none absolute inset-x-0 h-px bg-hairline"
              style={{ bottom: `${(midi - LOW) * ROW_PCT}%` }}
            />
          ))}
          {Array.from({ length: STEPS + 1 }, (_, step) => (
            <span
              key={`step${step}`}
              className={`pointer-events-none absolute inset-y-0 ${
                step % STEPS_PER_BAR === 0
                  ? 'w-0.5 bg-hairline-strong'
                  : step % 4 === 0
                    ? 'w-px bg-hairline-strong'
                    : 'w-px bg-hairline/70'
              }`}
              style={{ left: `${step * STEP_PCT}%` }}
            />
          ))}

          {/* the playhead, moved imperatively: it would otherwise re-render the whole
              roll sixty times a second */}
          <span
            ref={head}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-ink opacity-0"
            style={{ left: '0%' }}
          />

          {notes.map((note) => (
            <div
              key={note.id}
              data-note={note.id}
              role="button"
              tabIndex={0}
              aria-label={`${labelOf(note.midi)} · ${frequencyOf(note.midi).toFixed(1)} Hz`}
              onPointerDown={(event) => startDrag(event, note, 'move')}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onKeyDown={(event) => onKeyDown(event, note)}
              className={`group absolute flex cursor-grab items-center justify-center overflow-hidden border text-[9px] leading-none ${
                selected === note.id
                  ? 'border-2 border-ink bg-surface text-ink'
                  : 'border-ink bg-ink text-on-primary hover:opacity-88'
              }`}
              style={{
                left: `${note.step * STEP_PCT}%`,
                bottom: `${(note.midi - LOW) * ROW_PCT}%`,
                width: `${note.length * STEP_PCT}%`,
                height: `${ROW_PCT}%`,
              }}
            >
              <span className="pointer-events-none truncate px-px">{NAMES[note.midi % 12]}</span>
              {/* the edges that change the length: invisible until the note is touched.
                  A quarter of the note, capped: eighteen rows over two bars makes a step
                  ~15px, so two fixed 6px handles would swallow a one-step note whole. */}
              {(['start', 'end'] as const).map((edge) => (
                <span
                  key={edge}
                  data-edge={edge}
                  onPointerDown={(event) => startDrag(event, note, edge)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  className={`absolute inset-y-0 w-[25%] max-w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 ${
                    edge === 'start' ? 'left-0' : 'right-0'
                  } ${selected === note.id ? 'bg-ink/30' : 'bg-canvas/60'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* The transport is one object, not three things that happen to share a line: a single
          32px hairline bar cut into cells by rules — the keys, then the spectrum, then the
          readout. One outline, one height, one set of rules, and every cell keeps the same
          8px rhythm inside it. */}
      <div className="flex items-stretch divide-x divide-hairline-strong border border-hairline-strong">
        <button
          type="button"
          aria-label={playing ? t('rollStop') : t('rollPlay')}
          title={playing ? t('rollStop') : t('rollPlay')}
          onClick={togglePlay}
          className="flex size-8 shrink-0 items-center justify-center text-ink hover:bg-surface-strong"
        >
          {/* Hollow, not solid: in a row of outline glyphs a filled triangle is the only
              heavy thing on the bar and pulls the eye off the balance. */}
          {playing ? (
            <Square aria-hidden="true" className="size-4" strokeWidth={1.75} />
          ) : (
            <Play aria-hidden="true" className="size-4" strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          aria-label={t('rollShuffle')}
          title={t('rollShuffle')}
          onClick={() => {
            commit(withIds(randomPhrase()))
            setSelected(null)
          }}
          className="flex size-8 shrink-0 items-center justify-center text-ink hover:bg-surface-strong"
        >
          <Dices aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          aria-label={t('rollReset')}
          title={t('rollReset')}
          onClick={() => {
            commit(withIds(OPENING_PHRASE))
            setSelected(null)
          }}
          className="flex size-8 shrink-0 items-center justify-center text-ink hover:bg-surface-strong"
        >
          <RotateCcwSquare aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </button>

        {/* Its own cell with padding, so the bars never touch a rule and silence is an empty
            strip inside the bar rather than a hole in it. */}
        <div className="flex min-w-0 flex-1 items-center px-3">
          <canvas ref={meter} aria-hidden="true" className="h-6 w-full text-ink" />
        </div>

        {/* The readout is a cell of the same bar, right-aligned tabular numerals as before. */}
        <div className="tabular flex shrink-0 items-center px-3 text-[11px] text-muted">
          {notes.length} · 4/4 · {BPM} bpm
        </div>
      </div>
    </div>
  )
}
