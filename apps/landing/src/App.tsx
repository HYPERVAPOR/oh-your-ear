import { Ear, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@oh-your-ear/shared/button-variants'
import { GITHUB_URL, LICENSE_URL } from '@oh-your-ear/shared/links'
import { GitHubKey, LanguageKey, ThemeKey, iconGroup } from '@oh-your-ear/shared/pref-controls'

import { PitchChart2D } from '@/components/pitch-chart-2d'
import { SoundCheck } from '@/components/sound-check'
import { PianoRoll } from '@/components/piano-roll'

/** Where "开始练习" goes. Configurable because the two sites live on different hosts in
 *  production and on different ports in development. */
const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173'

/** The five drills, in the app's order and wearing the app's colours. Written out rather
 *  than composed from the key: Tailwind finds class names by reading the source, so a
 *  template like `bg-swatch-${key}` generates nothing. The first one is the pitch drill,
 *  which the app calls 单音 on its own screens. */
const DRILLS = [
  { key: 'pitch', swatch: 'bg-swatch-singleNote' },
  { key: 'interval', swatch: 'bg-swatch-interval' },
  { key: 'chord', swatch: 'bg-swatch-chord' },
  { key: 'melody', swatch: 'bg-swatch-melody' },
  { key: 'rhythm', swatch: 'bg-swatch-rhythm' },
] as const

/** The landing page: two screens, everything flush left. The first is the pitch and the
 *  one action on the left with a keyboard to play with on the right; the second says what
 *  it costs. Nothing here loads a practice screen, because the whole point of the site
 *  split (PRD 7.1.2) is that a visitor who is not ready to practise pays for a headline, a
 *  button and a few lines of Web Audio rather than for an audio engine. */
/** Which chart to draw: the piano roll — the editor (#91) — by default, the flat bar chart
 *  when asked. Both read the same octave, and both play the same three samples. */
function chartVariant(): string {
  return new URLSearchParams(window.location.search).get('chart') ?? 'roll'
}

/** The second screen's three claims, each with the sentence that backs it up. Order is the
 *  order they are read in, and the labels are the words a visitor is looking for. */
const CLAIMS = ['openSource', 'price', 'fees'] as const

/** What an account is actually for, in the order a visitor would use them. */
const ACCOUNT_ITEMS = ['levels', 'plan', 'progress', 'mistakes', 'bookmarks'] as const

/** Where bugs and feature requests go. One person reads this inbox; it is written out
 *  here rather than hidden behind a form, because a form would need a backend this page
 *  deliberately does not have. */
const CONTACT_EMAIL = 'me@hypervapor.org'

export default function App() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col">
      {/* The gutter lives outside the 1200px box, as it does in the page sections:
          with it inside, the bar's content sat 24px inboard of everything below it. */}
      <header className="border-b border-hairline px-6">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
          {/* One nameplate, not a glyph beside a label: the mark and the wordmark share
              a single hairline box, divided by a rule. Same object as the app's — but not
              a link: this is the page it would point at. */}
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
        <section className="flex min-h-[calc(100svh-65px)] items-center px-6 py-8 [@media(max-height:700px)]:py-6 sm:py-16">
          {/* Side by side only from lg: in between, the keyboard needs the whole row to
              stay wide enough to hit. */}
          <div className="mx-auto grid w-full max-w-[1200px] gap-4 [@media(max-height:700px)]:gap-3 sm:gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-12">
            <div>
              <h1 className="max-w-[24ch] text-[36px] font-medium leading-[1.1] tracking-[-0.01em] [@media(max-height:700px)]:text-[32px] sm:text-[60px]">
                {t('tagline')}
              </h1>
              {/* The subheading is two parts (PRD 7.1.6): what the five drills are, then
                  one line for the person who already plays or produces and cannot hear what
                  they are doing. The colour swatches are the module colours — identity, and
                  the only place the landing page wears them. */}
              <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-body sm:mt-6 sm:gap-y-2 sm:text-[15px]">
                {DRILLS.map((drill) => (
                  <li key={drill.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-3 w-[3px] shrink-0 ${drill.swatch}`} />
                    {t(`drills.${drill.key}`)}
                  </li>
                ))}
              </ul>

              <p className="mt-3 max-w-[46ch] text-[16px] leading-[1.7] text-body sm:mt-5 sm:text-[17px]">
                {t('subtitle')}
              </p>

              {/* The one action. No note under it: it had a line of small print, and the
                  button is clearer with the space to itself. */}
              <a
                href={APP_URL}
                className={`mt-6 [@media(max-height:700px)]:mt-4 sm:mt-10 ${buttonVariants({ size: 'hero' })}`}
              >
                {t('cta')}
                {/* Solid, not stroked: a play glyph has to read at 15px, and the outline
                    version turns into a squiggle. */}
                <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
              </a>
            </div>

            {/* ?chart=2d brings back the bar chart; the roll is the editor (#91). */}
            {chartVariant() === '2d' ? <PitchChart2D /> : <PianoRoll />}
          </div>
        </section>

        {/* The second screen (PRD 7.1.5): what this costs, which is the first thing a
            visitor who likes what they heard wants to know. Three claims in the same
            welded bar the header keys and the transport use — one outline, rules between
            neighbours, equal cells — not three cards that each carry their own border. */}
        <section className="flex min-h-[calc(100svh-65px)] items-center border-t border-hairline bg-canvas-soft px-6 py-8 [@media(max-height:700px)]:py-6 sm:py-16">
          <div className="mx-auto w-full max-w-[1200px]">
            {/* The hero is the cover and goes unnumbered; every screen after it is a
                section of the same manual, so it says which one it is. A readout, not a
                label: tabular numerals, no rule beside it. */}
            <p className="tabular mb-4 text-[24px] leading-none text-muted">01</p>

            <h2 className="text-[22px] font-medium leading-[1.15] tracking-[-0.01em] sm:max-w-[24ch] sm:text-[36px]">
              {t('free.heading')}
            </h2>

            <div className="mt-6 grid border border-hairline-strong bg-canvas-soft sm:mt-10 sm:grid-cols-3">
              {CLAIMS.map((claim) => (
                <div
                  key={claim}
                  className="border-t border-hairline-strong p-4 text-[14px] first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0 sm:p-7 sm:text-[15px]"
                >
                  <p className="badge-label text-muted">{t(`free.${claim}.label`)}</p>
                  <p className="mt-3 text-[15px] leading-[1.7] text-body">
                    {t(`free.${claim}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The third screen (PRD 7.1.7): what an account is actually for. The screen above
            says practice does not need one; this one lists what it does hold and stops —
            it does not say "don't worry" again, it gives the scope instead. */}
        <section className="flex min-h-[calc(100svh-65px)] items-center border-t border-hairline px-6 py-8 [@media(max-height:700px)]:py-6 sm:py-16">
          <div className="mx-auto w-full max-w-[1200px]">
            <p className="tabular mb-4 text-[24px] leading-none text-muted">02</p>

            <h2 className="text-[22px] font-medium leading-[1.15] tracking-[-0.01em] sm:max-w-[24ch] sm:text-[36px]">
              {t('account.heading')}
            </h2>

            {/* A rack, not a table and not a glossary: one card per thing the account
                holds, laid out the way the app's home racks are — grid, 8px gutters, one
                1px hairline box per cell, surface fill. No 3px track along the top: in the
                app that strip is the module's colour, and these five are not the drills. */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-10 sm:grid-cols-3 lg:grid-cols-5">
              {ACCOUNT_ITEMS.map((item) => (
                <div key={item} className="border border-hairline bg-surface p-3 sm:p-4">
                  <p className="text-[13px] font-medium leading-tight sm:text-[15px]">
                    {t(`account.${item}.label`)}
                  </p>
                  <p className="mt-2 text-[12px] leading-[1.5] text-body sm:text-[13px] sm:leading-[1.6]">
                    {t(`account.${item}.body`)}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-2 text-[12px] text-muted sm:mt-6 sm:text-[14px]">
              {t('account.sessionNote')}
            </p>
          </div>
        </section>
        {/* The fourth screen (PRD 7.1.8): where a bug or a feature request goes. The
            address is the action, set as a link rather than a button — a button on this
            screen would compete with the one action the page has. */}
        <section className="flex min-h-[calc(100svh-65px)] items-center border-t border-hairline bg-canvas-soft px-6 py-8 [@media(max-height:700px)]:py-6 sm:py-16">
          <div className="mx-auto w-full max-w-[1200px]">
            <p className="tabular mb-4 text-[24px] leading-none text-muted">03</p>

            <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-16">
              <div>
                <h2 className="text-[22px] font-medium leading-[1.15] tracking-[-0.01em] sm:max-w-[24ch] sm:text-[36px]">
                  {t('contact.heading')}
                </h2>

                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-display mt-6 inline-block text-[20px] font-medium underline decoration-hairline-strong underline-offset-8 hover:decoration-ink sm:mt-8 sm:text-[28px]"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>

              <SoundCheck />
            </div>

            {/* One string, one link: splitting a sentence around a link is what makes
                translations fall apart. */}
            <p className="mt-6 text-[13px] sm:mt-8 sm:text-[14px]">
              <a
                href={`${GITHUB_URL}/issues/new`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                {t('contact.orGithub')}
              </a>
            </p>
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
