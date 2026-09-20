import { Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
