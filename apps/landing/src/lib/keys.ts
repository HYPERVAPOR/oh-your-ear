/** A few lines of Web Audio instead of a sample library.
 *
 *  The point of the site split (PRD 7.1.2) is that this page must not carry the practice
 *  engine, and the engine's piano is 8MB of Salamander samples. So the landing page
 *  synthesises its own note: a triangle wave with two partials through a lowpass, with
 *  the fast-attack, slow-fall envelope of a struck string. It sounds like an electric
 *  piano, which is honest — this is a demonstration, not an instrument. */

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
