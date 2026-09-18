import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-md border border-border p-6">
        <h1 className="text-xl font-bold">{t('auth.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('auth.subtitle')}</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="code">
              {t('auth.code')}
            </label>
            <div className="flex gap-2">
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            {sent && <p className="text-xs text-muted-foreground">{t('auth.codeSentHint')}</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
            {t('auth.submit')}
          </Button>
        </form>

        <div className="my-5 border-t border-border" />

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

        <Link
          to="/"
          className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {t('auth.backHome')}
        </Link>
      </div>
    </div>
  )
}
