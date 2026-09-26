import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/utils'

/**
 * The address step shared by sign-up and by resetting a password: one field, with the submit
 * arrow inside it.
 *
 * The arrow appears only once the field holds something the browser itself accepts as an
 * address — `type="email"`'s own validity, so there is no second grammar here for what an email
 * looks like. A button with nothing to submit is a button that should not be on screen yet.
 *
 * The rule between the two is drawn on the input's right edge, not on the button: the shared
 * button base drops its own border whenever it is disabled, which would make the rule blink.
 *
 * Both callers start with an empty field — the address only reaches the URL once this step has
 * succeeded — so `ready` can start false.
 */
export function EmailArrow({
  id,
  label,
  value,
  error,
  busy,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  busy?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('common')
  const [ready, setReady] = useState(false)

  return (
    <Field label={label} htmlFor={id} hint="" error={error}>
      <div className="flex items-stretch border border-hairline-strong focus-within:border-ink">
        <Input
          id={id}
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={value}
          onChange={(event) => {
            setReady(event.target.validity.valid)
            onChange(event.target.value)
          }}
          className={cn(
            // `focus:border-hairline-strong` overrides the base `focus:border-ink` for the same
            // reason the code row does it: the frame that lights up on focus is the wrapper's
            // (`focus-within:border-ink`), and the rule between the field and the arrow has to
            // stay put. Making it transparent on focus made the divider vanish instead.
            'border-0 bg-transparent focus:border-hairline-strong',
            ready && 'border-r border-hairline-strong',
          )}
        />
        {ready && (
          <Button
            type="submit"
            // Filled, not ghost: this is the one action on the field, and it wears the same ink
            // as every other primary action in the app — black on white, white on black, so the
            // arrow reads against the field it sits in rather than dissolving into it.
            variant="primary"
            className="h-auto shrink-0 px-3"
            disabled={busy}
            aria-label={t('auth.continue')}
            title={t('auth.continue')}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Field>
  )
}
