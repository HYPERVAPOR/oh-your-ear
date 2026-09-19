import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Ear, Languages, LogIn, LogOut, Monitor, Moon, SquareUser, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore, type Language, type Theme } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

/** Every control in the header is the same 32px square as the brand mark: one row of
 *  key-caps on a panel. Icons carry the meaning, the tooltip and the label carry the
 *  wording, so nothing depends on recognising a glyph. */
const iconControl =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-hairline-strong text-body transition-colors hover:border-ink hover:text-ink'

const icon = 'h-4 w-4'

/** Theme is a three-position switch, so it cycles: no menu to open, no list to draw. */
const THEME_CYCLE: Theme[] = ['system', 'light', 'dark']
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const

/** 64px nav shared by every screen: nameplate left, quiet icon keys right. */
export function AppHeader() {
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, language, setTheme, setLanguage } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const nextLanguage: Language = language === 'zh-CN' ? 'en' : 'zh-CN'
  const languageName = nextLanguage === 'zh-CN' ? '中文' : 'English'
  const ThemeIcon = THEME_ICON[theme]
  const themeLabel = `${t('settings.theme')}: ${t(`theme.${theme}`)}`

  function changeLanguage(next: Language) {
    setLanguage(next)
    i18n.changeLanguage(next)
  }

  function cycleTheme() {
    setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length])
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-2 sm:px-6">
        {/* One nameplate, not a glyph beside a label: the mark and the wordmark share a
            single hairline box, divided by a rule, the way a device is silkscreened onto
            a panel. Square and hard-edged, same as everything else. */}
        <Link
          to="/"
          className="group flex items-center border border-hairline-strong text-ink transition-colors hover:border-ink"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center transition-colors sm:border-r sm:border-hairline-strong sm:group-hover:border-ink">
            <Ear aria-hidden="true" className={icon} strokeWidth={1.75} />
          </span>
          {/* On phones the mark carries the brand on its own: with the wordmark the
              header wraps to two rows at 390px. Small, uppercase and letter-spaced, it
              reads as a machine label instead of a headline — that is what keeps it in
              the same object as the mark. */}
          <span className="font-display hidden px-2.5 text-[12px] font-medium uppercase leading-none tracking-[0.14em] sm:inline">
            {t('appName')}
          </span>
        </Link>

        <nav className="flex items-center gap-1.5">
          <button
            type="button"
            className={iconControl}
            aria-label={t('settings.switchLanguage', { language: languageName })}
            title={t('settings.switchLanguage', { language: languageName })}
            onClick={() => changeLanguage(nextLanguage)}
          >
            <Languages aria-hidden="true" className={icon} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className={iconControl}
            aria-label={themeLabel}
            title={themeLabel}
            onClick={cycleTheme}
          >
            <ThemeIcon aria-hidden="true" className={icon} strokeWidth={1.75} />
          </button>

          {user ? (
            /* The account page shows its own header actions: repeating them here is
               noise, and they are what pushes the nav onto a second row at 390px. */
            location.pathname !== '/me' && (
              <>
                <Link
                  to="/me"
                  className={`${iconControl} no-underline`}
                  aria-label={t('auth.account')}
                  title={t('auth.account')}
                >
                  <SquareUser aria-hidden="true" className={icon} strokeWidth={1.75} />
                </Link>
                <button
                  type="button"
                  className={iconControl}
                  aria-label={t('actions.logout')}
                  title={t('actions.logout')}
                  onClick={handleLogout}
                >
                  <LogOut aria-hidden="true" className={icon} strokeWidth={1.75} />
                </button>
              </>
            )
          ) : (
            /* The only filled control in the header, so it stays the obvious first move
               even with an icon instead of a word. */
            <Button
              size="icon"
              className="h-8 w-8"
              aria-label={t('actions.login')}
              title={t('actions.login')}
              onClick={() => navigate('/login')}
            >
              <LogIn aria-hidden="true" className={icon} strokeWidth={1.75} />
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
