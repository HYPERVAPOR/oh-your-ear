/**
 * Asserts that every page came out of the build prerendered, and that the guides' links
 * stay inside the plan.
 *
 * The same reason `apps/web/scripts/check-sw-navigation-fallback.mjs` exists: a build step
 * nobody looks at is a build step that quietly stops running, and the symptom — a page that
 * crawlers read as an empty div — is invisible from the browser it was tested in. A browser
 * cannot tell prerendered markup from client-rendered markup at all, which is why this runs
 * against the build output.
 *
 * It reads the same content the pipeline does, with the same rules (`scripts/learn.mjs`),
 * so the two cannot drift: what the writer wrote is what is asserted here.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import en from '../src/i18n/locales/en/landing.json' with { type: 'json' }
import zh from '../src/i18n/locales/zh/landing.json' with { type: 'json' }
import { ALL_SLUGS, LOCALES, documentTitle, hrefFor, readGuides, readIndex } from './learn.mjs'

const ORIGIN = 'https://ohyourear.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'content/learn')

let passed = 0
function check(condition, label) {
  if (!condition) throw new Error(`prerender check: ${label}`)
  passed += 1
}

const META = { en: en.meta, zh: zh.meta }
const files = await readdir(contentDir)
const complete = LOCALES.every((locale) =>
  [...ALL_SLUGS].every((slug) => files.includes(`${slug}.${locale}.md`)),
)

/** The pages the build was supposed to write, described the way the pipeline describes
 *  them. The landing page and the guides' index always exist; a guide exists when its
 *  markdown does. */
const content = await Promise.all(
  LOCALES.map(async (locale) => ({
    locale,
    index: await readIndex(contentDir, locale),
    guides: await readGuides(contentDir, locale),
  })),
)

const pages = []
const guidesByLocale = {}
for (const { locale, index, guides } of content) {
  const lang = locale === 'zh' ? 'zh-CN' : 'en'
  pages.push({
    file: locale === 'zh' ? 'zh/index.html' : 'index.html',
    lang,
    url: `${ORIGIN}${locale === 'zh' ? '/zh' : '/'}`,
    title: META[locale].title,
    text: locale === 'zh' ? zh.tagline : en.tagline,
    otherUrl: `${ORIGIN}${locale === 'zh' ? '/' : '/zh'}`,
    otherHreflang: locale === 'zh' ? 'en' : 'zh-CN',
  })

  const other = locale === 'zh' ? 'en' : 'zh'
  if (!index) continue

  pages.push({
    file: `${hrefFor('index', locale).slice(1)}/index.html`,
    lang,
    url: `${ORIGIN}${hrefFor('index', locale)}`,
    title: documentTitle(index.title),
    text: index.title,
    otherUrl: `${ORIGIN}${hrefFor('index', other)}`,
    otherHreflang: other === 'zh' ? 'zh-CN' : 'en',
  })

  guidesByLocale[locale] = guides
  for (const guide of guides) {
    pages.push({
      file: `${guide.href.slice(1)}/index.html`,
      lang,
      url: `${ORIGIN}${guide.href}`,
      title: documentTitle(guide.title),
      text: guide.title,
      otherUrl: `${ORIGIN}${hrefFor(guide.slug, other)}`,
      otherHreflang: other === 'zh' ? 'zh-CN' : 'en',
    })
  }
}

/** The rendered markup, with the props script removed: it legitimately holds the other
 *  language's URLs, because that is where the language switch goes. Entities are decoded
 *  so the assertions can compare against the copy as the writer typed it — React escapes
 *  an apostrophe, and `A Beginner's Guide` is what the markdown says. */
function rendered(html) {
  const start = html.indexOf('<div id="root">')
  return decode(html.slice(start).replace(/<script id="oye-page"[\s\S]*?<\/script>/, ''))
}

function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

// Every page, read up front: the assertions below are then a plain loop over the output.
const documents = await Promise.all(
  pages.map(async (page) => {
    try {
      return await readFile(join(root, 'dist', page.file), 'utf8')
    } catch {
      throw new Error(`prerender check: ${page.file} was not built`)
    }
  }),
)

pages.forEach((page, index) => {
  const html = documents[index]

  check(html.includes(`<html lang="${page.lang}">`), `${page.file} declares ${page.lang}`)
  check(
    new RegExp(`<link rel="canonical" href="${page.url}" ?/?>`).test(html),
    `${page.file} canonical`,
  )
  check(html.includes(`<title>${page.title}</title>`), `${page.file} carries its own title`)
  check(!/<div id="root"><\/div>/.test(html), `${page.file} has something in #root`)

  const heading = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '')
  check(heading.trim().length > 0, `${page.file} has an h1 with text`)
  check(
    heading.includes(page.text.slice(0, 8)),
    `${page.file} h1 is its own (${heading.slice(0, 22)}…)`,
  )

  check(html.includes(`hreflang="${page.lang}" href="${page.url}"`), `${page.file} lists itself`)
  check(
    html.includes(`hreflang="${page.otherHreflang}" href="${page.otherUrl}"`),
    `${page.file} lists the other language`,
  )
  check(html.includes('hreflang="x-default"'), `${page.file} lists x-default`)

  // Nothing links outside the plan: a slug that is not in the frozen list is a typo or a
  // page nobody agreed to, and a reader would land on a 404.
  const linked = [...rendered(html).matchAll(/href="(?:\/zh)?\/learn\/([a-z0-9-]+)"/g)].map(
    (match) => match[1],
  )
  const unknown = linked.filter((slug) => !ALL_SLUGS.has(slug))
  check(unknown.length === 0, `${page.file} links only to planned guides (${unknown.join(', ')})`)

  // A guide page carries its prose, not just its title: one of its own headings has to be
  // in the HTML, or the markdown did not make it into the document.
  if (page.file.includes('/learn/') && !page.file.endsWith('learn/index.html')) {
    const firstHeading = page.title.split(' | ')[0].slice(0, 6)
    check(rendered(html).includes(firstHeading), `${page.file} carries the guide's text`)
    check(html.includes('id="oye-page"'), `${page.file} ships its props for hydration`)
    check(/<p>|<h2>|<ul>|<ol>/.test(rendered(html)), `${page.file} has rendered markdown`)
  }
})

const guides = Object.values(guidesByLocale).flat()
if (guides.length > 0) {
  const indexListed = rendered(
    await readFile(join(root, 'dist', `${hrefFor('index', 'en').slice(1)}/index.html`), 'utf8'),
  )
  for (const guide of guidesByLocale.en) {
    check(indexListed.includes(guide.title), `the index lists ${guide.slug}`)
  }
}

// The sitemap is smaller than the site on purpose until the guides are all written
// (dev-plan M41): nothing links to them, so nothing announces them either.
const sitemap = await readFile(join(root, 'dist/sitemap.xml'), 'utf8')
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
check(
  listed.includes(`${ORIGIN}/`) && listed.includes(`${ORIGIN}/zh`),
  'the sitemap lists both home pages',
)
check(
  listed.length === (complete ? pages.length : 2),
  `the sitemap lists ${listed.length} of ${pages.length} pages${complete ? '' : ' (guides incomplete)'}`,
)
check(!sitemap.includes('<lastmod>'), 'the sitemap has no lastmod')

// The shell is what the pages were built from, not a page.
let shellServed = true
try {
  await readFile(join(root, 'dist/learn.html'), 'utf8')
} catch {
  shellServed = false
}
check(!shellServed, 'the learn shell is not served as a page')

// The template's own meta is what a dev server and the CSR fallback show, so it has to keep
// up with the copy in the locale file.
const template = await readFile(join(root, 'index.html'), 'utf8')
check(template.includes(`<title>${en.meta.title}</title>`), 'the template title matches en')
check(template.includes(en.meta.description), 'the template description matches en')

console.log(`\n${passed} checks passed across ${pages.length} pages`)
