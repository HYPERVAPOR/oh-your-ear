/** The landing site is served as two documents, so the language is the first thing in the
 *  path: `/` is English, `/zh` is Chinese. Nothing here reads localStorage or navigator —
 *  a URL has to mean the same page to a reader, to someone following a shared link, and to
 *  whatever is reading the markup. `entry-server.tsx` uses the same mapping at build time.
 *
 *  Kept free of imports on purpose: `node --test` runs this file directly, with no Vite
 *  aliases and no bundler (see the note in `apps/web/src/lib/daily.ts` for the same rule).
 */
export type LandingLocale = 'en' | 'zh'

/** Which document a path is. `/zh` and `/zh/` are the same page; `/zhoops` is not `zh`. */
export function localeFromPath(pathname: string): LandingLocale {
  return /^\/zh(\/|$)/.test(pathname) ? 'zh' : 'en'
}

/** Where the other language lives. No trailing slash: that is the form Vercel serves
 *  without a redirect, so it is the one canonical, hreflang and the switch can point at. */
export function pathFor(locale: LandingLocale): string {
  return locale === 'zh' ? '/zh' : '/'
}
