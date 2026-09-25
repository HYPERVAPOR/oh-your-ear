import { avatarPattern } from '@/lib/avatar'
import { cn } from '@/lib/utils'

/** The account as the API describes it, narrowed to what an avatar needs. */
type AvatarUser = {
  id: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
}

/** Literal classes, so Tailwind sees them. */
const SIZES = { md: 'size-10', lg: 'size-16' } as const

/**
 * The generated avatar of an account that has no picture: a 5x5 pixel pattern mirrored
 * around its middle, drawn from the account's id. Ink on the softer canvas, because the
 * five module colours belong to the drills and nothing else.
 */
export function PixelAvatar({ seed, size = 'md' }: { seed: string; size?: keyof typeof SIZES }) {
  // The coordinates are baked into the keys before JSX: React's rule against index keys
  // cannot tell a stable coordinate from a position in a list.
  const cells = avatarPattern(seed).flatMap((row, y) =>
    row.map((on, x) => ({ key: `${x}:${y}`, on })),
  )

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 grid-cols-5 grid-rows-5 bg-canvas-soft', SIZES[size])}
    >
      {cells.map((cell) => (
        <span key={cell.key} className={cell.on ? 'bg-ink' : 'bg-canvas-soft'} />
      ))}
    </span>
  )
}

/**
 * The picture a reader uploaded or signed in with, or the generated one when there is
 * neither. Square, always: the system has no rounded corners.
 */
export function Avatar({ user, size = 'md' }: { user: AvatarUser; size?: keyof typeof SIZES }) {
  if (user.avatarUrl) {
    // Decorative: the account's name or address is always next to it.
    return <img src={user.avatarUrl} alt="" className={cn('shrink-0 object-cover', SIZES[size])} />
  }
  return <PixelAvatar seed={user.id} size={size} />
}
