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
