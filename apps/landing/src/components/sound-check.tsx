import { useState } from 'react'
import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { audioNow, frequencyOf, playNote } from '@/lib/keys'

/** C5 then C♯5, half a second apart. */
const FIRST = 72
const SECOND = 73
const GAP = 0.55

/**
 * Screen 03's easter egg (PRD 7.1.8): press one cell of a small readout panel and two
 * notes a semitone apart come out; only then does the panel say what they were.
 *
 * The panel is the point as much as the sound. A bare button floating in the right half
 * of the screen has nothing to belong to; wrapped in the same one-outline-cut-into-cells
 * object the header keys and the transport use, it becomes a piece of equipment with a
 * title, a control and a readout, which is what this design system does with everything.
 *
 * The last line is the joke — anyone who heard nothing has just found a bug on the screen
 * that exists to collect bug reports. That is also the useful half: the landing page is
 * the one screen every visitor passes through, and a report of sound failing here is what
 * makes an issue like "no sound in the WeChat browser" (#88) get filed by someone who
 * would never have gone looking for a repository to file it in.
 *
 * A few lines of the landing's own Web Audio (lib/keys.ts), the same synth the hero's roll
 * plays — this page still ships no piano samples.
 */
export function SoundCheck() {
  const { t } = useTranslation()
  const [played, setPlayed] = useState(false)

  const play = () => {
    playNote(frequencyOf(FIRST))
    // The clock only exists once the first note has created the audio context.
    const clock = audioNow()
    playNote(frequencyOf(SECOND), clock === null ? undefined : clock + GAP)
    setPlayed(true)
  }

  return (
    <div className="border border-hairline-strong lg:w-[380px]">
      <p className="badge-label border-b border-hairline-strong px-4 py-3 text-muted">
        {t('contact.checkTitle')}
      </p>

      {/* The control is a cell, not a button parked in one: full width, left-aligned, and
          it answers with the same hover fill the app's option keys use. */}
      <button
        type="button"
        onClick={play}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] text-ink hover:bg-surface-strong"
      >
        <Play aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
        {t('contact.listen')}
      </button>

      {played && (
        <div className="border-t border-hairline-strong px-4 py-3">
          <p className="tabular text-[12px] text-muted">C5 → C♯5 · {t('contact.interval')}</p>
          <p className="mt-1.5 text-[14px]">{t('contact.noSound')}</p>
        </div>
      )}
    </div>
  )
}
