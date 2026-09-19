import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { cookieDomain } from './cookie-domain'

export type Theme = 'light' | 'dark' | 'system'
export type Language = 'en' | 'zh-CN'

/** Language and theme belong to the reader, not to one of the two sites, so they are
 *  written to a cookie on the shared parent domain as well as to this origin's
 *  localStorage. localStorage alone cannot cross origins, and that is exactly the hop
 *  a visitor makes when they press "开始练习" on the landing page (PRD 7.1.2). */
const COOKIE = 'oye_prefs'
const YEAR = 60 * 60 * 24 * 365

function write(theme: Theme, language: Language) {
  const value = `${theme}|${language}`
  const maxAge = `; max-age=${YEAR}`
  const domain = cookieDomain(window.location.hostname)

  // One cookie, not one per site: a host-only copy is *more specific* than the shared
  // one and reads first, so a site holding a stale copy of its own would ignore the
  // preference the other site just changed. Only fall back to a host-only cookie when
  // the browser refuses the shared scope, which is what happens on localhost.
  if (!domain) {
    document.cookie = `${COOKIE}=${value}; path=/${maxAge}`
    return
  }

  document.cookie = `${COOKIE}=${value}; path=/; domain=${domain}${maxAge}`
  if (!document.cookie.includes(`${COOKIE}=${value}`)) {
    document.cookie = `${COOKIE}=${value}; path=/${maxAge}`
  }
}

/** Whatever another site last chose, if it is a value we recognise. */
function read(): Partial<{ theme: Theme; language: Language }> {
  const raw = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))?.[1]
  if (!raw) return {}

  const [theme, language] = raw.split('|')
  return {
    ...(theme === 'light' || theme === 'dark' || theme === 'system' ? { theme } : {}),
    ...(language === 'en' || language === 'zh-CN' ? { language } : {}),
  }
}

interface AppState {
  theme: Theme
  language: Language
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
}

const shared = read()

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: shared.theme ?? 'system',
      language: shared.language ?? 'zh-CN',
      setTheme: (theme) => {
        write(theme, get().language)
        set({ theme })
      },
      setLanguage: (language) => {
        write(get().theme, language)
        set({ language })
      },
    }),
    {
      name: 'oye-app-storage',
      // The cookie is the copy both sites share, so it outranks whatever this origin
      // stored on its own.
      merge: (persisted, current) => ({ ...current, ...(persisted as AppState), ...read() }),
    },
  ),
)
