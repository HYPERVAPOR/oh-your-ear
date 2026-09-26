import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Answer feedback and option highlighting, shared by every exercise module.
 * Always driven by the semantic tokens so light and dark stay in step.
 */
export function feedbackPill(isCorrect: boolean) {
  return isCorrect ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
}

export function optionHighlight(state: boolean | 'correct' | 'wrong') {
  if (!state) return undefined
  return state === true || state === 'correct'
    ? 'border-success bg-success/10 text-success'
    : 'border-destructive bg-destructive/10 text-destructive'
}

/** Fisher–Yates, as a new array. Random order is part of the product here: the options of
 *  a question, the modules of a day's session. */
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
