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
            'border-0 bg-transparent focus:border-transparent',
            ready && 'border-r border-hairline-strong',
          )}
        />
        {ready && (
          <Button
            type="submit"
            variant="ghost"
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
