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

export type Granularity = 'day' | 'week' | 'month' | 'year'

/** One square of the heatmap, with the numbers behind its colour. */
export type Period = {
  /** Stable identity and the sorting key: the first day of the period. */
  key: string
  first: string
  last: string
  solved: number
  /** How many days the period covers, and the goals that were in force across it. */
  days: number
  goal: number
  tier: 0 | 1 | 2 | 3
}

const DAY_MS = 86_400_000

/** Dates are handled in UTC: the API already decided which local day each bucket is. */
const at = (date: string) => Date.parse(`${date}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The Monday of a day's week — the daily grid is laid out Monday first, so weeks are too. */
function weekStart(date: string): string {
  const ms = at(date)
  return iso(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS)
}

function groupKey(date: string, granularity: Granularity): string {
  if (granularity === 'week') return weekStart(date)
  if (granularity === 'month') return `${date.slice(0, 7)}-01`
  if (granularity === 'year') return `${date.slice(0, 4)}-01-01`
  return date
}

/**
 * The same practice history at four time scales. `days` is the only period with a goal
 * to be judged against, so it is the only one whose tier means "did I meet it"; weeks,
 * months and years have no such target and are coloured relative to the busiest one in
 * the range (PRD 7.1.4).
 */
export function slice(days: DailyBucket[], granularity: Granularity): Period[] {
  const grouped = new Map<string, Period>()

  for (const day of days) {
    const key = groupKey(day.date, granularity)
    let period = grouped.get(key)
    if (!period) {
      period = { key, first: day.date, last: day.date, solved: 0, days: 0, goal: 0, tier: 0 }
      grouped.set(key, period)
    }
    period.solved += day.solved
    period.goal += day.goal
    period.days += 1
    period.last = day.date
    if (granularity === 'day') period.tier = day.solved <= 0 ? 0 : day.met ? 3 : 1
  }

  const periods = [...grouped.values()]
  if (granularity === 'day') return periods

  const busiest = periods.reduce((most, period) => Math.max(most, period.solved), 0)
  for (const period of periods) {
    period.tier =
      busiest <= 0 || period.solved <= 0
        ? 0
        : (Math.min(3, Math.ceil((period.solved / busiest) * 3)) as 1 | 2 | 3)
  }
  return periods
}

/**
 * An empty range of days, so a signed-out reader sees the grid they are being offered
 * instead of a blank box, and the layout does not jump after signing in.
 */
export function emptyRange(last: string, count = 371): DailyBucket[] {
  const end = at(last)
  return Array.from({ length: count }, (_, index) => ({
    date: iso(end - (count - 1 - index) * DAY_MS),
    solved: 0,
    goal: 0,
    met: false,
  }))
}
