import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore, type Language, type Theme } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

const pillControl =
  'cursor-pointer appearance-none whitespace-nowrap rounded-none border border-hairline-strong bg-transparent py-1.5 pl-2.5 pr-6 text-[12px] font-medium text-body transition-colors hover:bg-surface-strong hover:text-ink sm:pl-3 sm:pr-7 sm:text-[13px]'

/** Quiet pill control with its own chevron: an appearance-none select with no
 *  indicator reads as a static label. */
function NavSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <span className="relative inline-flex items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={pillControl}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted"
      />
    </span>
  )
}

/** 64px nav shared by every screen: wordmark left, quiet controls right. */
export function AppHeader() {
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, language, setTheme, setLanguage } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  function changeLanguage(next: Language) {
    setLanguage(next)
    i18n.changeLanguage(next)
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-2 sm:px-6">
        <Link
          to="/"
          className="font-display text-[18px] leading-none tracking-tight sm:text-[21px]"
        >
          {t('appName')}
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <NavSelect
            label={t('settings.language')}
            value={language}
            onChange={(value) => changeLanguage(value as Language)}
          >
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
          </NavSelect>

          <NavSelect
            label={t('settings.theme')}
            value={theme}
            onChange={(value) => setTheme(value as Theme)}
          >
            <option value="system">{t('theme.system')}</option>
            <option value="light">{t('theme.light')}</option>
            <option value="dark">{t('theme.dark')}</option>
          </NavSelect>

          {user ? (
            /* The account page shows its own header actions: repeating them here is
               noise, and they are what pushes the nav onto a second row at 390px. */
            location.pathname !== '/me' && (
              <>
                <Link to="/me" className={`${pillControl} no-underline`}>
                  {t('auth.account')}
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  {t('actions.logout')}
                </Button>
              </>
            )
          ) : (
            <Button size="sm" onClick={() => navigate('/login')}>
              {t('actions.login')}
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
