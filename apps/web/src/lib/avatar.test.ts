import assert from 'node:assert/strict'
import { test } from 'node:test'

import { AVATAR_COLUMNS, avatarPattern, isUploadedAvatar } from './avatar.ts'

test('the generated avatar is a full square of pixels', () => {
  const pattern = avatarPattern('f6a1c0de-0000-4000-8000-000000000001')
  assert.equal(pattern.length, AVATAR_COLUMNS)
  for (const row of pattern) {
    assert.equal(row.length, AVATAR_COLUMNS)
    for (const pixel of row) assert.equal(typeof pixel, 'boolean')
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
  const again = JSON.stringify(avatarPattern('f6a1c0de-0000-4000-8000-000000000003'))
  assert.equal(first, again)
  // Not proof that no two ids collide, only that neighbouring ones do not look alike.
  const other = JSON.stringify(avatarPattern('f6a1c0de-0000-4000-8000-000000000004'))
  assert.notEqual(first, other)
})

test('only our own URL counts as an uploaded avatar', () => {
  assert.equal(isUploadedAvatar('/api/v1/me/avatar?v=1730000000'), true)
  assert.equal(isUploadedAvatar('https://lh3.googleusercontent.com/a/abc'), false)
  assert.equal(isUploadedAvatar(null), false)
  assert.equal(isUploadedAvatar(undefined), false)
})
