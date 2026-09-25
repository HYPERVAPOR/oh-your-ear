import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { Nameplate } from '@/components/nameplate'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { loginHere } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageKey, ThemeKey, iconGroup, iconKey } from '@oh-your-ear/shared/pref-controls'

const icon = 'h-4 w-4'

/** 64px nav shared by every screen: nameplate left, quiet icon keys right. The language
 *  and theme keys come from the shared package, so the landing site offers the same two
 *  switches — a reader should not be able to tell which of the two sites they are on
 *  from the controls alone. */
export function AppHeader() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  // Signing out is one click away in a header full of one-click controls, and the click
  // that does it is the same click as its neighbours'. It asks first now.
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="border-b border-hairline px-6">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
        <Nameplate />

        {/* The switches and the action they sit next to, as one cluster at the right
            edge: language and theme immediately left of the login button. */}
        <div className="flex items-center gap-2">
          {/* One welded piece rather than a row of loose squares: see iconGroup. */}
          <nav className={iconGroup}>
            <LanguageKey />
            <ThemeKey />

            {/* One key, because there is one thing left to do with an account from here. The
                way into the account is the button on the dashboard's card, where the account's
                own page is one of the two things that card is for; a key up here in the same
                square as the logout key made signing out look like the second of two equal
                choices. The bar is still the same bar on every page. */}
            {user && (
              <button
                type="button"
                className={iconKey}
                aria-label={t('actions.logout')}
                title={t('actions.logout')}
                onClick={() => setConfirmingLogout(true)}
              >
                <LogOut aria-hidden="true" className={icon} strokeWidth={1.75} />
              </button>
            )}
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

      <ConfirmDialog
        open={confirmingLogout}
        title={t('actions.logoutConfirmTitle')}
        confirmLabel={t('actions.logout')}
        onConfirm={handleLogout}
        onDismiss={() => setConfirmingLogout(false)}
      />
    </header>
  )
}
