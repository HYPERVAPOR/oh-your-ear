import { createI18n } from '@oh-your-ear/shared/i18n'

import { localeFromPath } from '@/lib/locale'
import en from './locales/en/landing.json'
import zh from './locales/zh/landing.json'

/** The URL decides the language here, not the browser: `/` and `/zh` are two documents,
 *  and each one has to read the same to a reader and to whatever is reading the markup.
 *  A prerender run has no location to read — `entry-server.tsx` sets the language per page
 *  and changes it between them. */
export default createI18n({
  ns: 'landing',
  resources: { en, zh },
  lng: typeof window === 'undefined' ? 'en' : localeFromPath(window.location.pathname),
})
