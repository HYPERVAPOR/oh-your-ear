import { useEffect, useState } from 'react'

/** How long a load has to run before the skeleton is worth drawing. */
const SHOW_AFTER = 100

/** And how long it stays once drawn, so the pulse completes a visible arc instead of a flicker. */
const KEEP_FOR = 400

/**
 * Whether the skeleton should be on screen. Two mistakes it avoids, both measured:
 *
 * - A skeleton that appears for 30ms is a grey flash, and the pulse never leaves its first
 *   frame, so it reads as a static patch. Waiting first means it only appears when there is
 *   something to wait for.
 * - A skeleton that appears and disappears inside a few frames flickers. Once it is up it
 *   stays for a moment, so what a reader sees is one loading state, not two.
 *
 * Nothing is held back artificially: a load that finishes before SHOW_AFTER draws no
 * skeleton at all and sees no delay.
 */
export function useDelayedLoading(active: boolean): boolean {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => setShown(true), SHOW_AFTER)
      return () => clearTimeout(timer)
    }
    // Finished: keep it up for the rest of its turn, but only if it ever appeared.
    if (!shown) return
    const timer = setTimeout(() => setShown(false), KEEP_FOR)
    return () => clearTimeout(timer)
  }, [active, shown])

  return shown
}
