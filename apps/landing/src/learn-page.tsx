import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@oh-your-ear/shared/button-variants'

import { APP_URL } from '@/lib/app-url'
import { SiteFooter, SiteHeader } from '@/site-chrome'

/**
 * The pages under `/learn`: an index and one page per guide, rendered from markdown at
 * build time (see `scripts/prerender.mjs`) and served as static HTML.
 *
 * They wear the landing page's furniture — same header, same footer, same hairlines and
 * the same one ink-coloured action — because a reader who arrives from a search result has
 * to be able to tell it is the same site. What they do not have is the landing page's
 * layout: a guide is a page of prose, so it is one column at a readable measure.
 */

/** One guide, as the markdown's frontmatter and the pipeline describe it. */
export interface Guide {
  slug: string
  title: string
  description: string
  /** Where this guide lives in the language of the page it is listed on. */
  href: string
}

export interface GuideLink {
  title: string
  href: string
}

interface ShellProps {
  languageHref: string
  children: React.ReactNode
}

function GuideShell({ languageHref, children }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader languageHref={languageHref} nameplateHref="/" />
      <main className="flex-1 px-6 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-[720px]">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** The one action a guide has: go and do the thing it just described. */
function PracticeCta() {
  const { t } = useTranslation()

  return (
    <div className="mt-10 border border-hairline-strong bg-canvas-soft p-5 sm:mt-14 sm:p-7">
      <p className="text-[15px] leading-[1.7] text-body">{t('guide.practiceBody')}</p>
      <a href={APP_URL} className={`mt-5 ${buttonVariants({})}`}>
        {t('cta')}
      </a>
    </div>
  )
}

/** The index: what the guides are, and the list of them. */
export function GuideIndex({
  languageHref,
  title,
  intro,
  guides,
}: {
  languageHref: string
  title: string
  intro: string
  guides: Guide[]
}) {
  return (
    <GuideShell languageHref={languageHref}>
      <h1 className="text-[28px] font-medium leading-[1.15] tracking-[-0.01em] sm:text-[40px]">
        {title}
      </h1>
      {/* The intro is markdown too, so it is rendered once and dropped in. */}
      <div className="article mt-5 sm:mt-7" dangerouslySetInnerHTML={{ __html: intro }} />

      {/* A rack, like the app's home cells: one hairline box per guide, no card styling. */}
      <ol className="mt-8 grid gap-2 sm:mt-12 sm:grid-cols-2">
        {guides.map((guide, position) => (
          <li key={guide.slug} className="border border-hairline bg-surface">
            <a href={guide.href} className="block p-4 sm:p-5">
              <span className="tabular text-[12px] leading-none text-muted">
                {String(position + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 text-[15px] font-medium leading-tight sm:text-[16px]">
                {guide.title}
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-body">{guide.description}</p>
            </a>
          </li>
        ))}
      </ol>
    </GuideShell>
  )
}

/** One guide: title, the prose, one action, and the two neighbours to read next. */
export function GuideArticle({
  languageHref,
  indexHref,
  title,
  position,
  total,
  html,
  prev,
  next,
}: {
  languageHref: string
  indexHref: string
  title: string
  position: number
  total: number
  html: string
  prev?: GuideLink
  next?: GuideLink
}) {
  const { t } = useTranslation()

  return (
    <GuideShell languageHref={languageHref}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={indexHref}
          className="text-[13px] text-muted underline decoration-hairline-strong underline-offset-4 hover:text-ink hover:decoration-ink"
        >
          {t('guide.allGuides')}
        </a>
        {/* A readout, not a label: tabular numerals, the way the landing page numbers its
            own screens. */}
        <span className="tabular text-[12px] leading-none text-muted">
          {String(position).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      <h1 className="mt-6 text-[28px] font-medium leading-[1.15] tracking-[-0.01em] sm:text-[38px]">
        {title}
      </h1>

      <div className="article mt-6 sm:mt-8" dangerouslySetInnerHTML={{ __html: html }} />

      <PracticeCta />

      {(prev ?? next) && (
        <nav className="mt-8 grid border border-hairline-strong sm:mt-12 sm:grid-cols-2">
          {[prev, next].map((link, index) =>
            link ? (
              <a
                key={link.href}
                href={link.href}
                className={`p-4 text-[14px] leading-[1.6] hover:bg-surface-strong sm:p-5 ${
                  index === 1 ? 'border-t border-hairline-strong sm:border-t-0 sm:border-l' : ''
                }`}
              >
                <span className="text-muted">
                  {index === 0 ? t('guide.previous') : t('guide.next')}
                </span>
                <p className="mt-2">{link.title}</p>
              </a>
            ) : (
              <span key="spacer" aria-hidden="true" className="hidden sm:block" />
            ),
          )}
        </nav>
      )}
    </GuideShell>
  )
}
