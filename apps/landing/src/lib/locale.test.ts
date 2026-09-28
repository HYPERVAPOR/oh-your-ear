import assert from 'node:assert/strict'
import { test } from 'node:test'

import { localeFromPath, pathFor } from './locale.ts'

test('the language is the first thing in the path', () => {
  assert.equal(localeFromPath('/'), 'en')
  assert.equal(localeFromPath('/zh'), 'zh')
  assert.equal(localeFromPath('/zh/'), 'zh')
  assert.equal(localeFromPath('/zh/anything'), 'zh')
  // A path that merely starts with the letters is not that language.
  assert.equal(localeFromPath('/zhoops'), 'en')
  assert.equal(localeFromPath('/zh-Hant'), 'en')
})

test('each language has exactly one address', () => {
  assert.equal(pathFor('en'), '/')
  assert.equal(pathFor('zh'), '/zh')
  // And it is a path the reader of the other page can be sent to.
  assert.equal(pathFor(localeFromPath(pathFor('zh'))), '/zh')
})
