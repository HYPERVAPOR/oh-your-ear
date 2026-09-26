import assert from 'node:assert/strict'
import { test } from 'node:test'

import { dailyPlan, sessionSize } from './daily.ts'
import type { ExerciseKind } from '../components/ui/orb.tsx'

const THREE: ExerciseKind[] = ['singleNote', 'interval', 'chord']

const counts = (plan: ExerciseKind[]) =>
  plan.reduce<Record<string, number>>((acc, kind) => ({ ...acc, [kind]: (acc[kind] ?? 0) + 1 }), {})

test('a day spreads its questions evenly over the focus modules', () => {
  const plan = dailyPlan(THREE, 20)

  assert.equal(plan.length, 20)
  assert.deepEqual(Object.values(counts(plan)).sort(), [6, 7, 7])
  assert.deepEqual(Object.keys(counts(plan)).sort(), [...THREE].sort())
})

test('the spread stays within one question of even, for any focus list and length', () => {
  const lists: ExerciseKind[][] = [THREE, [...THREE, 'melody'], ['rhythm'], ['melody', 'rhythm']]

  for (const focus of lists) {
    for (const count of [1, 2, 5, 7, 20, 33]) {
      const plan = dailyPlan(focus, count)
      const spread = Object.values(counts(plan))

      assert.equal(plan.length, count)
      assert.equal(Object.keys(counts(plan)).length, Math.min(focus.length, count))
      assert.ok(
        Math.max(...spread) - Math.min(...spread) <= 1,
        `${focus.length} modules over ${count} questions gave ${spread}`,
      )
    }
  }
})

test('a session asks what the day owes, and never more than one round', () => {
  assert.equal(sessionSize(20, 7), 13)
  assert.equal(sessionSize(20, 20), 20)
  assert.equal(sessionSize(5, 5), 5)
  assert.equal(sessionSize(5, 0), 5)
  assert.equal(sessionSize(500, 480), 20)
})
