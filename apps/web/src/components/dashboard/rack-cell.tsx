import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * The cell both racks are built from: a 3px track colour along the top edge — the module's
 * colour everywhere else, a plain rule for the two cells that belong to no module — then
 * a title and whatever the rack puts under it.
 */
export function RackCell({
  to,
  swatch,
  title,
  children,
}: {
  to: string
  swatch: string
  title: string
  children?: ReactNode
}) {
  return (
    <Link to={to} className="group block h-full">
      {/* One height for both tabs. Learn's bar makes its cell 87px and Random's has
          nothing after the title, so without this the rack jumps 26px when the tab
          changes. 88px is the next step of the 8px rhythm. */}
      <Card
        interactive
        className="h-full min-h-[88px] gap-0 overflow-hidden p-0 transition-colors group-hover:border-hairline-strong"
      >
        <span aria-hidden="true" className={cn('block h-[3px] w-full', swatch)} />
        <span className="block px-4 py-4">
          <span className="font-display block text-[19px] font-medium leading-tight">{title}</span>
          {children}
        </span>
      </Card>
    </Link>
  )
}
