import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Dices, Play, Square } from 'lucide-react'

import { buttonVariants } from '@oh-your-ear/shared/button-variants'

import { audioNow, frequencyOf, playNote } from '@/lib/keys'
import {
  HIGH,
  LOW,
  STEPS,
  moveNote,
  normalize,
  randomBar,
  resizeNote,
  type Note,
  type NoteInput,
} from '@/lib/roll'

/** The rows of the roll, low to high. The five black keys get the shaded rows. */
const ROWS = Array.from({ length: HIGH - LOW + 1 }, (_, index) => LOW + index)
const BLACK = new Set([1, 3, 6, 8, 10])
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const nameOf = (midi: number) => NAMES[midi % 12]

const ROW_PCT = 100 / ROWS.length
const STEP_PCT = 100 / STEPS
const MIN_STEP = 1
/** A sixteenth at 120bpm, so the bar is two seconds. */
const SIXTEENTH = 0.125
const BAR = STEPS * SIXTEENTH

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
  const [notes, setNotes] = useState<Note[]>(() => normalize(withIds(randomBar())))
  const [selected, setSelected] = useState<string | null>(null)
  const roll = useRef<HTMLDivElement | null>(null)
  const drag = useRef<Drag | null>(null)
  const head = useRef<HTMLSpanElement | null>(null)
  const frame = useRef(0)
  const [playing, setPlaying] = useState(false)

  const play = (midi: number) => playNote(frequencyOf(midi))

  /** Commit an edit through the overlap rule. `priority` is whatever the reader just
   *  touched: it wins against its neighbours instead of being trimmed by them. */
  function commit(next: Note[], priority?: string) {
    setNotes(normalize(next, priority))
  }

  /** Play the bar: every note scheduled on the audio clock up front, and one short
   *  requestAnimationFrame loop to move the playhead. Nothing runs after the bar ends. */
  function togglePlay() {
    if (playing) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      setPlaying(false)
      return
    }
    const start = (audioNow() ?? 0) + 0.06
    for (const note of notes) {
      playNote(frequencyOf(note.midi), start + note.step * SIXTEENTH)
    }
    setPlaying(true)
    const tick = () => {
      const now = audioNow()
      const line = head.current
      if (!line || now === null) return
      const progress = (now - start) / BAR
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
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label={t('chart')}
        className="flex h-[200px] font-display [--keys:38px] sm:h-[220px] sm:[--keys:48px]"
      >
        {/* the keyboard: one row per semitone, black keys shortened */}
        <div className="relative w-[var(--keys)] shrink-0 border border-r-0 border-hairline-strong">
          {ROWS.map((midi) => (
            <button
              key={midi}
              type="button"
              aria-label={`${nameOf(midi)}4 · ${frequencyOf(midi).toFixed(1)} Hz`}
              onPointerDown={() => play(midi)}
              className={`absolute inset-x-0 cursor-pointer border-t border-hairline first:border-t-0 hover:opacity-88 ${BLACK.has(midi % 12) ? 'bg-surface-strong' : 'bg-surface'}`}
              style={{ bottom: `${(midi - LOW) * ROW_PCT}%`, height: `${ROW_PCT}%` }}
            >
              {BLACK.has(midi % 12) && <span className="block h-full w-[55%] bg-ink" />}
              {midi === LOW && (
                <span className="tabular absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted">
                  C4
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
          {/* shaded rows for the black keys, then the rules: one per row, one per step,
              and a heavier line on every beat */}
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
              className={`pointer-events-none absolute inset-y-0 w-px ${step % 4 === 0 ? 'bg-hairline-strong' : 'bg-hairline/70'}`}
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
              aria-label={`${nameOf(note.midi)}4 · ${frequencyOf(note.midi).toFixed(1)} Hz`}
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
              <span className="pointer-events-none truncate px-px">{nameOf(note.midi)}</span>
              {/* the edges that change the length: invisible until the note is touched */}
              {(['start', 'end'] as const).map((edge) => (
                <span
                  key={edge}
                  data-edge={edge}
                  onPointerDown={(event) => startDrag(event, note, edge)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  className={`absolute inset-y-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 ${
                    edge === 'start' ? 'left-0' : 'right-0'
                  } ${selected === note.id ? 'bg-ink/30' : 'bg-canvas/60'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={playing ? t('rollStop') : t('rollPlay')}
          title={playing ? t('rollStop') : t('rollPlay')}
          onClick={togglePlay}
          className={buttonVariants({ size: 'sm' })}
        >
          {playing ? (
            <Square aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
          ) : (
            <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
          )}
          {playing ? t('rollStop') : t('rollPlay')}
        </button>

        <button
          type="button"
          aria-label={t('rollShuffle')}
          title={t('rollShuffle')}
          onClick={() => {
            commit(withIds(randomBar()))
            setSelected(null)
          }}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Dices aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('rollShuffle')}
        </button>

        <span className="tabular ml-auto text-[11px] text-muted-soft">
          {notes.length} · 4/4 · 120 bpm
        </span>
      </div>
    </div>
  )
}
