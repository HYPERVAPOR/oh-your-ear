import { useEffect } from 'react'

import { useAppStore, type Theme } from './prefs'

function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.classList.add(systemTheme)
    return
  }

  root.classList.add(theme)
}

/** Neither site renders a theme of its own: both mount this, and the preference it
 *  reads is the shared one. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((state) => state.theme)

  useEffect(() => {
    applyTheme(theme)

    if (theme !== 'system') return

    const listener = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light')
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme])

  return <>{children}</>
}
