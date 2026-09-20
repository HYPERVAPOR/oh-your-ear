import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HIGH, LOW, STEPS, moveNote, overlaps, randomBar, resizeNote, type Note } from './roll.ts'

const bar = (over: Partial<Note> = {}): Note => ({ id: 'n', midi: 64, step: 4, length: 2, ...over })

test('moving snaps to whole steps and rows, and stops at the walls', () => {
  assert.deepEqual(
    { step: moveNote(bar(), 3, -2).step, midi: moveNote(bar(), 3, -2).midi },
    { step: 7, midi: 62 },
  )
  // right wall: the note keeps its length, so it stops at STEPS - length
  assert.equal(moveNote(bar({ step: 14, length: 4 }), 10, 0).step, STEPS - 4)
  assert.equal(moveNote(bar({ step: 0 }), -5, 0).step, 0)
  // pitch walls
  assert.equal(moveNote(bar({ midi: HIGH }), 0, 9).midi, HIGH)
  assert.equal(moveNote(bar({ midi: LOW }), 0, -9).midi, LOW)
})

test('resizing moves one edge and leaves the other where it was', () => {
  const note = bar({ step: 4, length: 4 })
  const longer = resizeNote(note, 'end', 2)
  assert.deepEqual({ step: longer.step, length: longer.length }, { step: 4, length: 6 })
  const shorter = resizeNote(note, 'start', 2)
  // the tail is the anchor: step moves, the end does not
  assert.deepEqual({ step: shorter.step, length: shorter.length }, { step: 6, length: 2 })
  assert.equal(shorter.step + shorter.length, note.step + note.length)
})

test('a resize never inverts or leaves the bar', () => {
  const note = bar({ step: 4, length: 4 })
  assert.equal(resizeNote(note, 'start', 99).length, 1)
  assert.equal(resizeNote(note, 'start', -99).step, 0)
  assert.equal(resizeNote(note, 'end', 99).step + resizeNote(note, 'end', 99).length, STEPS)
  assert.equal(resizeNote(note, 'end', -99).length, 1)
})

test('the random bar is playable: inside the bar, no duplicates, never empty', () => {
  for (let seed = 0; seed < 500; seed += 1) {
    // a deterministic sweep: each seed is a different random stream
    let n = seed
    const random = () => {
      n = (n * 1103515245 + 12345) % 2147483648
      return n / 2147483648
    }
    const notes = randomBar(random)
    assert.ok(notes.length > 0, `seed ${seed} produced nothing`)
    for (const note of notes) {
      assert.ok(note.step >= 0 && note.step + note.length <= STEPS, `seed ${seed} ran past the bar`)
      assert.ok(note.length >= 1, `seed ${seed} has a zero-length note`)
      assert.ok(note.midi >= LOW && note.midi <= HIGH, `seed ${seed} left the octave`)
    }
    const keys = notes.map((note) => `${note.step}:${note.midi}`)
    assert.equal(new Set(keys).size, keys.length, `seed ${seed} stacked a note on a note`)
  }
})

test('overlaps finds a note on the same step and pitch only', () => {
  const notes = [bar({ step: 4, midi: 64 })]
  assert.equal(overlaps(notes, { step: 4, midi: 64 }), true)
  assert.equal(overlaps(notes, { step: 4, midi: 65 }), false)
  assert.equal(overlaps(notes, { step: 5, midi: 64 }), false)
})
