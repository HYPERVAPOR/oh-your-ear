import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useAuthStore } from '@/stores/auth-store'

const RESEND_SECONDS = 60

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
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    setBusy(true)
    setError(null)
    const { response } = await apiClient.POST('/auth/code', { body: { email } })
    setBusy(false)

    if (response.status === 204) {
      setSent(true)
      setCooldown(RESEND_SECONDS)
      return
    }
    setError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidEmail'))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data, response } = await apiClient.POST('/auth/login', { body: { email, code } })
    setBusy(false)

    if (!data) {
      setError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidCode'))
      return
    }
    setSession(data.accessToken, data.user)
    navigate(from, { replace: true })
  }

  const loginWithMock = useCallback(async () => {
    const res = await fetch('/api/v1/auth/mock', { method: 'POST', credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setSession(data.accessToken, data.user)
    navigate(from, { replace: true })
  }, [from, navigate, setSession])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-[440px]">
        <Link to="/" className="font-display text-[21px] tracking-normal">
          {t('appName')}
        </Link>

        <Card className="mt-6 p-7">
          <h1 className="font-display text-[28px] font-medium leading-tight">{t('auth.title')}</h1>
          <p className="mt-2 text-[15px] text-body">{t('auth.subtitle')}</p>

          <form className="mt-7 space-y-5" onSubmit={submit}>
            <Field label={t('auth.email')} htmlFor="email">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field
              label={t('auth.code')}
              htmlFor="code"
              hint={sent ? t('auth.codeSentHint') : undefined}
            >
              <div className="flex gap-2">
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
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

            {error && <p className="text-[14px] text-error-text">{error}</p>}

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
                window.location.href = '/api/v1/auth/google'
              }}
            >
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
