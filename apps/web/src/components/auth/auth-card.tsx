import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { Nameplate } from '@/components/nameplate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'

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

/**
 * The card all three account screens are built from: sign in, sign up, reset. They are the
 * same object — the nameplate the landing page and the app's header wear, one title, the
 * form, then Google — and only the form and the sentence above it change. Keeping them one
 * component is what keeps them from drifting into three similar-looking cards.
 *
 * `next` is where the reader was headed. It has to be carried by the Google button too: that
 * leaves this page entirely, so the query string is all that survives.
 */
export function AuthCard({
  title,
  subtitle,
  next,
  footer,
  children,
}: {
  title: string
  subtitle: string
  next: string
  /** One line under the card, for the link to the other account screens. */
  footer?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  // Sign in as the developer's own account, without mail. Development only.
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

          <h1 className="font-display mt-6 text-[28px] font-medium leading-tight">{title}</h1>
          <p className="mt-2 text-[15px] text-body">{subtitle}</p>

          {children}

          <div className="my-6 border-t border-hairline" />

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
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

        {footer && <p className="mt-6 text-center text-[14px] text-muted">{footer}</p>}

        <p className="mt-3 text-center text-[14px] text-muted">
          <Link to="/" className="underline underline-offset-4">
            {t('auth.backHome')}
          </Link>
        </p>
      </div>
    </div>
  )
}
