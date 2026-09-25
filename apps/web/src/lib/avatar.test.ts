import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isUploadedAvatar } from './avatar.ts'

test('only our own URL counts as an uploaded avatar', () => {
  assert.equal(isUploadedAvatar('/api/v1/me/avatar?v=1730000000'), true)
  assert.equal(isUploadedAvatar('https://lh3.googleusercontent.com/a/abc'), false)
  assert.equal(isUploadedAvatar('/avatar-default.png'), false)
  assert.equal(isUploadedAvatar(null), false)
  assert.equal(isUploadedAvatar(undefined), false)
})
