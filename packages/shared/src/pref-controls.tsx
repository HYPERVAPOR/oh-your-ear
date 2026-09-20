import { Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { GITHUB_URL } from './links'
import { useAppStore, type Language, type Theme } from './prefs'

/** Every control in a header is the same 32px square as the brand mark, so a bar of
 *  them reads as one row of key-caps on a panel. Shared, because the landing page and
 *  the app must offer exactly the same switch — a visitor should not be able to tell
 *  which of the two sites they are looking at from the controls. */
export const iconKey =
  'relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-body transition-colors hover:bg-surface-strong hover:text-ink focus-visible:z-10 focus-visible:-outline-offset-2'

/** The keys are welded into one piece: a single outline around the group, and one rule
 *  between neighbours instead of two side by side. Keys carry no border of their own, so
 *  a pointer landing on a boundary cannot make it jump a pixel wider. */
export const iconGroup =
  'inline-flex items-stretch divide-x divide-hairline-strong border border-hairline-strong'

const icon = 'h-4 w-4'

/** Theme is a three-position switch, so it cycles: no menu to open, no list to draw. */
const THEME_CYCLE: Theme[] = ['system', 'light', 'dark']
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const

export function ThemeKey() {
  const { t } = useTranslation()
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const Icon = THEME_ICON[theme]
  const label = `${t('settings.theme')}: ${t(`theme.${theme}`)}`

  return (
    <button
      type="button"
      className={iconKey}
      aria-label={label}
      title={label}
      onClick={() => setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length])}
    >
      <Icon aria-hidden="true" className={icon} strokeWidth={1.75} />
    </button>
  )
}

export function LanguageKey() {
  const { t, i18n } = useTranslation()
  const language = useAppStore((state) => state.language)
  const setLanguage = useAppStore((state) => state.setLanguage)

  const next: Language = language === 'zh-CN' ? 'en' : 'zh-CN'
  const label = t('settings.switchLanguage', { language: next === 'zh-CN' ? '中文' : 'English' })

  return (
    <button
      type="button"
      className={iconKey}
      aria-label={label}
      title={label}
      onClick={() => {
        setLanguage(next)
        i18n.changeLanguage(next)
      }}
    >
      <Languages aria-hidden="true" className={icon} strokeWidth={1.75} />
    </button>
  )
}


export function GitHubKey() {
  const { t } = useTranslation()
  const label = t('github')

  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer noopener"
      className={`${iconKey} no-underline`}
      aria-label={label}
      title={label}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={icon} fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    </a>
  )
}
