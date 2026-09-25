import * as React from 'react'

import { cn } from '@/lib/utils'

const fieldClass =
  'w-full rounded-md border border-hairline-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none focus-visible:outline-none'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(fieldClass, 'cursor-pointer appearance-none pr-9', className)}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  /** The quiet line under the input. Pass `''` to hold the line open when it must not
   *  appear and disappear under the reader. */
  hint?: string
  /** The same line as `hint`, in the error colour, and it wins. */
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  const message = error ?? hint

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-[15px] font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {/* Drawn whenever a caller passed one, empty or not, and with a height of its own:
          a message that comes and goes must not change the size of the card around it. */}
      {message !== undefined && (
        <p
          className={cn(
            'min-h-[18px] text-[13px] leading-[18px]',
            error ? 'text-error-text' : 'text-muted',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}
