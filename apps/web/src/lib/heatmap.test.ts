import assert from 'node:assert/strict'
import { test } from 'node:test'

import { emptyRange, slice, type DailyBucket } from './heatmap.ts'

const day = (date: string, solved: number, goal = 10, met = solved >= goal): DailyBucket => ({
  date,
  solved,
  goal,
  met,
})

test('a day is judged against its own goal, and only a day is', () => {
  const periods = slice([day('2026-09-21', 0), day('2026-09-22', 4), day('2026-09-23', 10)], 'day')
  assert.deepEqual(
    periods.map((p) => [p.key, p.tier]),
    [
      ['2026-09-21', 0],
      ['2026-09-22', 1],
      ['2026-09-23', 3],
    ],
  )
})

test('a week is one square, keyed by its Monday', () => {
  // 2026-09-21 is a Monday; the 27th is the Sunday that closes that week.
  const week = [
    day('2026-09-21', 3),
    day('2026-09-24', 2),
    day('2026-09-27', 5),
    day('2026-09-28', 1),
  ]
  const periods = slice(week, 'week')

  assert.deepEqual(
    periods.map((p) => [p.key, p.first, p.last, p.solved, p.days]),
    [
      ['2026-09-21', '2026-09-21', '2026-09-27', 10, 3],
      ['2026-09-28', '2026-09-28', '2026-09-28', 1, 1],
    ],
  )
})

test('a Sunday belongs to the week that started six days before it', () => {
  const periods = slice([day('2026-09-27', 4), day('2026-09-28', 4)], 'week')
  assert.deepEqual(
    periods.map((p) => p.key),
    ['2026-09-21', '2026-09-28'],
  )
})

test('months and years group across their own boundaries', () => {
  const days = [day('2025-12-31', 1), day('2026-01-01', 2), day('2026-02-28', 3)]
  assert.deepEqual(
    slice(days, 'month').map((p) => [p.key, p.solved]),
    [
      ['2025-12-01', 1],
      ['2026-01-01', 2],
      ['2026-02-01', 3],
    ],
  )
  assert.deepEqual(
    slice(days, 'year').map((p) => [p.key, p.solved, p.days]),
    [
      ['2025-01-01', 1, 1],
      ['2026-01-01', 5, 2],
    ],
  )
})

test('weeks and months are coloured against the busiest one, not against a goal', () => {
  const days = [
    day('2026-09-21', 30),
    day('2026-09-28', 20),
    day('2026-10-05', 1),
    day('2026-10-12', 0),
  ]
  const periods = slice(days, 'week')
  assert.deepEqual(
    periods.map((p) => p.tier),
    [3, 2, 1, 0],
  )
  // A goal of 10 a day is irrelevant here: the 20-question week is not "met", it is
  // simply the second busiest.
  assert.equal(periods[1].goal, 10)
})

test('an empty range gives days with nothing in them', () => {
  const range = emptyRange('2026-09-21', 7)
  assert.equal(range.length, 7)
  assert.deepEqual(range[6], { date: '2026-09-21', solved: 0, goal: 0, met: false })
  assert.deepEqual(range[0].date, '2026-09-15')
  assert.deepEqual(
    slice(range, 'week').map((p) => [p.key, p.solved, p.tier]),
    [
      ['2026-09-14', 0, 0],
      ['2026-09-21', 0, 0],
    ],
  )
})
