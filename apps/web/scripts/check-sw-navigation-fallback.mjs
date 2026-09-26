// Guards the service worker's navigation fallback: full-page navigations to
// /api/ have to reach the network.
//
// The Google sign-in start (/api/v1/auth/google) and the address Google sends
// people back to (/api/v1/auth/google/callback) are both full-page
// navigations. Workbox's NavigationRoute answers every navigation it matches
// with index.html, so without a denylist the browser never leaves the app:
// React Router finds no such route and renders the app's own 404 page. Dev
// never shows it (VitePWA only registers a service worker in production
// builds), so this loads the generated worker and asks it directly.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInThisContext } from 'node:vm'

const dist = resolve(import.meta.dirname, '../dist')
const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8')

const stub = () => {}
const asyncStub = async () => undefined
globalThis.self = globalThis
globalThis.addEventListener = stub
globalThis.skipWaiting = asyncStub
globalThis.clients = { claim: stub, matchAll: async () => [] }
globalThis.caches = {
  open: async () => ({ match: asyncStub, put: asyncStub, keys: async () => [] }),
  keys: async () => [],
  match: asyncStub,
  delete: asyncStub,
}
globalThis.registration = {
  scope: '/',
  navigationPreload: { enable: asyncStub, disable: asyncStub },
}
globalThis.location = { href: 'https://app.ohyourear.com/sw.js' }
globalThis.importScripts = (name) =>
  runInThisContext(readFileSync(resolve(dist, name.slice(name.lastIndexOf('/') + 1)), 'utf8'))

// Capture the navigation route instead of registering it, so it can be asked.
const captured = []
globalThis.navRoutes = captured
runInThisContext(sw.replace('e.registerRoute(', 'self.navRoutes.push('))
// The worker's AMD preamble loads the workbox module through a promise chain.
await new Promise((done) => setImmediate(done))

const [route] = captured
if (!route) throw new Error('the generated service worker registered no navigation route')

// Node's Request refuses mode: 'navigate' (only a service worker may build
// one), and NavigationRoute only reads request.mode, so hand it that shape.
const matches = (url) => route.match({ request: { mode: 'navigate' }, url: new URL(url) })

const cases = [
  ['https://app.ohyourear.com/api/v1/auth/google?next=%2F', false],
  ['https://app.ohyourear.com/api/v1/auth/google/callback?code=x&state=y', false],
  ['https://app.ohyourear.com/api/', false],
  ['https://app.ohyourear.com/', true],
  ['https://app.ohyourear.com/login', true],
  ['https://app.ohyourear.com/daily', true],
]

for (const [url, expected] of cases) {
  const actual = matches(url)
  if (actual !== expected) {
    throw new Error(`navigation fallback matched ${url}: ${actual}, expected ${expected}`)
  }
  console.log(`ok  ${actual ? 'fallback' : 'network '} ${url}`)
}
