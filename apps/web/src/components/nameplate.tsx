import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Ear } from 'lucide-react'

/** One nameplate, not a glyph beside a label: the mark and the wordmark share a single
 *  hairline box, divided by a rule, the way a device is silkscreened onto a panel. The
 *  landing page, the app's header and the login screen all wear it, so it is one object
 *  here rather than three copies.
 *
 *  `inline-flex`, not `flex`: as a block-level box it stretches to whatever it is dropped
 *  into, and inside the login card that made a wide empty frame around a 32px mark.
 *
 *  It goes to this site's own front page. It used to point at the marketing site, on the
 *  reasoning that this is the product and that is the front door — right for a visitor who
 *  has not arrived yet, wrong for a reader already inside: the corner of a page is the way
 *  back to that page, and leaving the app is what the sign-out key is for. Its hover takes
 *  the hairline one step darker, because `hover:border-ink` jumped to near-white in the dark
 *  theme and glared. */
export function Nameplate() {
  const { t } = useTranslation('common')

  return (
    <Link
      to="/"
      className="group inline-flex items-center border border-hairline-strong text-ink no-underline transition-colors hover:border-hairline-hover"
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
    </Link>
  )
}
