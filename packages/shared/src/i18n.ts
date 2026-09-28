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

/** Which of the two languages a page is actually showing. i18next resolves `zh-CN` to the
 *  `zh` resources, and a reader's choice and their browser need not agree, so this is read
 *  from the instance rather than from the preference store. */
export function shownLanguage(i18n: { language: string; resolvedLanguage?: string }): Locale {
  return (i18n.resolvedLanguage ?? i18n.language).startsWith('zh') ? 'zh' : 'en'
}

/** One bootstrap for both sites: same detector order, same fallback, same `<html lang>`
 *  bookkeeping. Sites supply their own copy under their own namespace. */
export function createI18n({
  ns,
  resources,
  lng,
}: {
  ns: string
  resources: Record<Locale, Record<string, unknown>>
  /** The locale to start in, when the caller knows it. The landing site hands one in
   *  because its language lives in the URL: a page has to say the same thing to a reader
   *  and to whatever is reading the markup. Without it the detector decides, which is
   *  what the app wants — it has one URL and a preference that follows the reader. */
  lng?: Locale
}) {
  i18n.on('languageChanged', (language) => {
    // Prerendering this runs on a server, where there is no document to write to: the
    // HTML the script emits already carries the right lang attribute.
    if (typeof document === 'undefined') return
    // The resources are keyed `zh`, but the tag both documents declare — and the one
    // hreflang uses — names the region: writing `zh` here would leave the hydrated page
    // disagreeing with the HTML it was served.
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language
  })

  // The detector reads localStorage and navigator, so it has nothing to work with on a
  // server — and when the caller passed a locale, nothing to add in the browser either.
  if (typeof window !== 'undefined' && !lng) i18n.use(LanguageDetector)

  i18n.use(initReactI18next).init({
    resources: {
      en: { [ns]: merge(ui.en, resources.en) },
      zh: { [ns]: merge(ui.zh, resources.zh) },
    },
    defaultNS: ns,
    lng,
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
