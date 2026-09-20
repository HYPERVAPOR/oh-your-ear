import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HIGH, LOW, STEPS, moveNote, normalize, randomBar, resizeNote, type Note } from './roll.ts'

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

test('a later note cuts an earlier one on the same pitch', () => {
  const notes = normalize([
    { id: 'a', midi: 64, step: 0, length: 8 },
    { id: 'b', midi: 64, step: 4, length: 4 },
  ])
  assert.deepEqual(
    notes.map((note) => [note.id, note.step, note.length]),
    [
      ['a', 0, 4],
      ['b', 4, 4],
    ],
  )
})

test('a note written over another one replaces it', () => {
  // same start is the only way to swallow one whole, and then the longer draw wins
  const notes = normalize([
    { id: 'short', midi: 64, step: 4, length: 2 },
    { id: 'long', midi: 64, step: 4, length: 6 },
  ])
  assert.deepEqual(
    notes.map((note) => note.id),
    ['long'],
  )
})

test('different pitches overlap freely — that is a chord', () => {
  const notes = normalize([
    { id: 'a', midi: 64, step: 2, length: 4 },
    { id: 'b', midi: 67, step: 2, length: 4 },
    { id: 'c', midi: 71, step: 3, length: 4 },
  ])
  assert.equal(notes.length, 3)
})

test('the note being held wins in both directions', () => {
  const held = normalize(
    [
      { id: 'before', midi: 64, step: 0, length: 6 },
      { id: 'held', midi: 64, step: 4, length: 4 },
      { id: 'after', midi: 64, step: 6, length: 4 },
    ],
    'held',
  )
  const byId = Object.fromEntries(held.map((note) => [note.id, note]))
  assert.equal(byId.before.step + byId.before.length, 4, 'the note before is cut at the held note')
  assert.equal(byId.after.step, 8, 'the note after is pushed past the held note')
  assert.equal(byId.held.length, 4, 'the held note keeps its length')
})

test('normalize never lets a note leave the bar', () => {
  for (let seed = 0; seed < 300; seed += 1) {
    let n = seed * 7919
    const random = () => {
      n = (n * 1103515245 + 12345) % 2147483648
      return n / 2147483648
    }
    // valid notes to begin with — staying inside the bar is moveNote's job, not this one's
    const messy: Note[] = Array.from({ length: 12 }, (_, index) => {
      const step = Math.floor(random() * STEPS)
      return {
        id: `x${index}`,
        midi: LOW + Math.floor(random() * (HIGH - LOW + 1)),
        step,
        length: 1 + Math.floor(random() * (STEPS - step)),
      }
    })
    const tidy = normalize(messy)
    for (const note of tidy) {
      assert.ok(note.step >= 0 && note.step + note.length <= STEPS, `seed ${seed} left the bar`)
      assert.ok(note.length >= 1, `seed ${seed} has a zero-length note`)
    }
    // and no two notes share a pitch AND a step once it is done
    const spans = tidy.map((note) => `${note.midi}:${note.step}-${note.step + note.length}`)
    assert.equal(new Set(spans).size, spans.length, `seed ${seed} left a duplicate span`)
  }
})
