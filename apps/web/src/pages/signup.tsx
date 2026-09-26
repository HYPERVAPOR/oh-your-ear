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
 * Registering, one question at a time: the address, then the code, then a password.
 *
 * The address goes first because it is the only thing that cannot be guessed, and the arrow
 * that submits it appears only once the field holds something the browser itself accepts as an
 * address — there is no second grammar for what an email looks like here.
 *
 * The address is then checked: one that already has an account is sent to sign in instead of
 * through a code it does not need (see the note on /auth/email/check — that check is the one
 * place this product answers "is this address registered").
 *
 * Registering ends by setting a password, because signing in now needs one: without this step a
 * new account would have to go through "forgot your password" the first time it came back.
 *
 * Which step you are on lives in the URL (`?email=` and `?step=password`), not in component
 * state: a reload on the code step would otherwise drop the reader back to the address step,
 * where the resend button answers with the cooldown for a code they already have.
 */
export function Signup() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const code = useEmailCode()

  const emailed = params.get('email') ?? ''
  const step: 'email' | 'code' | 'password' = !emailed
    ? 'email'
    : params.get('step') === 'password'
      ? 'password'
      : 'code'

  const [email, setEmail] = useState(emailed)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // Which field the failure belongs to, so one message can sit under the right one.
  const [failure, setFailure] = useState<{ field: 'email' | 'code' | 'confirm'; key: string }>()
  const [busy, setBusy] = useState(false)

  const next = safeNext(new URLSearchParams(location.search).get('next'))

  async function askForCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure(undefined)

    const { data } = await apiClient.POST('/auth/email/check', { body: { email } })
    if (data?.registered) {
      setBusy(false)
      setFailure({ field: 'email', key: 'auth.emailTaken' })
      return
    }

    const sent = await code.send(email)
    setBusy(false)
    if (sent) {
      // Only the address is added: `next` is already in the query string and has to stay.
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

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure(undefined)
    const { data, response } = await apiClient.POST('/auth/register', {
      body: { email: emailed, code: typed },
    })
    setBusy(false)

    if (!data) {
      setFailure({
        field: 'code',
        key: response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidCode',
      })
      return
    }

    // Signed in without a password. The last step is the one that leaves the account usable on
    // the sign-in screen, so it comes before `next`: this is part of registering.
    setSession(data.accessToken, data.user)
    setParams((current) => {
      current.set('step', 'password')
      return current
    })
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setFailure({ field: 'confirm', key: 'auth.passwordMismatch' })
      return
    }

    setBusy(true)
    setFailure(undefined)
    // No current password: this account has none yet, which is what makes it the first one.
    const { response } = await apiClient.PUT('/me/password', { body: { newPassword: password } })
    setBusy(false)

    if (!response.ok) {
      setFailure({ field: 'confirm', key: 'auth.passwordTooShort' })
      return
    }
    navigate(next, { replace: true })
  }

  const footer = (
    <>
      {t('auth.haveAccount')}{' '}
      <Link to={loginPath(next, email)} className="underline underline-offset-4">
        {t('auth.goLogin')}
      </Link>
    </>
  )

  return (
    <AuthCard
      title={t('auth.signupTitle')}
      subtitle={step === 'password' ? t('auth.setPasswordStep') : undefined}
      next={next}
      footer={footer}
    >
      {step === 'email' && (
        <form className="mt-6 space-y-5" onSubmit={askForCode}>
          <EmailArrow
            id="email"
            label={t('auth.email')}
            value={email}
            error={failure?.field === 'email' ? t(failure.key) : code.error}
            busy={busy}
            onChange={(value) => {
              setEmail(value)
              setFailure(undefined)
              code.clearError()
            }}
          />
        </form>
      )}

      {step === 'code' && (
        <form className="mt-6 space-y-5" onSubmit={create}>
          {/* The address stays on screen as the code field's hint: this is the one screen
              where the reader has to check which address the mail went to. */}
          <Field
            label={t('auth.code')}
            htmlFor="code"
            hint={t('auth.codeSentTo', { email: emailed })}
            error={failure?.field === 'code' ? t(failure.key) : undefined}
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

          <Button type="submit" size="lg" className="w-full" disabled={busy || typed.length !== 6}>
            {t('auth.createAccount')}
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

      {step === 'password' && (
        <form className="mt-6 space-y-5" onSubmit={savePassword}>
          {/* The address rides along as a hidden username field. Chrome only reads a form
              as a sign-up form — which is what offers "Suggest password" — when the
              account being created is visible in it, and it stores the password against
              that address instead of storing a nameless one. It is hidden, not shown,
              because it is not editable here: the session, not this field, is what
              `PUT /me/password` authorises. Chromium's own guidance for an "email first"
              flow is exactly this, hidden with CSS included. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            defaultValue={emailed}
            hidden
          />
          <Field label={t('auth.newPassword')} htmlFor="new-password" hint="">
            <Input
              id="new-password"
              type="password"
              required
              autoFocus
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
            disabled={busy || password.length < MIN_PASSWORD || confirm.length === 0}
          >
            {t('auth.setPassword')}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
