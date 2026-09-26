/**
 * The generated avatar of an account that has no picture, and the road an upload takes before
 * it leaves the browser.
 *
 * GitHub's recipe, near enough: the account's id is hashed once, and that hash picks both
 * the pixels and the colour. The pattern is five columns of blocks mirrored around the
 * middle, so it is symmetric like a face and stable for a given account; the ink and its
 * ground are one hue from the same hash. Colours are written onto the elements rather than
 * taken from tokens: an avatar must not change meaning with the theme.
 */

/** How wide the picture is, once the browser has squared and scaled an upload. */
export const AVATAR_UPLOAD_SIZE = 256

/** FNV-1a, so that neighbouring ids do not produce neighbouring avatars. */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Blocks across and down. Odd, so the middle column is its own. */
export const AVATAR_COLUMNS = 5

/** One row's left half, then the mirror of it. Deterministic for a given seed. */
export function avatarPattern(seed: string): boolean[][] {
  let state = hash(seed)
  const half = Math.ceil(AVATAR_COLUMNS / 2)

  return Array.from({ length: AVATAR_COLUMNS }, () => {
    const left = Array.from({ length: half }, () => {
      // A linear congruential step: many independent-looking draws from one seed.
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return (state & 0x8000) !== 0
    })
    return [...left, ...left.slice(0, AVATAR_COLUMNS - half).reverse()]
  })
}

/**
 * The ink and the ground it sits on, from the same hash: one hue, so an identicon reads as
 * somebody's colour rather than a palette entry.
 */
export function avatarColors(seed: string): { ink: string; ground: string } {
  const hue = hash(`${seed}:hue`) % 360
  return { ink: `hsl(${hue} 45% 45%)`, ground: `hsl(${hue} 35% 93%)` }
}

/** What the API will take: the two formats it can decode (`avatarMimeTypes`). */
export const AVATAR_TYPES = ['image/png', 'image/jpeg'] as const

/** The size the API enforces (`MaxAvatarBytes`), checked first so nothing huge is read. */
export const AVATAR_MAX_BYTES = 512 << 10

/** The API's floor (`validateAvatar`): under this it is not a picture of anything. */
export const AVATAR_MIN_SIDE = 16

/** Past this, squaring the picture keeps a strip of it: 3:1 either way. */
export const AVATAR_MAX_RATIO = 3

/** Why a picture was refused before it was sent. Each one gets its own sentence. */
export type AvatarProblem = 'type' | 'size' | 'small' | 'shape' | 'broken'

/** The free checks: the type the API accepts, and the size it accepts. No decoding. */
export function avatarFileProblem(file: { type: string; size: number }): AvatarProblem | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'type'
  if (file.size > AVATAR_MAX_BYTES) return 'size'
  return null
}

/** Once decoded: what a centre crop would throw away. */
export function avatarShapeProblem(width: number, height: number): AvatarProblem | null {
  if (width < AVATAR_MIN_SIDE || height < AVATAR_MIN_SIDE) return 'small'
  const long = Math.max(width, height)
  const short = Math.min(width, height)
  return long / short > AVATAR_MAX_RATIO ? 'shape' : null
}

/** A picture squared and encoded, or the reason it never leaves the browser. */
export type AvatarUpload =
  { blob: Blob; problem?: undefined } | { blob?: undefined; problem: AvatarProblem }

/**
 * Everything that happens between choosing a file and sending it: the cheap checks, the
 * decode, the shape check, then the square. Refusing here means the reason is known and the
 * request is never made — the server still validates, it is just no longer the first to
 * find out.
 */
export async function prepareAvatar(file: File): Promise<AvatarUpload> {
  const fileProblem = avatarFileProblem(file)
  if (fileProblem) return { problem: fileProblem }

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return { problem: 'broken' }
  try {
    const shapeProblem = avatarShapeProblem(bitmap.width, bitmap.height)
    if (shapeProblem) return { problem: shapeProblem }
    return { blob: await squareToAvatar(bitmap) }
  } finally {
    bitmap.close()
  }
}

/**
 * Squares a decoded picture and scales it down, in the browser. The server validates what
 * it receives but never resizes anything, so this is where the work belongs.
 */
export async function squareToAvatar(bitmap: ImageBitmap): Promise<Blob> {
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_UPLOAD_SIZE
  canvas.height = AVATAR_UPLOAD_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas is not available')

  // Centre crop: the middle of a portrait is the part worth keeping.
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_UPLOAD_SIZE,
    AVATAR_UPLOAD_SIZE,
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  )
  if (!blob) throw new Error('the browser could not encode the picture')
  return blob
}
