/**
 * Two small jobs around the avatar: telling an upload from a provider picture, and
 * squaring an uploaded one before it is sent. The default picture itself is a bitmap in
 * `public/` — white paper, black pixels, the same in both themes — so nothing here draws
 * it.
 */

/** How wide the picture is, once the browser has squared and scaled an upload. */
export const AVATAR_UPLOAD_SIZE = 256

/** Where the server serves a picture a reader uploaded. Anything else is the provider's. */
const UPLOADED_PREFIX = '/api/v1/me/avatar'

/** Whether the URL in hand is one of ours (an upload) rather than the sign-in provider's. */
export function isUploadedAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith(UPLOADED_PREFIX)
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
