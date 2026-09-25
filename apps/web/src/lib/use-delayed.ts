import { useEffect, useState } from 'react'

/**
 * True once `ms` have passed with `active` still true. A loading state that lives for a
 * couple of frames is worse than none — it reads as a grey flash, and any animation in it
 * is still on its first frame. Waiting first means the skeleton only appears when there is
 * something to wait for, which is also the only time it can look like it is working.
 */
export function useDelayed(active: boolean, ms = 250): boolean {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setShown(true), ms)
    return () => clearTimeout(timer)
  }, [active, ms])

  // Derived rather than reset in the effect: `active` going false has to hide it at once,
  // and setting state from an effect to do that is a render for nothing. `active` settles
  // once per mount here (the session restore finishes), so `shown` never needs clearing.
  return active && shown
}
