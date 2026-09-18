import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Surface panel: white card on paper, hairline border, and the system's single
 * shadow tier once hovered. Depth otherwise belongs to the orbs.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-hairline bg-surface',
        interactive && 'transition-shadow hover:shadow-soft',
        className,
      )}
      {...props}
    />
  )
}

/** Small tag. Uppercase is reserved for these, never for page decoration. */
export function Pill({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'ink' | 'success' | 'error' }) {
  const tones = {
    neutral: 'bg-surface-strong text-body',
    ink: 'bg-primary text-on-primary',
    success: 'bg-success/10 text-success-text',
    error: 'bg-error/10 text-error-text',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

/** One line of direction, not an apology. */
export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn('text-[15px] text-muted', className)}>{children}</p>
}
