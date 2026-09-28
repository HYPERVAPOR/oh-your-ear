/**
 * Asserts that both landing documents came out of the build prerendered.
 *
 * The same reason `apps/web/scripts/check-sw-navigation-fallback.mjs` exists: a build step
 * nobody looks at is a build step that quietly stops running, and the symptom — a page
 * that crawlers read as an empty div — is invisible from the browser it was tested in.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import en from '../src/i18n/locales/en/landing.json' with { type: 'json' }
import zh from '../src/i18n/locales/zh/landing.json' with { type: 'json' }

const ORIGIN = 'https://ohyourear.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function check(condition, label) {
  if (!condition) throw new Error(`prerender check: ${label}`)
  console.log(`ok  ${label}`)
}

const pages = [
  {
    file: 'index.html',
    lang: 'en',
    url: `${ORIGIN}/`,
    otherUrl: `${ORIGIN}/zh`,
    otherPath: '/zh',
    otherHreflang: 'zh-CN',
    tagline: en.tagline,
    title: en.meta.title,
  },
  {
    file: 'zh/index.html',
    lang: 'zh-CN',
    url: `${ORIGIN}/zh`,
    otherUrl: `${ORIGIN}/`,
    otherPath: '/',
    otherHreflang: 'en',
    tagline: zh.tagline,
    title: zh.meta.title,
  },
]

const bodies = await Promise.all(
  pages.map((page) => readFile(join(root, 'dist', page.file), 'utf8')),
)

pages.forEach((page, index) => {
  const html = bodies[index]

  check(
    /<html lang="[^"]*">/.test(html) && html.includes(`<html lang="${page.lang}">`),
    `${page.file} declares ${page.lang}`,
  )
  check(
    new RegExp(`<link rel="canonical" href="${page.url}" ?/?>`).test(html),
    `${page.file} points canonical at ${page.url}`,
  )
  check(html.includes(`<title>${page.title}</title>`), `${page.file} carries its own title`)
  check(!/<div id="root"><\/div>/.test(html), `${page.file} has something in #root`)

  // The headline is the thing Bing reported missing: assert the words, not just the tag.
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''
  check(heading.trim().length > 0, `${page.file} has an h1 with text`)
  check(
    heading.includes(page.tagline.slice(0, 8)),
    `${page.file} h1 is the tagline (${heading.slice(0, 24)}…)`,
  )

  for (const [code, href] of [
    ['en', `${ORIGIN}/`],
    ['zh-CN', `${ORIGIN}/zh`],
    ['x-default', `${ORIGIN}/`],
  ]) {
    check(html.includes(`hreflang="${code}" href="${href}"`), `${page.file} lists hreflang ${code}`)
  }

  // The switch is a link to the *other* document, naming that document's language: a
  // crawler can follow it and a reader can share it, which a switch pointing at the page
  // it is already on is not. Matched case-insensitively — React's server renderer writes
  // `hrefLang` through as it was written, and HTML attribute names are case-insensitive.
  check(
    new RegExp(`href="${page.otherPath}"[^>]*hreflang="${page.otherHreflang}"`, 'i').test(html),
    `${page.file} switches to ${page.otherPath}`,
  )
})

const [first, second] = bodies
check(first !== second, 'the two documents differ')
check(pages[0].title !== pages[1].title, 'the two documents have different titles')

// The template's own meta is what a dev server and the CSR fallback show, so it has to
// keep up with the English copy in the locale file.
const template = await readFile(join(root, 'index.html'), 'utf8')
check(template.includes(`<title>${en.meta.title}</title>`), 'the template title matches en')
check(template.includes(en.meta.description), 'the template description matches en')
