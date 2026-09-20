import { Ear, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@oh-your-ear/shared/button-variants'
import { GITHUB_URL, LICENSE_URL } from '@oh-your-ear/shared/links'
import { GitHubKey, LanguageKey, ThemeKey, iconGroup } from '@oh-your-ear/shared/pref-controls'

import { PitchChart2D } from '@/components/pitch-chart-2d'
import { PitchChart3 } from '@/components/pitch-chart-3'

/** Where "开始练习" goes. Configurable because the two sites live on different hosts in
 *  production and on different ports in development. */
const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173'

/** The landing page: one screen, everything flush left. The pitch and the one action in
 *  the left column, a keyboard to play with in the right — nothing here loads a practice
 *  screen, because the whole point of the site split (PRD 7.1.2) is that a visitor who is
 *  not ready to practise pays for a headline, a button and a few lines of Web Audio
 *  rather than for an audio engine. */
/** Which chart to draw: the piano roll by default, the bar chart when asked. */
function chartVariant(): string {
  return new URLSearchParams(window.location.search).get('chart') ?? 'roll'
}

export default function App() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col">
      {/* The gutter lives outside the 1200px box, as it does in the page sections:
          with it inside, the bar's content sat 24px inboard of everything below it. */}
      <header className="border-b border-hairline px-6">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
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

          <nav className={iconGroup}>
            <LanguageKey />
            <ThemeKey />
            <GitHubKey />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="flex min-h-[calc(100svh-65px)] items-center px-6 py-16">
          {/* Side by side only from lg: in between, the keyboard needs the whole row to
              stay wide enough to hit. */}
          <div className="mx-auto grid w-full max-w-[1200px] gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <h1 className="max-w-[24ch] text-[40px] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[60px]">
                {t('tagline')}
              </h1>
              <p className="mt-6 max-w-[46ch] whitespace-pre-line text-[17px] leading-[1.7] text-body">
                <span className="block">{t('line1')}</span>
                <span className="block">{t('line2')}</span>
              </p>

              <div className="mt-10 flex flex-col items-start gap-3">
                <a href={APP_URL} className={buttonVariants({ size: 'hero' })}>
                  {t('cta')}
                  {/* Solid, not stroked: a play glyph has to read at 15px, and the outline
                      version turns into a squiggle. */}
                  <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
                </a>
                <p className="max-w-[38ch] text-[14px] text-muted">{t('guestNote')}</p>
              </div>
            </div>

            {/* ?chart=2d brings back the bar chart; the piano roll is the current take. */}
            {chartVariant() === '2d' ? <PitchChart2D /> : <PitchChart3 />}
          </div>
        </section>
      </main>

      {/* A conventional footer: who this is on the left, where to find the source and the
          small print on the right. The hero already carries the one action, so there is no
          second call to action down here. */}
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
    </div>
  )
}
