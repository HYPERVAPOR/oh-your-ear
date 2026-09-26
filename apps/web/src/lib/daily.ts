import type { ExerciseKind } from '@/components/ui/orb'
import { shuffle } from './utils.ts'

/** Questions in one sitting: the plan can ask for more, but not in a single round. */
export const MAX_SESSION = 20

/**
 * The modules of one day's session, in the order they will be asked.
 *
 * Spread evenly rather than drawn per question. Drawing each of twenty questions
 * independently over three modules still averages seven each, but the spread is routinely
 * 3 to 11 — and a reader who picked three modules picked them to practise all three. The
 * remainder goes to whichever modules the shuffle happens to put first, so no module is
 * always the long one, and the run is then shuffled so a module never arrives as one block.
 */
export function dailyPlan(focus: ExerciseKind[], count: number): ExerciseKind[] {
  if (focus.length === 0 || count <= 0) return []

  const per = Math.floor(count / focus.length)
  const remainder = count % focus.length

  return shuffle(
    shuffle(focus).flatMap((kind, index) =>
      Array.from({ length: per + (index < remainder ? 1 : 0) }, () => kind),
    ),
  )
}

/**
 * How many questions this sitting asks: what today still owes, or — once the goal is met —
 * one more round worth at most the goal itself. The old rule handed twenty questions to a
 * reader whose goal was five.
 */
export function sessionSize(goal: number, solved: number): number {
  const remaining = goal - solved
  return remaining > 0 ? Math.min(remaining, MAX_SESSION) : Math.min(goal, MAX_SESSION)
}
