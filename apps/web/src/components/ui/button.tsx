import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// DESIGN.md: pill geometry for every action, ink as the only action colour, one
// outline weight. `hero` is reserved for the listen button on exercise screens.
const buttonVariants = cva(
  // A disabled control goes quiet rather than becoming a muddy version of the ink
  // pill: on a monochrome page, "greyed out" has to be legible as a state.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-strong disabled:text-muted-soft',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:opacity-88 active:opacity-100',
        outline: 'border border-hairline-strong bg-transparent text-ink hover:bg-surface-strong',
        ghost: 'text-body hover:bg-surface-strong hover:text-ink',
        quiet: 'bg-surface-strong text-ink hover:bg-hairline',
        link: 'text-ink underline underline-offset-4 decoration-hairline-strong hover:decoration-ink',
        destructive: 'text-error-text hover:bg-error/10',
      },
      size: {
        sm: 'h-9 px-4 text-[14px]',
        default: 'h-10 px-5 text-[15px]',
        lg: 'h-12 px-7 text-[16px]',
        hero: 'h-[52px] px-9 text-[17px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
)
Button.displayName = 'Button'

export { Button, buttonVariants }
