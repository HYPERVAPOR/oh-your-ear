/**
 * One day of practice, as `GET /me/daily` returns it: a contiguous, ascending range
 * ending today, including the days nothing was done.
 */
export type DailyBucket = {
  date: string
  solved: number
  goal: number
  met: boolean
}

/** How much of the calendar one screen shows. A square is always one day — except on the
 *  day view, where it is one of the questions the day's goal asks for. */
export type Level = 'day' | 'week' | 'month' | 'year'

/** Met, partly done, or nothing: a day is judged against the goal that applied to it. */
export type Tier = 0 | 1 | 3

/** One square of a calendar view: a date, or a blank that keeps the columns aligned.
 *  Blanks carry a key too — a list of squares has to be keyed, and only the square itself
 *  knows what makes it unique. */
export type Square = { key: string; date: string | null; day?: DailyBucket; tier: Tier }

/** One square of the day view: a question the goal asked for, filled as it is answered. */
export type Slot = { key: number; filled: boolean }

/** The plan's default daily goal (PRD 5.0.1), and what a reader without a plan sees. */
export const DEFAULT_GOAL = 20

const DAY_MS = 86_400_000

/** Dates are handled in UTC: the API already decided which local day each bucket is. */
const at = (date: string) => Date.parse(`${date}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function tierOf(day: DailyBucket | undefined): Tier {
  if (!day || day.solved <= 0) return 0
  return day.met ? 3 : 1
}

/** Monday-first index, 0–6: the calendar's rows start on Monday. */
export function weekdayIndex(date: string): number {
  return (new Date(at(date)).getUTCDay() + 6) % 7
}

function index(days: DailyBucket[]): Map<string, DailyBucket> {
  return new Map(days.map((day) => [day.date, day]))
}

/** Blanks up to the first of the month (or the first day of the series), so the column a
 *  day lands in is its weekday. */
export function leadingBlanks(date: string): Square[] {
  return Array.from({ length: weekdayIndex(date) }, (_, offset) => ({
    key: `pad-${offset}`,
    date: null,
    tier: 0 as Tier,
  }))
}

function squareAt(byDate: Map<string, DailyBucket>, date: string): Square {
  const day = byDate.get(date)
  return { key: date, date, day, tier: tierOf(day) }
}

/** The seven days of the week `today` falls in, Monday first. */
export function week(days: DailyBucket[], today: string): Square[] {
  const byDate = index(days)
  const start = at(today) - weekdayIndex(today) * DAY_MS
  return Array.from({ length: 7 }, (_, offset) => squareAt(byDate, iso(start + offset * DAY_MS)))
}

/** The month `today` falls in, as a calendar: blanks up to the 1st, then its days. */
export function month(days: DailyBucket[], today: string): Square[] {
  const byDate = index(days)
  const first = `${today.slice(0, 7)}-01`
  const calendarYear = Number(today.slice(0, 4))
  const calendarMonth = Number(today.slice(5, 7))
  // Day 0 of the next month is the last day of this one, which knows about leap years.
  const length = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate()

  const squares: Square[] = leadingBlanks(first)
  for (let offset = 0; offset < length; offset++) {
    squares.push(squareAt(byDate, iso(at(first) + offset * DAY_MS)))
  }
  return squares
}

/** The year: every day the series has, one column per week. */
export function year(days: DailyBucket[]): Square[] {
  return days.map((day) => ({ key: day.date, date: day.date, day, tier: tierOf(day) }))
}

/**
 * The day view's bar: how much of today's goal is done, capped at full — a day counts as
 * done once, not twice.
 */
export function dayPercent(day: DailyBucket | undefined, fallbackGoal: number): number {
  const goal = day && day.goal > 0 ? day.goal : fallbackGoal
  const solved = day?.solved ?? 0
  return goal > 0 ? Math.min((solved / goal) * 100, 100) : 0
}

/**
 * An empty range of days, so a signed-out reader sees the calendar they are being offered
 * instead of a blank box, and the layout does not jump after signing in.
 */
export function emptyRange(last: string, count = 371): DailyBucket[] {
  const end = at(last)
  return Array.from({ length: count }, (_, offset) => ({
    date: iso(end - (count - 1 - offset) * DAY_MS),
    solved: 0,
    goal: 0,
    met: false,
  }))
}
