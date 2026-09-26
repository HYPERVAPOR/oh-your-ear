import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AVATAR_COLUMNS,
  AVATAR_MAX_BYTES,
  avatarColors,
  avatarFileProblem,
  avatarPattern,
  avatarShapeProblem,
} from './avatar.ts'

test('the generated avatar is a full square of blocks', () => {
  const pattern = avatarPattern('f6a1c0de-0000-4000-8000-000000000001')
  assert.equal(pattern.length, AVATAR_COLUMNS)
  for (const row of pattern) {
    assert.equal(row.length, AVATAR_COLUMNS)
    for (const block of row) assert.equal(typeof block, 'boolean')
  }
})

test('every row mirrors around the middle column', () => {
  for (const seed of ['a', 'someone@example.com', 'f6a1c0de-0000-4000-8000-000000000002']) {
    for (const row of avatarPattern(seed)) {
      for (let i = 0; i < AVATAR_COLUMNS; i++) {
        assert.equal(row[i], row[AVATAR_COLUMNS - 1 - i], `${seed}: column ${i} is not mirrored`)
      }
    }
  }
})

test('the same account always draws the same picture, and two accounts differ', () => {
  const first = JSON.stringify(avatarPattern('f6a1c0de-0000-4000-8000-000000000003'))
  assert.equal(first, JSON.stringify(avatarPattern('f6a1c0de-0000-4000-8000-000000000003')))
  // Not proof that no two ids collide, only that neighbouring ones do not look alike.
  assert.notEqual(first, JSON.stringify(avatarPattern('f6a1c0de-0000-4000-8000-000000000004')))
})

test('the colour comes from the same id, is stable, and differs between accounts', () => {
  const one = avatarColors('f6a1c0de-0000-4000-8000-000000000005')
  assert.deepEqual(one, avatarColors('f6a1c0de-0000-4000-8000-000000000005'))
  // Ink darker than ground, both inside the sRGB gamut the browser is given.
  for (const value of [one.ink, one.ground]) {
    assert.match(value, /^hsl\(\d{1,3} \d{1,2}% \d{1,2}%\)$/)
  }
  assert.notDeepEqual(one, avatarColors('f6a1c0de-0000-4000-8000-000000000006'))
})

test('only the two formats the API can decode', () => {
  assert.equal(avatarFileProblem({ type: 'image/png', size: 1000 }), null)
  assert.equal(avatarFileProblem({ type: 'image/jpeg', size: 1000 }), null)
  assert.equal(avatarFileProblem({ type: 'image/webp', size: 1000 }), 'type')
  assert.equal(avatarFileProblem({ type: 'application/pdf', size: 1000 }), 'type')
})

test('nothing over the API limit goes out', () => {
  assert.equal(avatarFileProblem({ type: 'image/png', size: AVATAR_MAX_BYTES }), null)
  assert.equal(avatarFileProblem({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 }), 'size')
})

test('a picture that is mostly crop is refused', () => {
  assert.equal(avatarShapeProblem(256, 256), null)
  assert.equal(avatarShapeProblem(1920, 1080), null)
  assert.equal(avatarShapeProblem(3000, 200), 'shape')
  assert.equal(avatarShapeProblem(200, 3000), 'shape')
})

test('too small is a refusal, not a stretch', () => {
  assert.equal(avatarShapeProblem(16, 16), null)
  assert.equal(avatarShapeProblem(15, 400), 'small')
})
