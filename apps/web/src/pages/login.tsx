import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { Nameplate } from '@/components/nameplate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { safeNext } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

const RESEND_SECONDS = 60

/** Google's mark in one path and the button's own ink. The four brand colours are the one
 *  thing this page cannot carry: they would be the only colour on a monochrome screen, and
 *  the product's single colour from outside the palette is an avatar's. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  )
}

export function Login() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  // One message per field, each under the field it is about: sending a code can fail on
  // the address, submitting can fail on the code, and neither belongs at the bottom of
  // the card. Both lines are always drawn (see `Field`), so a failure never changes the
  // card's height — this page used to jump by a line every time the code was wrong.
  const [emailError, setEmailError] = useState<string>()
  const [codeError, setCodeError] = useState<string>()

  // Where to land after signing in. The query string is the mechanism, the router state
  // is the older one kept working for links already in flight.
  const next = safeNext(
    new URLSearchParams(location.search).get('next') ??
      (location.state as { from?: string } | null)?.from,
  )

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    setBusy(true)
    setEmailError(undefined)
    const { response } = await apiClient.POST('/auth/code', { body: { email } })
    setBusy(false)

    if (response.status === 204) {
      setSent(true)
      setCooldown(RESEND_SECONDS)
      return
    }
    setEmailError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidEmail'))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setCodeError(undefined)
    const { data, response } = await apiClient.POST('/auth/login', { body: { email, code } })
    setBusy(false)

    if (!data) {
      setCodeError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidCode'))
      return
    }
    setSession(data.accessToken, data.user)
    navigate(next, { replace: true })
  }

  const loginWithMock = useCallback(async () => {
    const res = await fetch('/api/v1/auth/mock', { method: 'POST', credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setSession(data.accessToken, data.user)
    navigate(next, { replace: true })
  }, [next, navigate, setSession])

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px]">
        <Card className="p-7">
          {/* The nameplate the landing page and the app's header wear, at the top-left of
              the card: this box is the page, so the mark belongs to it rather than to a
              bar above it. Nothing beside it — the card is a form, not a room. */}
          <Nameplate />

          <h1 className="font-display mt-6 text-[28px] font-medium leading-tight">
            {t('auth.title')}
          </h1>
          <p className="mt-2 text-[15px] text-body">{t('auth.subtitle')}</p>

          <form className="mt-7 space-y-5" onSubmit={submit}>
            {/* `hint=""` holds this field's message line open: the card has to be the
                  same height whether or not there is something to say. */}
            <Field label={t('auth.email')} htmlFor="email" hint="" error={emailError}>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError(undefined)
                }}
              />
            </Field>

            <Field
              label={t('auth.code')}
              htmlFor="code"
              hint={sent ? t('auth.codeSentHint') : ''}
              error={codeError}
            >
              <div className="flex gap-2">
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setCodeError(undefined)
                  }}
                  className="tracking-[0.3em]"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={busy || !email || cooldown > 0}
                  onClick={sendCode}
                >
                  {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.sendCode')}
                </Button>
              </div>
            </Field>

            <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>
              {t('auth.submit')}
            </Button>
          </form>

          <div className="my-6 border-t border-hairline" />

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Google's redirect has to carry the destination too: it leaves this
                // page entirely, so the query string is all that survives.
                window.location.href = `/api/v1/auth/google?next=${encodeURIComponent(next)}`
              }}
            >
              <GoogleMark />
              {t('auth.loginWithGoogle')}
            </Button>
            {import.meta.env.DEV && (
              <Button variant="ghost" className="w-full" onClick={loginWithMock}>
                {t('auth.loginMock')}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-6 text-center text-[14px] text-muted">
          <Link to="/" className="underline underline-offset-4">
            {t('auth.backHome')}
          </Link>
        </p>
      </div>
    </div>
  )
}
