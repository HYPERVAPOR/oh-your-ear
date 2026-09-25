import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { loginPath, safeNext } from '@/lib/auth'
import { useEmailCode } from '@/lib/use-email-code'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Registering, one question at a time: the address first, and only then the code. The address
 * is the only thing that cannot be guessed, so it is the only thing the first screen asks for;
 * the code is sent when the address is known.
 *
 * Which step you are on lives in the URL (`?email=`), not in component state: a reload on the
 * code step would otherwise drop the reader back to the address step, where the resend button
 * would then answer with the cooldown for a code they already have.
 *
 * Registering is not a separate mechanism from signing in — the first code login creates the
 * account (PRD 5.10) — so this page is about asking in the right order, not about a different
 * endpoint.
 */
export function Signup() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const code = useEmailCode()

  const emailed = params.get('email') ?? ''
  const [email, setEmail] = useState(emailed)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const next = safeNext(new URLSearchParams(location.search).get('next'))

  async function askForCode(event: React.FormEvent) {
    event.preventDefault()
    if (await code.send(email)) {
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
    setError(undefined)
    const { data, response } = await apiClient.POST('/auth/register', {
      body: { email: emailed, code: typed },
    })
    setBusy(false)

    if (!data) {
      setError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidCode'))
      return
    }
    setSession(data.accessToken, data.user)
    navigate(next, { replace: true })
  }

  return (
    <AuthCard
      title={t('auth.signupTitle')}
      next={next}
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
          <Field label={t('auth.email')} htmlFor="email" hint="" error={code.error}>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                code.clearError()
              }}
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={code.busy || !email.includes('@')}
          >
            {t('auth.continue')}
          </Button>
        </form>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={create}>
          {/* The address stays on screen as the code field's hint: this is the one screen
              where the reader has to check which address the mail went to. */}
          <Field
            label={t('auth.code')}
            htmlFor="code"
            hint={t('auth.codeSentTo', { email: emailed })}
            error={(error ?? code.error) || undefined}
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
                  setError(undefined)
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
    </AuthCard>
  )
}
