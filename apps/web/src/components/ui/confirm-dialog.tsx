import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

/** One question, two answers, in the browser's own modal.
 *
 *  `<dialog>` + `showModal()` is the whole implementation: the focus trap, Esc, the inert
 *  page behind, the top layer and the `::backdrop` all belong to the platform. A dialog
 *  library would be a dependency to rediscover that.
 *
 *  Two things the element does not do by itself, and both are one line:
 *
 *  - It does not close when the backdrop is clicked. Here that click is the *safe* answer,
 *    so it should work.
 *  - It does not tell us when it closed itself (Esc), so the listener syncs our state back
 *    up before the two drift apart.
 *
 *  `onDismiss` is every "this question is over" path: Esc, the backdrop, the cancel button —
 *  and the confirm button too, because answering a question ends it. Leaving that last one
 *  to the caller is how a dialog stays on screen after the thing it asked about has already
 *  happened (which is exactly what it did: the header is on every page, so signing out from
 *  the home page left the box sitting there). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onDismiss,
  destructive,
}: {
  open: boolean
  title: string
  /** The sentence under the question. Only questions with a consequence to spell out need
   *  one — "sign out?" does not, "this cannot be undone" does. */
  description?: string
  confirmLabel: string
  onConfirm: () => void
  /** Close, whether anything was done or not. Also called after `onConfirm`. */
  onDismiss: () => void
  /** True when the confirm button does something that cannot be taken back: it wears the
   *  destructive control instead of the ink one. The header's "sign out?" does not. */
  destructive?: boolean
}) {
  const { t } = useTranslation('common')
  const ref = useRef<HTMLDialogElement>(null)
  // Two of these can be mounted at once (the header has one, /me has one), so the title's id
  // has to be per instance: a duplicate id makes aria-labelledby resolve to whichever node
  // the browser happens to find first, which may be the hidden one.
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc: the element closes itself, so this only has to catch the state up.
      onCancel={onDismiss}
      onClick={(event) => {
        if (event.target === ref.current) onDismiss()
      }}
      className="m-auto w-[min(384px,calc(100vw-2rem))] border border-hairline-strong bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <h2 id={titleId} className="px-6 pt-6 text-[18px] leading-snug font-medium">
        {title}
      </h2>

      {description && <p className="px-6 pt-2 text-[14px] text-muted">{description}</p>}

      <div className="flex justify-end gap-2 px-6 pt-6 pb-6">
        <Button variant="outline" onClick={onDismiss}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          onClick={() => {
            onConfirm()
            onDismiss()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
