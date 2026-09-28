import { StrictMode } from 'react'
import { prerenderToNodeStream } from 'react-dom/static'

import { ThemeProvider } from '@oh-your-ear/shared/theme'

import { GuideArticle, GuideIndex, type Guide, type GuideLink } from './learn-page.tsx'
import App from './App.tsx'
import i18n from './i18n'
import type { LandingLocale } from './lib/locale'

/**
 * Renders one page at build time, so the HTML that leaves the CDN already carries the
 * headline, the copy and the links. Scripts and language models that do not run JavaScript
 * see a page instead of an empty div (PRD 7.5, dev-plan M40, M41).
 *
 * `prerenderToNodeStream` is React 19's API for exactly this: it produces the same markup
 * the browser will hydrate, and waits for anything that suspends rather than cutting it
 * off. The tree is the one the client hydrates, in the same order, which is what makes the
 * two agree; the interactive pieces are left out of both until the browser has taken over.
 */

/** What a page needs to be rendered, and — for the guides — what the client needs to
 *  hydrate it. The prerender script writes the same object into the page as JSON. */
export type PageSpec =
  | { kind: 'home'; locale: LandingLocale }
  | {
      kind: 'index'
      locale: LandingLocale
      title: string
      intro: string
      guides: Guide[]
      languageHref: string
    }
  | {
      kind: 'guide'
      locale: LandingLocale
      title: string
      html: string
      position: number
      total: number
      prev?: GuideLink
      next?: GuideLink
      languageHref: string
      indexHref: string
    }

function tree(spec: PageSpec) {
  const page =
    spec.kind === 'home' ? (
      <App />
    ) : spec.kind === 'index' ? (
      <GuideIndex
        languageHref={spec.languageHref}
        title={spec.title}
        intro={spec.intro}
        guides={spec.guides}
      />
    ) : (
      <GuideArticle
        languageHref={spec.languageHref}
        indexHref={spec.indexHref}
        title={spec.title}
        html={spec.html}
        position={spec.position}
        total={spec.total}
        prev={spec.prev}
        next={spec.next}
      />
    )

  return (
    <StrictMode>
      <ThemeProvider>{page}</ThemeProvider>
    </StrictMode>
  )
}

export async function renderPage(spec: PageSpec): Promise<string> {
  // The language is a single global on the i18next instance, so pages are rendered one at
  // a time — see the loop in `scripts/prerender.mjs`, which is sequential for this reason.
  await i18n.changeLanguage(spec.locale)

  const { prelude } = await prerenderToNodeStream(tree(spec))

  // Concatenated as bytes and decoded once: a multi-byte character can straddle two
  // chunks, and decoding each one on its own would replace it with a replacement mark.
  const chunks: Buffer[] = []
  for await (const chunk of prelude) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}
