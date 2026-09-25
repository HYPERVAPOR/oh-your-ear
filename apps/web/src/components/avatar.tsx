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
 * The picture this reader has: the one they uploaded, the one their sign-in provider
 * gave, or ours. The fallback is a bitmap, not a generated pattern — white paper and
 * black pixels, the same in both themes, so an avatar never means something different
 * depending on the theme. Square, always: the system has no rounded corners.
 */
export function Avatar({ user, size = 'md' }: { user: AvatarUser; size?: keyof typeof SIZES }) {
  return (
    // Decorative: the account's name or address is always next to it.
    <img
      src={user.avatarUrl ?? '/avatar-default.png'}
      alt=""
      className={cn('shrink-0 object-cover', SIZES[size])}
    />
  )
}
