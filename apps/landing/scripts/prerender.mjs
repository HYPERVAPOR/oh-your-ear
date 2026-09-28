/**
 * Writes every page of the landing site.
 *
 * `vite build` produces two client bundles and two empty shells; this step runs the server
 * bundle over each shell once per language and drops the markup in, so the HTML that
 * leaves the CDN already says what the page is. Scripts that do not run JavaScript — and
 * search engine crawlers other than Google's — never see a React tree otherwise
 * (PRD 7.5, dev-plan M40 and M41).
 *
 * The shells stay the source of truth for everything structural (icons, fonts, the
 * pre-paint theme script, the bundle tags); this fills in what differs per page: the four
 * meta tags, the canonical URL, the three hreflang links, and the body. The guides' props
 * also go into the document as JSON, because the browser cannot read the markdown the page
 * was built from.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import en from '../src/i18n/locales/en/landing.json' with { type: 'json' }
import zh from '../src/i18n/locales/zh/landing.json' with { type: 'json' }
import { renderPage } from '../dist-ssr/entry-server.js'
import { ALL_SLUGS, LOCALES, documentTitle, hrefFor, readGuides, readIndex } from './learn.mjs'

const ORIGIN = 'https://ohyourear.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'content/learn')

/** The landing page's own meta, and the Open Graph locale pair every page shares. Kept
 *  apart because a guide carries its own title and description: spreading all four over a
 *  guide's page object silently replaced them with the landing page's. */
const META = {
  en: { title: en.meta.title, description: en.meta.description },
  zh: { title: zh.meta.title, description: zh.meta.description },
}

const OG = {
  en: { ogLocale: 'en_US', ogAlternate: 'zh_CN' },
  zh: { ogLocale: 'zh_CN', ogAlternate: 'en_US' },
}

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A `<script>` body: the only sequence that could close the tag early is `</`. */
const escapeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

/**
 * Every rewrite has to land. Left unmatched, the page would keep whatever the shell said —
 * a canonical pointing at another page, or a title in the wrong language — and nothing
 * would complain until someone read the deployed HTML.
 */
function replace(html, pattern, value, label) {
  if (!pattern.test(html)) throw new Error(`prerender: ${label} is not in the shell`)
  return html.replace(pattern, value)
}

/** Each page lists itself, the other language, and a default — Google ignores a set that
 *  does not point both ways. */
function alternates(self, other, otherLang) {
  return [
    `<link rel="alternate" hreflang="${self.lang}" href="${self.url}" />`,
    `<link rel="alternate" hreflang="${otherLang}" href="${other.url}" />`,
    `<link rel="alternate" hreflang="x-default" href="${self.locale === 'en' ? self.url : other.url}" />`,
  ].join('\n    ')
}

/** The shell with one page's meta, alternates and body in it. */
function fill(source, page, body) {
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)

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
  html = replace(
    html,
    /<\/head>/,
    `  ${alternates(page, page.other, page.other.lang)}\n  </head>`,
    'the end of the head',
  )
  // The guides' client entry hydrates from these props: the browser never sees markdown.
  const data =
    page.spec.kind === 'home'
      ? ''
      : `<script id="oye-page" type="application/json">${escapeJson(page.spec)}</script>`
  html = replace(
    html,
    /<div id="root"><\/div>/,
    `${data}<div id="root">${body}</div>`,
    'the root div',
  )

  return html
}

/** What the guides need, in the teaching order they exist in this language. */
async function guidesFor(locale) {
  const guides = await readGuides(contentDir, locale)
  return guides.map((guide, index) => ({
    ...guide,
    position: index + 1,
    total: guides.length,
    prev: guides[index - 1] && { title: guides[index - 1].title, href: guides[index - 1].href },
    next: guides[index + 1] && { title: guides[index + 1].title, href: guides[index + 1].href },
  }))
}

const files = await readdir(contentDir)
const complete = LOCALES.every((locale) =>
  [...ALL_SLUGS].every((slug) => files.includes(`${slug}.${locale}.md`)),
)

// Both languages, read before anything is rendered: the loop below then holds no `await`,
// which keeps the one place that must be sequential — the rendering, and the shared i18n
// instance it changes — the only one.
const content = await Promise.all(
  LOCALES.map(async (locale) => ({
    locale,
    guides: await guidesFor(locale),
    index: await readIndex(contentDir, locale),
  })),
)

const pages = []
for (const { locale, guides, index } of content) {
  const lang = locale === 'zh' ? 'zh-CN' : 'en'
  const home = { kind: 'home', locale, url: `${ORIGIN}${locale === 'zh' ? '/zh' : '/'}`, lang }
  pages.push({
    ...home,
    spec: { kind: 'home', locale },
    other: locale === 'zh' ? pages[0] : { url: `${ORIGIN}/zh`, lang: 'zh-CN' },
    file: locale === 'zh' ? 'zh/index.html' : 'index.html',
    shell: 'index',
    ...META[locale],
    ...OG[locale],
  })

  const other = locale === 'zh' ? 'en' : 'zh'
  // No index, no section: an article whose "all guides" link went nowhere would be worse
  // than a section that has not been announced yet.
  if (!index) continue

  pages.push({
    locale,
    lang,
    url: `${ORIGIN}${hrefFor('index', locale)}`,
    file: `${hrefFor('index', locale).replace(/^\//, '')}/index.html`,
    spec: {
      kind: 'index',
      locale,
      title: index.title,
      intro: index.intro,
      guides: guides.map(({ slug, title, description, href }) => ({
        slug,
        title,
        description,
        href,
      })),
      languageHref: hrefFor('index', other),
    },
    title: documentTitle(index.title),
    description: index.description,
    shell: 'learn',
    other: { url: `${ORIGIN}${hrefFor('index', other)}`, lang: other === 'zh' ? 'zh-CN' : 'en' },
    ...OG[locale],
  })

  for (const guide of guides) {
    pages.push({
      locale,
      lang,
      url: `${ORIGIN}${guide.href}`,
      file: `${guide.href.replace(/^\//, '')}/index.html`,
      spec: {
        kind: 'guide',
        locale,
        title: guide.title,
        html: guide.html,
        position: guide.position,
        total: guide.total,
        prev: guide.prev,
        next: guide.next,
        languageHref: hrefFor(guide.slug, other),
        // The reader's own index, not the other language's: `other` is where the language
        // switch goes, and that is a different link (see `languageHref` above it).
        indexHref: hrefFor('index', locale),
      },
      title: documentTitle(guide.title),
      description: guide.description,
      shell: 'learn',
      other: {
        url: `${ORIGIN}${hrefFor(guide.slug, other)}`,
        lang: other === 'zh' ? 'zh-CN' : 'en',
      },
      ...OG[locale],
    })
  }
}

const shells = {
  index: await readFile(join(root, 'dist/index.html'), 'utf8'),
  learn: await readFile(join(root, 'dist/learn.html'), 'utf8'),
}

/**
 * Sequential on purpose: i18next is a single instance holding a single current language,
 * so one page has to be rendered before the next one changes the language under it.
 * (Everything downstream of this is parallel — see the writes at the bottom.)
 */
const documents = []
for (const page of pages) {
  // oxlint-disable-next-line no-await-in-loop -- one shared i18n instance, see above
  const body = await renderPage(page.spec)
  documents.push({ file: page.file, html: fill(shells[page.shell], page, body) })
}

/* The guides are one section: they go into the sitemap together, once all of them exist in
   both languages. Before that they are built but unannounced — nothing links to them, and
   a crawler that stumbles on one finds a complete page with a canonical URL, which is
   exactly what an unfinished section should look like (dev-plan M41). */
const listed = pages.filter((page) => complete || page.spec.kind === 'home')
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generated by scripts/prerender.mjs. Two pages for the landing site until the',
  '     guides are complete, then every page of the site. No lastmod, no changefreq, no',
  '     priority: they are only worth sending when they are always true. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  // No changefreq and no priority: Google ignores both, and a number nobody reads is a
  // number that will be wrong.
  ...listed.map((page) => `  <url>\n    <loc>${page.url}</loc>\n  </url>`),
  '</urlset>',
  '',
].join('\n')

await Promise.all([
  ...documents.map(async ({ file, html }) => {
    const out = join(root, 'dist', file)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, html)
  }),
  writeFile(join(root, 'dist/sitemap.xml'), sitemap),
  // The shell itself is not a page: it is what the pages above were made from.
  rm(join(root, 'dist/learn.html'), { force: true }),
])

const word = complete ? 'complete' : 'in progress'
const guideCount = pages.filter((page) => page.spec.kind === 'guide').length
console.log(
  `ok  ${documents.length} pages (${guideCount} guides, ${word}) — sitemap lists ${listed.length}`,
)
