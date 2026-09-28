import { useState, useSyncExternalStore } from 'react'

import { PianoRoll } from '@/components/piano-roll'
import { PitchChart2D } from '@/components/pitch-chart-2d'
import { SoundCheck } from '@/components/sound-check'

/**
 * The three interactive pieces, drawn in the browser only.
 *
 * The page arrives prerendered (see `scripts/prerender.mjs`), so everything in it renders
 * twice: once in Node, once again when React hydrates what Node wrote. These three read
 * the query string, the canvas size and the audio clock, so they wait until after that
 * first render instead of trying to agree with a server about it. What stays in the
 * prerendered HTML is content — which is the whole point of prerendering it.
 *
 * Each placeholder keeps the height of the thing it stands in for: on a phone these sit
 * above the fold, stacked under the headline, where an empty box would push the rest of
 * the page down the moment it filled itself in.
 */
/**
 * False while prerendering, true once the browser owns the tree.
 *
 * Not state, and nothing sets it: the two snapshots are the two environments, which is
 * what `useSyncExternalStore` is for. A `useEffect` that flips a flag would do the same
 * job, but it writes state during an effect and the lint is right to dislike that.
 */
const noSubscription = () => () => {}
function useInBrowser() {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
}

/** The hero's instrument. `?chart=2d` still swaps the piano roll for the bar chart. */
export function HeroChart() {
  const inBrowser = useInBrowser()
  // Read once, on the way in. The query string does not exist while prerendering, and the
  // value is only ever used inside the branch below.
  const [variant] = useState(() =>
    typeof window === 'undefined'
      ? 'roll'
      : (new URLSearchParams(window.location.search).get('chart') ?? 'roll'),
  )

  if (!inBrowser) return <div className="min-h-[232px] sm:min-h-[260px]" aria-hidden="true" />

  return variant === '2d' ? <PitchChart2D /> : <PianoRoll />
}

/** The contact screen's "can you hear this?" check. */
export function SoundCheckDemo() {
  const inBrowser = useInBrowser()

  if (!inBrowser) return <div className="min-h-[190px] lg:min-h-0" aria-hidden="true" />

  return <SoundCheck />
}
