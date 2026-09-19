import { Ear } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@oh-your-ear/shared/button-variants'
import { LanguageKey, ThemeKey } from '@oh-your-ear/shared/pref-controls'

/** Where "开始练习" goes. Configurable because the two sites live on different hosts in
 *  production and on different ports in development. */
const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173'

/** The landing page: one screen, two columns, everything flush left. The pitch on the
 *  left, the single action on the right. Nothing here loads a practice screen — the
 *  whole point of the split (PRD 7.1.2) is that a visitor who is not ready to practise
 *  pays for a headline and a button, not for an audio engine. */
export default function App() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-2 sm:px-6">
          {/* One nameplate, not a glyph beside a label: the mark and the wordmark share
              a single hairline box, divided by a rule. Same object as the app's. */}
          <div className="flex items-center border border-hairline-strong text-ink">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center sm:border-r sm:border-hairline-strong">
              <Ear aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="font-display hidden px-2.5 text-[12px] font-medium uppercase leading-none tracking-[0.14em] sm:inline">
              {t('appName')}
            </span>
          </div>

          <nav className="flex items-center gap-1.5">
            <LanguageKey />
            <ThemeKey />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="flex min-h-[calc(100svh-65px)] items-center px-6 py-16">
          <div className="mx-auto grid w-full max-w-[1200px] gap-12 sm:grid-cols-[1.5fr_1fr] sm:items-end">
            <div>
              <h1 className="max-w-[24ch] text-[40px] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[60px]">
                {t('tagline')}
              </h1>
              <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.7] text-body">
                <span className="block">{t('line1')}</span>
                <span className="block">{t('line2')}</span>
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 sm:items-end sm:pb-1.5">
              <a href={APP_URL} className={buttonVariants({ size: 'hero' })}>
                {t('cta')}
              </a>
              <p className="max-w-[38ch] text-[14px] text-muted sm:text-right">{t('guestNote')}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline px-6 py-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span>{t('footerNote')}</span>
          <a href={APP_URL} className="underline underline-offset-4 hover:text-ink">
            {t('enterApp')}
          </a>
        </div>
      </footer>
    </div>
  )
}
