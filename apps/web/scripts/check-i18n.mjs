// Guards the i18n surface: both locales must expose the same keys, and every
// locale key referenced from src/ must exist. Reports unused keys without failing.
//
// Dynamic keys such as t(`chords.${type}`) are matched by their literal prefix,
// so every key under that prefix counts as used.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = ['zh', 'en']
const root = new URL('..', import.meta.url).pathname

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' ? flatten(child, path) : [path]
  })
}

function localeKeys(locale) {
  const file = join(root, 'src/i18n/locales', locale, 'common.json')
  return new Set(flatten(JSON.parse(readFileSync(file, 'utf8'))))
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

const keys = Object.fromEntries(LOCALES.map((locale) => [locale, localeKeys(locale)]))
const namespaces = new Set([...keys.zh].map((key) => key.split('.')[0]))
const allKeys = [...keys.zh]

const problems = []
for (const key of keys.zh) {
  if (!keys.en.has(key)) problems.push(`missing in en: ${key}`)
}
for (const key of keys.en) {
  if (!keys.zh.has(key)) problems.push(`missing in zh: ${key}`)
}

const used = new Set()
const prefixes = new Set()

for (const file of sourceFiles(join(root, 'src'))) {
  const relative = file.replace(`${root}/`, '')
  const source = readFileSync(file, 'utf8')

  // Dotted literals are unambiguous; bare words would match unrelated strings
  // like cache keys, so those are only picked up straight out of t('...').
  const candidates = [...source.matchAll(/\bt\(\s*['"]([a-z][A-Za-z0-9]*)['"]/g)].map((match) => [
    match[1],
    '',
  ])

  for (const [, literal, trailingDot] of source.matchAll(
    /['"`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)(\.?)(?=\$\{|['"`])/g,
  )) {
    if (literal.includes('.') || trailingDot) candidates.push([literal, trailingDot])
  }

  for (const [literal, trailingDot] of candidates) {
    if (!namespaces.has(literal.split('.')[0])) continue

    if (trailingDot) {
      const prefix = `${literal}.`
      if (!allKeys.some((key) => key.startsWith(prefix))) {
        problems.push(`dynamic key used in ${relative} matches nothing: ${prefix}*`)
      }
      prefixes.add(prefix)
      continue
    }

    if (!keys.zh.has(literal)) {
      problems.push(`used in ${relative} but missing from locales: ${literal}`)
    }
    used.add(literal)
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const unused = allKeys.filter(
  (key) => !used.has(key) && ![...prefixes].some((prefix) => key.startsWith(prefix)),
)
console.log(`i18n check passed: ${allKeys.length} keys, ${used.size} referenced`)
if (unused.length > 0) console.log(`unused keys (not an error): ${unused.join(', ')}`)
