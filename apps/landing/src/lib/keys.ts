/** A few lines of Web Audio instead of a sample library.
 *
 *  The point of the site split (PRD 7.1.2) is that this page must not carry the practice
 *  engine, and the engine's piano is 8MB of Salamander samples. So the landing page
 *  synthesises its own note: a triangle wave with two partials through a lowpass, with
 *  the fast-attack, slow-fall envelope of a struck string. It sounds like an electric
 *  piano, which is honest — this is a demonstration, not an instrument. */

let context: AudioContext | null = null

/** Equal temperament from A4 = 440. */
export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function playNote(frequency: number): void {
  const audio = (context ??= new AudioContext())
  // A context created outside a gesture starts suspended, and one suspended by the
  // browser after backgrounding stays that way until something resumes it.
  if (audio.state === 'suspended') void audio.resume()

  const now = audio.currentTime
  const envelope = audio.createGain()
  envelope.gain.setValueAtTime(0, now)
  envelope.gain.linearRampToValueAtTime(0.4, now + 0.006)
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)

  const tone = audio.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 3400
  envelope.connect(tone)
  tone.connect(audio.destination)

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
