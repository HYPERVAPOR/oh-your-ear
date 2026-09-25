import { avatarColors, avatarPattern } from '@/lib/avatar'
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
 * The generated avatar of an account that has no picture: five columns of blocks mirrored
 * around the middle, in one hue, from the account's id — the shape GitHub gives an account
 * without an avatar. Colours are inline rather than tokens: an avatar must not change with
 * the theme. Square, always: the system has no rounded corners.
 */
export function PixelAvatar({ seed, size = 'md' }: { seed: string; size?: keyof typeof SIZES }) {
  const { ink, ground } = avatarColors(seed)
  // The coordinates are baked into the keys before JSX: React's rule against index keys
  // cannot tell a stable coordinate from a position in a list.
  const cells = avatarPattern(seed).flatMap((row, y) =>
    row.map((on, x) => ({ key: `${x}:${y}`, on })),
  )

  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: ground }}
      className={cn('grid shrink-0 grid-cols-5 grid-rows-5', SIZES[size])}
    >
      {cells.map((cell) => (
        <span key={cell.key} style={cell.on ? { backgroundColor: ink } : undefined} />
      ))}
    </span>
  )
}

/** The picture this reader has: the one they uploaded, the provider's, or our generated one. */
export function Avatar({ user, size = 'md' }: { user: AvatarUser; size?: keyof typeof SIZES }) {
  if (user.avatarUrl) {
    // Decorative: the account's name or address is always next to it.
    return <img src={user.avatarUrl} alt="" className={cn('shrink-0 object-cover', SIZES[size])} />
  }
  return <PixelAvatar seed={user.id} size={size} />
}
