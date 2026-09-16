import * as Tone from 'tone'

const BASE_URL = 'https://tonejs.github.io/audio/salamander/'

// ponytail: using Tone.js-hosted Salamander CDN; self-host samples later if
// offline-first deployment becomes a hard requirement.

function buildSampleMap(): Record<string, string> {
  const map: Record<string, string> = {
    A0: 'A0.mp3',
  }

  for (let octave = 1; octave <= 7; octave++) {
    for (const note of ['A', 'C', 'D#', 'F#']) {
      const name = `${note}${octave}`
      map[name] = `${name.replace('#', 's')}.mp3`
    }
  }

  map['C8'] = 'C8.mp3'
  return map
}

export interface Piano {
  triggerAttackRelease(
    note: string | string[],
    duration: string | number,
    time?: Tone.Unit.Time,
  ): void
}

let pianoPromise: Promise<Piano> | null = null

function createSampler(): Promise<Piano> {
  return new Promise((resolve, reject) => {
    const sampler = new Tone.Sampler({
      urls: buildSampleMap(),
      baseUrl: BASE_URL,
      release: 1,
      onload: () => resolve(sampler),
      onerror: (error) => reject(error),
    }).toDestination()
  })
}

function createFallback(): Piano {
  return new Tone.PolySynth(Tone.Synth).toDestination()
}

export async function getPiano(): Promise<Piano> {
  if (!pianoPromise) {
    pianoPromise = createSampler().catch(createFallback)
  }
  return pianoPromise
}

export async function playSequence(
  notes: string[],
  duration: string | number = '8n',
  gap = 0.5,
): Promise<void> {
  await Tone.start()
  const piano = await getPiano()
  const now = Tone.now()
  notes.forEach((note, index) => {
    piano.triggerAttackRelease(note, duration, now + index * gap)
  })
}

export async function playChord(notes: string[], duration: string | number = '2n'): Promise<void> {
  await Tone.start()
  const piano = await getPiano()
  piano.triggerAttackRelease(notes, duration, Tone.now())
}
