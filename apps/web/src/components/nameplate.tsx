import { useTranslation } from 'react-i18next'
import { Ear } from 'lucide-react'

/** The marketing site. The default is the real domain, so production needs no variable;
 *  dev points it at the landing's own dev server (see compose.dev.yml). */
const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://ohyourear.com'

/** One nameplate, not a glyph beside a label: the mark and the wordmark share a single
 *  hairline box, divided by a rule, the way a device is silkscreened onto a panel. The
 *  landing page, the app's header and the login screen all wear it, so it is one object
 *  here rather than three copies.
 *
 *  It is also the way back to the marketing site — this is the product, not the front
 *  door — and its hover takes the hairline one step darker, because `hover:border-ink`
 *  jumped to near-white in the dark theme and glared. */
export function Nameplate() {
  const { t } = useTranslation('common')

  return (
    <a
      href={LANDING_URL}
      className="group flex items-center border border-hairline-strong text-ink transition-colors hover:border-hairline-hover"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center transition-colors sm:border-r sm:border-hairline-strong sm:group-hover:border-hairline-hover">
        <Ear aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      </span>
      {/* On phones the mark carries the brand on its own: with the wordmark the header
          wraps to two rows at 390px. Small, uppercase and letter-spaced, it reads as a
          machine label instead of a headline — that is what keeps it in the same object
          as the mark. */}
      <span className="font-display hidden px-2.5 text-[12px] font-medium uppercase leading-none tracking-[0.14em] sm:inline">
        {t('appName')}
      </span>
    </a>
  )
}
