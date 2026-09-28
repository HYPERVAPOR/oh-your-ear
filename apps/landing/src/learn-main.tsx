import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

import { ThemeProvider } from '@oh-your-ear/shared/theme'

import './i18n'
import './index.css'

import { GuideArticle, GuideIndex } from './learn-page.tsx'
import type { PageSpec } from './entry-server.tsx'

/**
 * The client half of the guides under `/learn`.
 *
 * Those pages are prerendered from markdown at build time, so the browser has to reach the
 * same tree again — and it cannot read the markdown, which is a build-time concern. The
 * prerender script therefore writes the rendered page's props into the document as JSON,
 * and this is the only thing that reads them back. It is hydrated, not created: the markup
 * in the document is the page (PRD 7.5).
 */
const data = document.getElementById('oye-page')

if (!data?.textContent) {
  throw new Error('learn-main: the page has no prerendered data to hydrate')
}

const spec = JSON.parse(data.textContent) as Extract<PageSpec, { kind: 'index' | 'guide' }>

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ThemeProvider>
      {spec.kind === 'index' ? (
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
      )}
    </ThemeProvider>
  </StrictMode>,
)
