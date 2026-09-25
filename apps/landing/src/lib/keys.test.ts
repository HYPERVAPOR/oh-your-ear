import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PIANO_SAMPLES, frequencyOf } from './keys.ts'
import { HIGH, LOW } from './roll.ts'

/** The roll is the widest thing on the page: its axis is LOW–HIGH and dragging clamps to it, so
 *  those are the notes the piano has to cover. The flat chart and the sound check sit inside. */
test('every note the roll can play is within six semitones of a sample', () => {
  for (let midi = LOW; midi <= HIGH; midi++) {
    const cents = Math.min(
      ...PIANO_SAMPLES.map((sample) =>
        Math.abs(1200 * Math.log2(frequencyOf(midi) / frequencyOf(sample.midi))),
      ),
    )
    assert.ok(cents <= 600, `midi ${midi} is ${cents.toFixed(0)} cents from the nearest sample`)
  }
})

test('the samples are distinct and in ascending order', () => {
  const midis = PIANO_SAMPLES.map((sample) => sample.midi)
  assert.deepEqual(
    midis,
    [...midis].sort((a, b) => a - b),
  )
  assert.equal(new Set(midis).size, midis.length)
})
