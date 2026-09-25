import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { resetPath, safeNext, signupPath } from '@/lib/auth'
import { useEmailCode } from '@/lib/use-email-code'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

/** The two credentials an email account can sign in with: a code, or a password once the
 *  account has one. Registering used to be a mode of this page; it has its own now. */
const MODES = ['code', 'password'] as const
type Mode = (typeof MODES)[number]

/** Signing in. */
export function Login() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)
  const code = useEmailCode()

  const [mode, setMode] = useState<Mode>('code')
  const [email, setEmail] = useState('')
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [credentialError, setCredentialError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // Where to land after signing in. The query string is the mechanism, the router state
  // is the older one kept working for links already in flight.
  const next = safeNext(
    new URLSearchParams(location.search).get('next') ??
      (location.state as { from?: string } | null)?.from,
  )

  function switchMode(value: Mode) {
    if (value === mode) return
    setMode(value)
    // The credential does not carry across: a code is not a password, and the message that
    // went with it no longer applies.
    setTyped('')
    setPassword('')
    setCredentialError(undefined)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setCredentialError(undefined)
    const { data, response } = await apiClient.POST('/auth/login', {
      body: mode === 'code' ? { email, code: typed } : { email, password },
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

  const ready = mode === 'code' ? typed.length === 6 : password.length > 0

  return (
    <AuthCard
      title={t('auth.loginTitle')}
      subtitle={t(mode === 'code' ? 'auth.loginSubtitle' : 'auth.passwordSubtitle')}
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
            height whether or not there is something to say. One message per field, each
            under the field it is about. */}
        <Field label={t('auth.email')} htmlFor="email" hint="" error={code.error}>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              code.clearError()
            }}
          />
        </Field>

        {mode === 'code' ? (
          <Field
            label={t('auth.code')}
            htmlFor="code"
            hint={code.sent ? t('auth.codeSentHint') : ''}
            error={credentialError}
          >
            {/* Welded, like the header's icon group (DESIGN §2): one outline around the
                pair, one rule between them, no gap and no second border. They are then
                one height — the input's — because `items-stretch` leaves the button no
                height of its own. The rule sits on the input's right edge rather than via
                `divide-x`, which also targets the first child. */}
            <div className="flex items-stretch border border-hairline-strong focus-within:border-ink">
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setCredentialError(undefined)
                }}
                className="border-0 border-r border-hairline-strong bg-transparent tracking-[0.3em] focus:border-hairline-strong"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-auto shrink-0 px-4"
                disabled={code.busy || !email || code.cooldown > 0}
                onClick={() => code.send(email)}
              >
                {code.cooldown > 0
                  ? t('auth.resendIn', { seconds: code.cooldown })
                  : t('auth.sendCode')}
              </Button>
            </div>
          </Field>
        ) : (
          /* The password has no button beside it, so this field is the input alone — and
             the input is what set the height of the row above, which is why the card does
             not move when the mode changes. */
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

        <div className="space-y-3">
          <Button type="submit" size="lg" className="w-full" disabled={busy || !ready}>
            {t('auth.submit')}
          </Button>
          {/* In both modes on purpose: a line that came and went would change the card's
              height when the mode did. */}
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
