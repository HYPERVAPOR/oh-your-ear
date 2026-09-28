/**
 * Writes the two landing documents.
 *
 * `vite build` produces a client bundle and an empty `#root`; this step runs the server
 * bundle over that same template once per language and drops the markup in, so the HTML
 * that leaves the CDN already says what the page is. Scripts that do not run JavaScript —
 * and search engine crawlers other than Google's — never see the React tree otherwise
 * (PRD 7.5, dev-plan M40).
 *
 * The template stays the source of truth for everything structural (icons, fonts, the
 * pre-paint theme script, the bundle tags); this only fills in what differs per language:
 * four meta tags, the canonical URL, the three hreflang links, and the body.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import en from '../src/i18n/locales/en/landing.json' with { type: 'json' }
import zh from '../src/i18n/locales/zh/landing.json' with { type: 'json' }
import { render } from '../dist-ssr/entry-server.js'

const ORIGIN = 'https://ohyourear.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** One entry per document. The titles and descriptions live with the rest of the copy, in
 *  the locale files, so a translation is a translation and not a build-script edit. */
const PAGES = [
  {
    locale: 'en',
    lang: 'en',
    url: `${ORIGIN}/`,
    file: 'index.html',
    meta: en.meta,
    ogLocale: 'en_US',
    ogAlternate: 'zh_CN',
  },
  {
    locale: 'zh',
    lang: 'zh-CN',
    url: `${ORIGIN}/zh`,
    file: 'zh/index.html',
    meta: zh.meta,
    ogLocale: 'zh_CN',
    ogAlternate: 'en_US',
  },
]

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Every rewrite has to land. Left unmatched, the page would keep whatever the template
 * said — a canonical pointing at the other language, or a title in the wrong one — and
 * nothing would complain until someone read the deployed HTML.
 */
function replace(html, pattern, value, label) {
  if (!pattern.test(html)) throw new Error(`prerender: ${label} is not in dist/index.html`)
  return html.replace(pattern, value)
}

/** Each document lists itself, the other one, and a default — Google ignores a set that
 *  does not point both ways. */
function alternates() {
  return [
    `<link rel="alternate" hreflang="en" href="${ORIGIN}/" />`,
    `<link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/zh" />`,
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`,
  ].join('\n    ')
}

const template = await readFile(join(root, 'dist/index.html'), 'utf8')

/**
 * Sequential on purpose: i18next is a single instance holding a single current language,
 * so one page has to be rendered before the next one changes the language under it.
 * (Everything downstream of this is parallel — see the writes at the bottom.)
 */
const documents = []
for (const page of PAGES) {
  // oxlint-disable-next-line no-await-in-loop -- one shared i18n instance, see above
  const body = await render(page.locale)
  documents.push({ file: page.file, html: fill(template, page, body) })
}

await Promise.all(
  documents.map(async ({ file, html }) => {
    const out = join(root, 'dist', file)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, html)
    console.log(`ok  ${file}  ${html.length} bytes`)
  }),
)

/** The template with one language's meta, alternates and body in it. */
function fill(source, page, body) {
  const title = escapeHtml(page.meta.title)
  const description = escapeHtml(page.meta.description)

  let html = source
  html = replace(html, /<html lang="[^"]*">/, `<html lang="${page.lang}">`, 'the html lang')
  html = replace(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, 'the title')
  html = replace(
    html,
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
    'the description',
  )
  html = replace(html, /(<link rel="canonical" href=")[^"]*(")/, `$1${page.url}$2`, 'the canonical')
  html = replace(
    html,
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    `$1${page.url}$2`,
    'og:url',
  )
  html = replace(
    html,
    /(<meta\s+property="og:locale"\s+content=")[^"]*(")/,
    `$1${page.ogLocale}$2`,
    'og:locale',
  )
  html = replace(
    html,
    /(<meta\s+property="og:locale:alternate"\s+content=")[^"]*(")/,
    `$1${page.ogAlternate}$2`,
    'og:locale:alternate',
  )
  html = replace(
    html,
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${title}$2`,
    'og:title',
  )
  html = replace(
    html,
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
    'og:description',
  )
  html = replace(
    html,
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${title}$2`,
    'twitter:title',
  )
  html = replace(
    html,
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
    'twitter:description',
  )
  html = replace(html, /<\/head>/, `  ${alternates()}\n  </head>`, 'the end of the head')
  html = replace(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, 'the root div')

  return html
}
