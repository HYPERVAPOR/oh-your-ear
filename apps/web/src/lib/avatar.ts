/**
 * The generated pixel avatar, and the two small jobs around it.
 *
 * A pattern is five columns of pixels mirrored around the middle, drawn from the account's
 * id: symmetric like a face, different for almost every account, and identical every time
 * the same account asks. Nothing is stored, so an account with no picture still has one.
 */

/** Width and height of the pattern, in pixels. Odd, so the middle column is its own. */
export const AVATAR_COLUMNS = 5

/** How wide the picture is, once the browser has squared and scaled an upload. */
export const AVATAR_UPLOAD_SIZE = 256

/** Where the server serves a picture a reader uploaded. Anything else is the provider's. */
const UPLOADED_PREFIX = '/api/v1/me/avatar'

/** Whether the URL in hand is one of ours (an upload) rather than the sign-in provider's. */
export function isUploadedAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith(UPLOADED_PREFIX)
}

/** FNV-1a, so that neighbouring ids do not produce neighbouring patterns. */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

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
 * Squares an uploaded picture and scales it down, in the browser. The server validates
 * what it receives but never resizes anything, so this is where the work belongs — and it
 * happens before a single byte is uploaded.
 */
export async function scaleToAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
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
  } finally {
    bitmap.close()
  }
}
