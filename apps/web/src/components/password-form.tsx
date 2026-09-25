import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useAuthStore } from '@/stores/auth-store'

/** Set a password, or replace the one there is.
 *
 *  The first password needs no current one: the session that sets it came from a
 *  verification code, which already proved the address (PRD 5.10). After that the current
 *  password is required — a session can be a stolen cookie, the old password cannot. */
export function PasswordForm() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  const hasPassword = user?.hasPassword ?? false

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(undefined)
    setSaved(false)

    const { response } = await apiClient.PUT('/me/password', {
      body: {
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      },
    })
    setSaving(false)

    if (!response.ok) {
      // 403 is the current password being wrong; anything else the caller can cause is a
      // new password the server refused (too short, or past bcrypt's 72 bytes).
      setError(t(response.status === 403 ? 'auth.wrongPassword' : 'auth.passwordTooShort'))
      return
    }

    setCurrent('')
    setNext('')
    setSaved(true)
    // Read the account back rather than assuming: `hasPassword` is what decides whether the
    // form asks for a current password next time.
    const { data } = await apiClient.GET('/auth/me')
    if (data) setUser(data)
  }

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-[22px] font-medium leading-tight">{t('auth.password')}</h2>
      {!hasPassword && <p className="mt-2 text-[15px] text-body">{t('auth.passwordHint')}</p>}

      <form className="mt-6 space-y-5" onSubmit={save}>
        {hasPassword && (
          <Field label={t('auth.currentPassword')} htmlFor="current-password" hint="" error={error}>
            <Input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value)
                setError(undefined)
              }}
            />
          </Field>
        )}

        <Field
          label={t('auth.newPassword')}
          htmlFor="new-password"
          hint={saved ? t('auth.passwordSaved') : ''}
          error={hasPassword ? undefined : error}
        >
          <Input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value)
              setError(undefined)
              setSaved(false)
            }}
          />
        </Field>

        <Button
          type="submit"
          disabled={saving || next.length < 8 || (hasPassword && current.length === 0)}
        >
          {t(hasPassword ? 'auth.changePassword' : 'auth.setPassword')}
        </Button>
      </form>
    </Card>
  )
}
