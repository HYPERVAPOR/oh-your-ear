import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  emptyRange,
  goalSlots,
  month,
  tierOf,
  week,
  weekdayIndex,
  year,
  type DailyBucket,
} from './heatmap.ts'

const day = (date: string, solved: number, goal = 10, met = solved >= goal): DailyBucket => ({
  date,
  solved,
  goal,
  met,
})

const dates = (squares: { date: string | null }[]) => squares.map((square) => square.date)

test('a day is met, partly done, or nothing', () => {
  assert.equal(tierOf(day('2026-09-21', 10)), 3)
  assert.equal(tierOf(day('2026-09-21', 4)), 1)
  assert.equal(tierOf(day('2026-09-21', 0)), 0)
  assert.equal(tierOf(undefined), 0)
})

test('the week is seven days, Monday first', () => {
  // 2026-09-23 is a Wednesday, so the week runs from the 21st to the 27th.
  assert.equal(weekdayIndex('2026-09-21'), 0)
  assert.equal(weekdayIndex('2026-09-23'), 2)
  assert.equal(weekdayIndex('2026-09-27'), 6)

  const squares = week([day('2026-09-22', 10), day('2026-09-27', 3)], '2026-09-23')
  assert.deepEqual(dates(squares), [
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
  ])
  assert.deepEqual(
    squares.map((square) => square.tier),
    [0, 3, 0, 0, 0, 0, 1],
  )
})

test('the month is a calendar: blanks up to the 1st, then every day of it', () => {
  // 2026-09-01 is a Tuesday, so one blank leads.
  const sept = month([day('2026-09-01', 10), day('2026-09-30', 2)], '2026-09-15')
  assert.equal(sept.length, 1 + 30)
  assert.deepEqual(dates(sept).slice(0, 3), [null, '2026-09-01', '2026-09-02'])
  assert.equal(sept[sept.length - 1].date, '2026-09-30')
  assert.equal(sept[1].tier, 3)
  assert.equal(sept[sept.length - 1].tier, 1)
})

test('month length comes from the calendar, not from a table', () => {
  assert.equal(month([], '2026-02-10').length, weekdayIndex('2026-02-01') + 28)
  assert.equal(month([], '2028-02-10').length, weekdayIndex('2028-02-01') + 29)
  assert.equal(month([], '2026-04-10').length, weekdayIndex('2026-04-01') + 30)
  assert.equal(month([], '2026-05-10').length, weekdayIndex('2026-05-01') + 31)
})

test('the year view is the series itself, a square per day', () => {
  const squares = year(emptyRange('2026-09-21', 371))
  assert.equal(squares.length, 371)
  assert.equal(squares[370].date, '2026-09-21')
  assert.equal(squares[0].date, '2025-09-16')
})

test('the day view is one square per question of today’s goal', () => {
  const slots = goalSlots(day('2026-09-21', 3, 20), 20)
  assert.equal(slots.length, 20)
  assert.equal(slots.filter((slot) => slot.filled).length, 3)

  // Nothing done yet: the full goal is on screen, all of it empty.
  assert.deepEqual(
    goalSlots(day('2026-09-21', 0, 20), 20).map((slot) => slot.filled),
    Array(20).fill(false),
  )

  // Past the goal the strip grows rather than capping at 20/20.
  assert.equal(goalSlots(day('2026-09-21', 23, 20), 20).length, 23)

  // No plan to read (a guest): the default stands in, and there is always one square.
  assert.equal(goalSlots(undefined, 20).length, 20)
  assert.equal(goalSlots(day('2026-09-21', 0, 0), 20).length, 20)
})
