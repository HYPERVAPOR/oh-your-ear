/** Which cookie scope the two sites share. Pure, because it is easy to get wrong and
 *  invisible when it is: a wrong answer here silently means "the preference does not
 *  travel", discovered only by trying it in a browser.
 *
 *  `.example.com` for both `example.com` (the landing site, on the bare domain) and
 *  `app.example.com` (the app): the leading-dot spelling names the same cookie scope.
 *
 *  `localhost` gets nothing — Chrome rejects `Domain=localhost` (it treats it as a
 *  top-level name), so in development each site keeps its own preference. To exercise
 *  the shared path locally, use production-shaped hostnames:
 *
 *    chrome --host-resolver-rules="MAP *.oye.test 127.0.0.1"
 *    http://oye.test:5174      ← landing
 *    http://app.oye.test:5173  ← app
 *
 *  ponytail: the last two labels only — a `.co.uk` domain would need the public suffix
 *  list. Add it if this ever ships on a two-label suffix. */
export function cookieDomain(host: string): string | undefined {
  if (host === 'localhost' || host.endsWith('.localhost')) return undefined

  const labels = host.split('.')
  if (labels.length === 1) return undefined

  return labels.length >= 3 ? `.${labels.slice(-2).join('.')}` : `.${host}`
}
