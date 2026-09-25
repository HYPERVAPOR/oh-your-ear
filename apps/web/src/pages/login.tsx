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
import { cn } from '@/lib/utils'

const RESEND_SECONDS = 60

/** The two credentials an email account can use. A code signs in and registers at once; a
 *  password only works for an account that already set one. */
const MODES = ['code', 'password'] as const
type Mode = (typeof MODES)[number]

/** Google's mark, in its own four colours. A brand mark is allowed to be the one thing on
 *  the page that is not our palette: it has to be recognised at a glance, and a monochrome
 *  G reads as "some icon". The four fills are the brand's own values, not tokens. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function Login() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)

  const [mode, setMode] = useState<Mode>('code')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  // One message per field, each under the field it is about: sending a code can fail on the
  // address, signing in can fail on the credential, and neither belongs at the bottom of
  // the card. Every line is always drawn (see `Field`), so a failure never changes the
  // card's height — this page used to jump by a line every time the code was wrong. The
  // credential field carries the same line in both modes, which is also what keeps the two
  // modes the same height.
  const [emailError, setEmailError] = useState<string>()
  const [credentialError, setCredentialError] = useState<string>()

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

  function switchMode(value: Mode) {
    if (value === mode) return
    setMode(value)
    // The credential does not carry across: a code is not a password, and the message that
    // went with it no longer applies.
    setCode('')
    setPassword('')
    setCredentialError(undefined)
  }

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
    setCredentialError(undefined)
    const { data, response } = await apiClient.POST('/auth/login', {
      body: mode === 'code' ? { email, code } : { email, password },
    })
    setBusy(false)

    if (!data) {
      const key =
        response.status === 429
          ? 'auth.tooManyRequests'
          : mode === 'code'
            ? 'auth.invalidCode'
            : 'auth.invalidCredentials'
      setCredentialError(t(key))
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

  const ready = mode === 'code' ? code.length === 6 : password.length > 0

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
          <p className="mt-2 text-[15px] text-body">
            {t(mode === 'code' ? 'auth.subtitle' : 'auth.passwordSubtitle')}
          </p>

          {/* The same welded group the header's keys use: one outline, one rule between
              neighbours, no gap. Two modes of one thing, so the same object as Learn and
              Random on the dashboard. */}
          <div
            role="group"
            aria-label={t('auth.loginMode')}
            className="mt-6 inline-flex items-stretch divide-x divide-hairline-strong border border-hairline-strong"
          >
            {MODES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
                className={cn(
                  'h-10 px-4 text-[15px] transition-colors',
                  mode === value ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {t(value === 'code' ? 'auth.loginWithCode' : 'auth.loginWithPassword')}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-5" onSubmit={submit}>
            {/* `hint=""` holds this field's message line open: the card has to be the same
                height whether or not there is something to say. */}
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

            {mode === 'code' ? (
              <Field
                label={t('auth.code')}
                htmlFor="code"
                hint={sent ? t('auth.codeSentHint') : ''}
                error={credentialError}
              >
                {/* Welded, like the header's icon group (DESIGN §2): one outline around the
                    pair, one rule between them, no gap and no second border. They are then
                    one height — the input's — because `items-stretch` leaves the button no
                    height of its own. The ink border the input used to draw around itself
                    moves out to the wrapper as `focus-within`, or a focused field would have
                    no visible indicator at all.

                    The rule sits on the input's right edge, not on the button and not via
                    `divide-x`: `divide-x` also targets the first child (erased by its own
                    `border-0`), and a border on the button loses its colour whenever the
                    button is disabled — `disabled:border-transparent` is in the shared button
                    base — so the rule would blink in and out as the address is typed. */}
                <div className="flex items-stretch border border-hairline-strong focus-within:border-ink">
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setCredentialError(undefined)
                    }}
                    className="border-0 border-r border-hairline-strong bg-transparent tracking-[0.3em] focus:border-hairline-strong"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto shrink-0 px-4"
                    disabled={busy || !email || cooldown > 0}
                    onClick={sendCode}
                  >
                    {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.sendCode')}
                  </Button>
                </div>
              </Field>
            ) : (
              /* The password has no button beside it, so this field is the input alone —
                 and the input is what set the height of the row above, which is why the
                 card does not move when the mode changes. */
              <Field label={t('auth.password')} htmlFor="password" hint="" error={credentialError}>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setCredentialError(undefined)
                  }}
                />
              </Field>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy || !ready}>
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
