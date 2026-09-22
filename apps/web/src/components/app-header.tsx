import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Ear, LogOut, SquareUser } from 'lucide-react'

import { loginHere } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageKey, ThemeKey, iconGroup, iconKey } from '@oh-your-ear/shared/pref-controls'

const icon = 'h-4 w-4'

/** The marketing site. The default is the real domain, so production needs no variable;
 *  dev points it at the landing's own dev server (see compose.dev.yml). */
const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://ohyourear.com'

/** 64px nav shared by every screen: nameplate left, quiet icon keys right. The language
 *  and theme keys come from the shared package, so the landing site offers the same two
 *  switches — a reader should not be able to tell which of the two sites they are on
 *  from the controls alone. */
export function AppHeader() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="border-b border-hairline px-6">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
        {/* One nameplate, not a glyph beside a label: the mark and the wordmark share a
            single hairline box, divided by a rule, the way a device is silkscreened onto
            a panel. It is also the way back to the marketing site — this is the product,
            not the front door — and its hover takes the hairline one step darker, because
            `hover:border-ink` jumped to near-white in the dark theme and glared. */}
        <a
          href={LANDING_URL}
          className="group flex items-center border border-hairline-strong text-ink transition-colors hover:border-hairline-hover"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center transition-colors sm:border-r sm:border-hairline-strong sm:group-hover:border-hairline-hover">
            <Ear aria-hidden="true" className={icon} strokeWidth={1.75} />
          </span>
          {/* On phones the mark carries the brand on its own: with the wordmark the
              header wraps to two rows at 390px. Small, uppercase and letter-spaced, it
              reads as a machine label instead of a headline — that is what keeps it in
              the same object as the mark. */}
          <span className="font-display hidden px-2.5 text-[12px] font-medium uppercase leading-none tracking-[0.14em] sm:inline">
            {t('appName')}
          </span>
        </a>

        {/* The switches and the action they sit next to, as one cluster at the right
            edge: language and theme immediately left of the login button. */}
        <div className="flex items-center gap-2">
          {/* One welded piece rather than a row of loose squares: see iconGroup. */}
          <nav className={iconGroup}>
            <LanguageKey />
            <ThemeKey />

            {user
              ? /* The account page shows its own header actions: repeating them here is
               noise, and they are what pushes the nav onto a second row at 390px. */
                location.pathname !== '/me' && (
                  <>
                    <Link
                      to="/me"
                      className={`${iconKey} no-underline`}
                      aria-label={t('auth.account')}
                      title={t('auth.account')}
                    >
                      <SquareUser aria-hidden="true" className={icon} strokeWidth={1.75} />
                    </Link>
                    <button
                      type="button"
                      className={iconKey}
                      aria-label={t('actions.logout')}
                      title={t('actions.logout')}
                      onClick={handleLogout}
                    >
                      <LogOut aria-hidden="true" className={icon} strokeWidth={1.75} />
                    </button>
                  </>
                )
              : null}
          </nav>

          {/* A word, not a glyph: an icon in a header full of icons does not read as the
              first move. Outside the welded group because a label would fight the 32px
              squares' rhythm — it keeps their height and nothing else. */}
          {!user && (
            <Link
              to={loginHere()}
              className="inline-flex h-8 items-center bg-primary px-3 text-[13px] font-medium text-on-primary transition-opacity hover:opacity-90"
            >
              {t('actions.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
