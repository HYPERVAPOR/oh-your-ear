import { Ear } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { GITHUB_URL, LICENSE_URL } from '@oh-your-ear/shared/links'
import { GitHubKey, LanguageKey, ThemeKey, iconGroup } from '@oh-your-ear/shared/pref-controls'

/**
 * The two pieces of furniture every page of this site wears.
 *
 * They used to live inside `App.tsx`, which was fine while the landing page was the only
 * page there was. The guides under `/learn` are the second kind of page, and a reader who
 * arrives on one from a search result has to be able to tell it is the same site — a copy
 * of the header that drifts from this one would break exactly that.
 */
export function SiteHeader({
  languageHref,
  nameplateHref,
}: {
  languageHref: string
  nameplateHref?: string
}) {
  const { t } = useTranslation()

  // The nameplate is not a link on the landing page — it would point at the page it is
  // already on — but it is one on the guides, where the reader came in from a search
  // result and needs the way back. Hence: a link only when there is somewhere to go.
  const Nameplate = nameplateHref ? 'a' : 'div'

  return (
    <header className="border-b border-hairline px-6">
      {/* The gutter lives outside the 1200px box, as it does in the page sections:
          with it inside, the bar's content sat 24px inboard of everything below it. */}
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
        {/* One nameplate, not a glyph beside a label: the mark and the wordmark share a
            single hairline box, divided by a rule. Same object as the app's. */}
        <Nameplate
          {...(nameplateHref ? { href: nameplateHref } : {})}
          className="flex items-center border border-hairline-strong text-ink"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center sm:border-r sm:border-hairline-strong">
            <Ear aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="font-display hidden px-2.5 text-[12px] font-medium uppercase leading-none tracking-[0.14em] sm:inline">
            {t('appName')}
          </span>
        </Nameplate>

        <nav className={iconGroup}>
          {/* The other language is another URL, so this is a link and not a button
              (PRD 7.5): a crawler can follow it, and a reader can share it. */}
          <LanguageKey href={languageHref} />
          <ThemeKey />
          <GitHubKey />
        </nav>
      </div>
    </header>
  )
}

/** A conventional footer: who this is on the left, source and small print on the right.
 *  No second call to action down here — the page's own CTA is above it. */
export function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-hairline px-6 py-8 sm:py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-hairline-strong text-ink">
            <Ear aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-display text-[12px] font-medium uppercase leading-none tracking-[0.14em]">
              {t('appName')}
            </p>
            <p className="mt-2 text-[13px] text-muted">{t('tagline')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-hairline-strong underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            {t('github')}
          </a>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-hairline-strong underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            {t('license')}
          </a>
          <span aria-hidden="true" className="text-hairline-strong">
            /
          </span>
          {/* The rights holder is the org, not the product name. */}
          <span>© {new Date().getFullYear()} HYPERVAPOR</span>
        </div>
      </div>
    </footer>
  )
}
