import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cookieDomain } from './cookie-domain.ts'

// The two sites are separate origins; this function is the only thing standing between
// "language and theme follow the reader across" and "they reset on every hop".
test('both sites land on the same cookie scope', () => {
  assert.equal(cookieDomain('example.com'), '.example.com')
  assert.equal(cookieDomain('app.example.com'), '.example.com')
  assert.equal(cookieDomain('www.example.com'), '.example.com')
})

test('development on localhost has no shared scope (Chrome rejects Domain=localhost)', () => {
  assert.equal(cookieDomain('localhost'), undefined)
  assert.equal(cookieDomain('app.localhost'), undefined)
})

test('a single-label host keeps a host-only cookie', () => {
  assert.equal(cookieDomain('intranet'), undefined)
})
