import { cn } from '@/lib/utils'

export type ExerciseKind = 'singleNote' | 'interval' | 'chord' | 'melody' | 'rhythm'

/** The five drills, in the order every rack and statistic lists them. */
export const MODULES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

/**
 * The module's colour as a marker for lists and statistics: the orb itself is
 * atmosphere and far too faint to identify a row.
 */
export const MODULE_SWATCH: Record<ExerciseKind, string> = {
  singleNote: 'bg-swatch-singleNote',
  interval: 'bg-swatch-interval',
  chord: 'bg-swatch-chord',
  melody: 'bg-swatch-melody',
  rhythm: 'bg-swatch-rhythm',
}

export function ModuleSwatch({ kind, className }: { kind: ExerciseKind; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
        MODULE_SWATCH[kind],
        className,
      )}
    />
  )
}
