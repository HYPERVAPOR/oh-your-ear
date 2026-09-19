import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './i18n-ui/en.json'
import zh from './i18n-ui/zh.json'

/** Keys for the controls this package renders. They travel with the components so a
 *  site cannot forget them, and they live here rather than in either site's copy so the
 *  two cannot drift. A site's own keys win on a collision. */
const ui = { en, zh }

/** One level deep, because that is where the collisions are: a site's copy is allowed
 *  to override a shared string, but a site that merely *has* a `theme` object must not
 *  erase the shared `theme.light` by spreading an empty one over it. */
function merge(shared: Record<string, unknown>, own: Record<string, unknown>) {
  const merged = { ...shared }
  for (const [key, value] of Object.entries(own)) {
    const base = merged[key]
    merged[key] =
      base && typeof base === 'object' && value && typeof value === 'object'
        ? { ...(base as object), ...(value as object) }
        : value
  }
  return merged
}

export type Locale = keyof typeof ui

/** One bootstrap for both sites: same detector order, same fallback, same `<html lang>`
 *  bookkeeping. Sites supply their own copy under their own namespace. */
export function createI18n({
  ns,
  resources,
}: {
  ns: string
  resources: Record<Locale, Record<string, unknown>>
}) {
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language
  })

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { [ns]: merge(ui.en, resources.en) },
        zh: { [ns]: merge(ui.zh, resources.zh) },
      },
      defaultNS: ns,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator'],
      },
    })

  return i18n
}
