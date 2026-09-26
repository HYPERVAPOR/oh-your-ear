import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AuthCard } from '@/components/auth/auth-card'
import { EmailArrow } from '@/components/auth/email-arrow'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { loginPath, safeNext } from '@/lib/auth'
import { useEmailCode } from '@/lib/use-email-code'
import { useAuthStore } from '@/stores/auth-store'

/** The shortest a password may be, mirroring the server's policy (PRD 5.10). */
const MIN_PASSWORD = 8

/**
 * Resetting a forgotten password: the address, then the code and the new password together.
 *
 * This is the one path that sets a password without the old one, and the code is what stands
 * in for it — the same code that would have signed the reader in, which is also why the answer
 * to this form is a session rather than a second trip through /login.
 *
 * As on sign-up, the step lives in the URL (`?email=`) so a reload does not send the reader
 * back to the address step with a code already in hand.
 *
 * No Google button on this card: see AuthCard.
 */
export function Reset() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const code = useEmailCode()

  const emailed = params.get('email') ?? ''
  const [email, setEmail] = useState(emailed)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // Which field the failure belongs to: a wrong code is about the code, a refused or repeated
  // password is about the password. One message, drawn under the field it is about.
  const [failure, setFailure] = useState<{ field: 'code' | 'password' | 'confirm'; key: string }>()
  const [busy, setBusy] = useState(false)

  const next = safeNext(new URLSearchParams(location.search).get('next'))

  async function askForCode(event: React.FormEvent) {
    event.preventDefault()
    if (await code.send(email)) {
      setParams((current) => {
        current.set('email', email)
        return current
      })
    }
  }

  function useAnotherAddress() {
    setParams((current) => {
      current.delete('email')
      return current
    })
    code.restart()
  }

  async function reset(event: React.FormEvent) {
    event.preventDefault()
    // Twice, and checked here rather than by the server: a repeated field exists for the typo in
    // front of it, and a round trip cannot catch that — both copies would be the same typo.
    if (password !== confirm) {
      setFailure({ field: 'confirm', key: 'auth.passwordMismatch' })
      return
    }

    setBusy(true)
    setFailure(undefined)
    const { data, response } = await apiClient.POST('/auth/password/reset', {
      body: { email: emailed, code: typed, newPassword: password },
    })
    setBusy(false)

    if (!data) {
      if (response.status === 429) {
        setFailure({ field: 'code', key: 'auth.tooManyRequests' })
      } else if (response.status === 401) {
        setFailure({ field: 'code', key: 'auth.invalidCode' })
      } else {
        setFailure({ field: 'password', key: 'auth.passwordTooShort' })
      }
      return
    }
    setSession(data.accessToken, data.user)
    navigate(next, { replace: true })
  }

  return (
    <AuthCard
      title={t('auth.resetTitle')}
      next={next}
      withGoogle={false}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to={loginPath(next)} className="underline underline-offset-4">
            {t('auth.goLogin')}
          </Link>
        </>
      }
    >
      {!emailed ? (
        <form className="mt-6 space-y-5" onSubmit={askForCode}>
          <EmailArrow
            id="email"
            label={t('auth.email')}
            value={email}
            error={code.error}
            busy={code.busy}
            onChange={(value) => {
              setEmail(value)
              code.clearError()
            }}
          />
        </form>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={reset}>
          {/* Same hidden username field as the sign-up screen, same reason: this form
              carries the new password, so the address it belongs to has to be in it for
              the password manager to key the credential on the account rather than on
              the site alone. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            defaultValue={emailed}
            hidden
          />
          <Field
            label={t('auth.code')}
            htmlFor="code"
            hint={t('auth.codeSentTo', { email: emailed })}
            error={(failure?.field === 'code' && t(failure.key)) || code.error}
          >
            <div className="flex items-stretch border border-hairline-strong focus-within:border-ink">
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setFailure(undefined)
                }}
                className="border-0 border-r border-hairline-strong bg-transparent tracking-[0.3em] focus:border-hairline-strong"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-auto shrink-0 px-4"
                disabled={code.busy || code.cooldown > 0}
                onClick={() => code.send(emailed)}
              >
                {code.cooldown > 0
                  ? t('auth.resendIn', { seconds: code.cooldown })
                  : t('auth.sendCode')}
              </Button>
            </div>
          </Field>

          <Field
            label={t('auth.newPassword')}
            htmlFor="new-password"
            hint=""
            error={failure?.field === 'password' ? t(failure.key) : undefined}
          >
            <Input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setFailure(undefined)
              }}
            />
          </Field>

          <Field
            label={t('auth.confirmPassword')}
            htmlFor="confirm-password"
            hint=""
            error={failure?.field === 'confirm' ? t(failure.key) : undefined}
          >
            <Input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setFailure(undefined)
              }}
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy || typed.length !== 6 || password.length < MIN_PASSWORD || !confirm}
          >
            {t('auth.resetSubmit')}
          </Button>

          <p className="text-right text-[14px]">
            <button
              type="button"
              onClick={useAnotherAddress}
              className="text-muted underline underline-offset-4 hover:text-ink"
            >
              {t('auth.changeEmail')}
            </button>
          </p>
        </form>
      )}
    </AuthCard>
  )
}
