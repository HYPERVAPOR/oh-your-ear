import { cn } from '@/lib/utils'

export type ExerciseKind = 'singleNote' | 'interval' | 'chord' | 'melody' | 'rhythm'

/**
 * Each exercise module owns one of the five pastel orbs, and it follows that
 * module everywhere it appears: cards on the home page, the exercise header, the
 * statistics breakdown, the mistake notebook. Collecting the mapping here is what
 * keeps the palette an information channel rather than decoration.
 */
export const MODULE_ORB: Record<ExerciseKind, string> = {
  singleNote: 'orb-mint',
  interval: 'orb-peach',
  chord: 'orb-lavender',
  melody: 'orb-sky',
  rhythm: 'orb-rose',
}

/** Atmospheric bloom, positioned by the caller. Decoration only. */
export function Orb({
  kind,
  className,
  size = 'md',
}: {
  kind: ExerciseKind | 'ambient'
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'h-24 w-24',
    md: 'h-40 w-40',
    lg: 'h-72 w-72',
  }

  const orbClass = kind === 'ambient' ? 'orb-mint' : MODULE_ORB[kind]

  return <span aria-hidden="true" className={cn('orb', orbClass, sizes[size], className)} />
}
