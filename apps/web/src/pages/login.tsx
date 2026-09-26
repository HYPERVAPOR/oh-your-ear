import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { resetPath, safeNext, signupPath } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Signing in: an address and a password, or Google.
 *
 * A verification code used to be an option here. It is not one any more, because a code is
 * how you prove an address is yours — which is what registering needs (the account does not
 * exist yet) and what resetting a password needs (there is no current password to offer).
 * Neither is true of an ordinary sign-in, where the password is the key that was chosen for
 * exactly this.
 *
 * An account with no password — registered by code, or signed up with Google — gets one
 * through "Forgot your password?", which is the same proof of address, and ends with a
 * password it can use here.
 */
export function Login() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)

  const [email, setEmail] = useState(
    // Arriving from the sign-up screen, which knows the address already.
    new URLSearchParams(location.search).get('email') ?? '',
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // Where to land after signing in. The query string is the mechanism, the router state
  // is the older one kept working for links already in flight.
  const next = safeNext(
    new URLSearchParams(location.search).get('next') ??
      (location.state as { from?: string } | null)?.from,
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    const { data, response } = await apiClient.POST('/auth/login', { body: { email, password } })
    setBusy(false)

    if (!data) {
      // One message for a wrong password and an unknown address alike: the caller must not be
      // able to tell them apart (PRD 5.10).
      setError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidCredentials'))
      return
    }
    setSession(data.accessToken, data.user)
    navigate(next, { replace: true })
  }

  return (
    <AuthCard
      title={t('auth.loginTitle')}
      next={next}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to={signupPath(next)} className="underline underline-offset-4">
            {t('auth.goSignup')}
          </Link>
        </>
      }
    >
      <form className="mt-6 space-y-5" onSubmit={submit}>
        {/* `hint=""` holds this field's message line open, so the card is the same height
            whether or not there is something to say. */}
        <Field label={t('auth.email')} htmlFor="email" hint="">
          <Input
            id="email"
            type="email"
            required
            autoFocus
            // `username` rather than `email`: password managers key the saved account on
            // this, and only `username` is understood as "the account name" on a form
            // that carries a password.
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(undefined)
            }}
          />
        </Field>

        <Field label={t('auth.password')} htmlFor="password" hint="" error={error}>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(undefined)
            }}
          />
        </Field>

        <div className="space-y-3">
          <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password}>
            {t('auth.submit')}
          </Button>
          <p className="text-right text-[14px]">
            <Link
              to={resetPath(next)}
              className="text-muted underline underline-offset-4 hover:text-ink"
            >
              {t('auth.forgotPassword')}
            </Link>
          </p>
        </div>
      </form>
    </AuthCard>
  )
}
