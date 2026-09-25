/** The landing's piano: three samples of the library the engine plays, fetched on the first
 *  gesture.
 *
 *  The point of the site split (PRD 7.1.2) is that this page must not carry the practice
 *  engine, and the engine's sampler is 8MB of samples — so this file used to synthesise every
 *  note from three triangle waves. It was honest and it sounded like it: no attack transient,
 *  brightness fixed at 3400Hz, a tail too clean to be a struck string. Which is fine for a
 *  demo and wrong for this page, whose one job is to let someone hear what the product sounds
 *  like before signing up for it.
 *
 *  So: three samples, one every six semitones across the range the roll and the sound check
 *  play, shifted with `playbackRate` — 211KB, fetched on the first interaction rather than on
 *  load, in plain Web Audio so the bundle stays what it was. The synth remains as the fallback
 *  for a page that cannot reach the library. */

let context: AudioContext | null = null
let meter: AnalyserNode | null = null

/** Equal temperament from A4 = 440. */
export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** The audio clock, for anything that has to line up with scheduled notes. Null until the
 *  first note has been played, since the context is created lazily on a gesture. */
export function audioNow(): number | null {
  return context?.currentTime ?? null
}

/** Where the sound comes out: an analyser in front of the speakers, so a meter can draw
 *  anything that is playing — the whole bar or a single auditioned key. A pass-through:
 *  it neither changes the sound nor survives on its own. */
function output(audio: AudioContext): AnalyserNode {
  if (!meter) {
    meter = audio.createAnalyser()
    meter.fftSize = 512
    meter.connect(audio.destination)
  }
  return meter
}

/** The analyser everything plays through, for drawing. Null until the first note. */
export function audioMeter(): AnalyserNode | null {
  return meter
}

/** Where the samples come from: the same library the engine plays (`apps/web/src/lib/audio.ts`),
 *  pinned to three keys instead of the engine's whole span. */
const SAMPLE_URL = 'https://tonejs.github.io/audio/salamander/'

/** One sample every six semitones. midi 60–77 is the roll's axis (`roll.ts`), 60–71 the flat
 *  chart, 72–73 the sound check — nothing can reach further than five semitones from one of
 *  these three. `Fs4` is how the library spells F♯4. */
export const PIANO_SAMPLES = [
  { midi: 60, file: 'C4.mp3' },
  { midi: 66, file: 'Fs4.mp3' },
  { midi: 72, file: 'C5.mp3' },
] as const

/** Decoded, lowest first. Empty until they arrive — and empty for good if they never do. */
let pianos: { midi: number; buffer: AudioBuffer }[] = []
let pianoLoad: Promise<void> | null = null

/** Fetch and decode the samples, once. Never rejects: a page that has lost the library still has
 *  the synth. Called on the first interaction — see the listener at the foot of this file. */
export function preloadPiano(): Promise<void> {
  const audio = (context ??= new AudioContext())
  pianoLoad ??= Promise.all(
    PIANO_SAMPLES.map(async ({ midi, file }) => {
      const response = await fetch(SAMPLE_URL + file)
      const buffer = await audio.decodeAudioData(await response.arrayBuffer())
      pianos = [...pianos, { midi, buffer }].sort((a, b) => a.midi - b.midi)
    }),
  ).then(
    () => undefined,
    () => undefined,
  )
  return pianoLoad
}

/** The sample closest in pitch to `frequency`, or null while they are still in flight. */
function nearestSample(frequency: number) {
  let nearest: { midi: number; buffer: AudioBuffer } | null = null
  let closest = Infinity
  for (const sample of pianos) {
    const cents = Math.abs(1200 * Math.log2(frequency / frequencyOf(sample.midi)))
    if (cents < closest) {
      nearest = sample
      closest = cents
    }
  }
  return nearest
}

/** A bus to play a bar through, so the whole bar can be silenced at once.
 *
 *  Every note of the bar is scheduled on the audio clock up front — that is how the bar
 *  keeps time without a timer deciding where a note lands — which means cancelling the
 *  timer would leave the notes that are already queued still sounding. Route them through
 *  a bus instead and dropping the bus is a stop that actually stops. */
export function createBus(): GainNode {
  const audio = (context ??= new AudioContext())
  if (audio.state === 'suspended') void audio.resume()
  const bus = audio.createGain()
  bus.connect(output(audio))
  return bus
}

/** `when` is an absolute time on the audio clock: scheduling ahead is how a bar is played
 *  without a timer deciding when a note lands. `bus` is where the note comes out — the
 *  destination when nothing is playing it as part of a bar. */
export function playNote(frequency: number, when?: number, bus?: GainNode | null): void {
  const audio = (context ??= new AudioContext())
  // A context created outside a gesture starts suspended, and one suspended by the
  // browser after backgrounding stays that way until something resumes it.
  if (audio.state === 'suspended') void audio.resume()

  const now = when ?? audio.currentTime

  // A recording carries its own attack and decay, so there is nothing to shape here — only the
  // shift from the pitch it was recorded at, and a level that leaves room for the roll's chords.
  const sample = nearestSample(frequency)
  if (sample) {
    const source = audio.createBufferSource()
    source.buffer = sample.buffer
    source.playbackRate.value = frequency / frequencyOf(sample.midi)
    const level = audio.createGain()
    level.gain.value = 0.5
    source.connect(level)
    level.connect(bus ?? output(audio))
    source.start(now)
    // The recordings ring for the better part of fifteen seconds, long past anything audible;
    // letting twenty-four of them ring out at once is what makes a fan come on.
    source.stop(now + 6)
    return
  }

  // Until the samples land, and for good if they never do: the synthesised note this page
  // started with, an electric piano that owes nothing to the network.
  const envelope = audio.createGain()
  envelope.gain.setValueAtTime(0, now)
  envelope.gain.linearRampToValueAtTime(0.4, now + 0.006)
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)

  const tone = audio.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 3400
  envelope.connect(tone)
  tone.connect(bus ?? output(audio))

  for (const [multiple, level] of [
    [1, 1],
    [2, 0.22],
    [3, 0.07],
  ] as const) {
    const oscillator = audio.createOscillator()
    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency * multiple
    const partial = audio.createGain()
    partial.gain.value = level
    oscillator.connect(partial)
    partial.connect(envelope)
    oscillator.start(now)
    oscillator.stop(now + 1.2)
  }
}

/** Start the fetch as early as the page can tell someone is here, so the first note is the piano
 *  rather than the fallback: a pointer moving over the page, a key, a scroll, or a touch — the
 *  first of these is always ahead of the first play on a desktop, where the size of this file is
 *  all that matters. `pointerover` needs no gesture at all, which is why it is first: only the
 *  fetch needs the page to be awake, and only audio needs the gesture.
 *
 *  ponytail: a touch visitor whose very first interaction is a piano key hears the synth for the
 *  note it takes to decode. Accept it (one note, and the same fallback as no network) rather than
 *  making the note wait — a first note that arrives late is worse than one that arrives synthetic.
 *
 *  The `typeof` guard keeps the module importable where there is no DOM, which is where its test
 *  runs. */
if (typeof document !== 'undefined') {
  for (const type of ['pointerover', 'pointerdown', 'keydown', 'scroll'] as const) {
    document.addEventListener(type, () => void preloadPiano(), { once: true, capture: true })
  }
}
