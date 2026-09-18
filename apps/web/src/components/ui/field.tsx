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
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-[15px] font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  )
}
