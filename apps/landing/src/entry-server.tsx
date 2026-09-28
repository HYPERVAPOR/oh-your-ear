import { StrictMode } from 'react'
import { prerenderToNodeStream } from 'react-dom/static'

import { ThemeProvider } from '@oh-your-ear/shared/theme'

import App from './App.tsx'
import i18n from './i18n'
import type { LandingLocale } from './lib/locale'

/**
 * Renders one of the two documents at build time, so the HTML that leaves the CDN already
 * carries the headline, the copy and the links. Scripts and language models that do not
 * run JavaScript see a page instead of an empty div (PRD 7.5, dev-plan M40).
 *
 * `prerenderToNodeStream` is React 19's API for exactly this: it produces the same markup
 * the browser will hydrate, and waits for anything that suspends rather than cutting it
 * off. The tree is the one `main.tsx` hydrates, in the same order, which is what makes the
 * two agree; the interactive pieces are left out of both until the browser has taken over.
 */
export async function render(locale: LandingLocale): Promise<string> {
  await i18n.changeLanguage(locale)

  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )

  // Concatenated as bytes and decoded once: a multi-byte character can straddle two
  // chunks, and decoding each one on its own would replace it with a replacement mark.
  const chunks: Buffer[] = []
  for await (const chunk of prelude) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}
