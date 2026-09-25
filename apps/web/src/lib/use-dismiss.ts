import { useEffect, type RefObject } from 'react'

/**
 * Closes a floating panel when the reader clicks away from it or presses Esc.
 *
 * The listener is `pointerdown`, not `click`: a panel that waits for the click to finish
 * has already been left behind by the time it closes, and on a drag the click never
 * arrives at all.
 *
 * `ref` has to hold the trigger button as well as the panel. A press on the trigger is
 * outside the panel but inside the control, and closing on it would race the button's own
 * toggle: the panel would close and immediately reopen.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) close()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close, ref])
}
