/**
 * The guides under `/learn`: markdown in `content/learn`, page props out.
 *
 * Build-time only — `marked`, this file and the markdown never reach the browser. What
 * reaches it is the HTML they produce, which `prerender.mjs` folds into the document.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { marked } from 'marked'

/**
 * The eight guides, in teaching order (dev-plan M41).
 *
 * Frozen, because a slug is a URL: `/learn/interval-ear-training` is what a search result,
 * a bookmark and a link from another site point at. `index` is the list itself.
 */
export const GUIDE_ORDER = [
  'what-is-ear-training',
  'interval-ear-training',
  'chord-identification',
  'melodic-dictation',
  'rhythm-basics',
  'relative-vs-perfect-pitch',
  'daily-practice-routine',
  'aural-exam-prep',
]

export const ALL_SLUGS = new Set([...GUIDE_ORDER, 'index'])

export const LOCALES = ['en', 'zh']

/** The contract with the writer: the title goes into the page as written, and the brand is
 *  appended here, so nobody has to remember it and no two pages spell it differently. */
export const documentTitle = (title) => `${title} | Oh Your Ear`

/** Where a page lives. English has no prefix; Chinese is the same page under `/zh`. */
export function hrefFor(slug, locale) {
  const base = locale === 'zh' ? '/zh/learn' : '/learn'
  return slug === 'index' ? base : `${base}/${slug}`
}

/**
 * Frontmatter, three flat string keys, parsed by hand: a YAML parser would be a dependency
 * bought for ten lines of `key: value`.
 */
function frontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source)
  if (!match) throw new Error('guide: no frontmatter')

  const fields = {}
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':')
    if (separator < 0) continue
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return { fields, body: source.slice(match[0].length) }
}

/**
 * Markdown to HTML, with the one rewrite the contract promises: guides link to each other
 * as `/learn/<slug>`, without a language, and the Chinese pages get the prefix here. A
 * link to a slug outside the frozen list is a mistake — a typo, or a page that was never
 * planned — and fails the build instead of shipping a 404.
 */
function render(body, locale, where) {
  for (const [, slug] of body.matchAll(/\]\(\/learn\/([a-z0-9-]+)(?:[)#?][^)]*)?\)/g)) {
    if (!ALL_SLUGS.has(slug)) {
      throw new Error(`${where}: links to /learn/${slug}, which is not one of the planned guides`)
    }
  }

  const html = marked.parse(body, { mangle: false, headerIds: false })
  if (locale === 'zh') return html.replaceAll('href="/learn', 'href="/zh/learn')
  return html
}

/** Every guide that exists in this language, in teaching order. */
export async function readGuides(contentDir, locale) {
  const files = await readdir(contentDir)
  const present = GUIDE_ORDER.filter((slug) => files.includes(`${slug}.${locale}.md`))

  // Read in parallel: the teaching order comes from GUIDE_ORDER, not from the filesystem.
  return Promise.all(
    present.map(async (slug) => {
      const file = `${slug}.${locale}.md`
      const { fields, body } = frontmatter(await readFile(join(contentDir, file), 'utf8'))
      if (!fields.title || !fields.description) {
        throw new Error(`${file}: frontmatter needs a title and a description`)
      }

      return {
        slug,
        title: fields.title,
        description: fields.description,
        href: hrefFor(slug, locale),
        html: render(body, locale, file),
      }
    }),
  )
}

/** The index page's own copy: a title and an intro, and no list — the list is generated
 *  from the guides that exist, so it can never point at a page that is not there yet.
 *
 *  `null` when there is no index file: the section is then not built at all for this
 *  language, which is what lets the pipeline land before the writing does. */
export async function readIndex(contentDir, locale) {
  const file = `index.${locale}.md`
  let source
  try {
    source = await readFile(join(contentDir, file), 'utf8')
  } catch {
    return null
  }
  const { fields, body } = frontmatter(source)
  if (!fields.title || !fields.description) {
    throw new Error(`${file}: frontmatter needs a title and a description`)
  }
  return { title: fields.title, description: fields.description, intro: render(body, locale, file) }
}

export { frontmatter, render }
