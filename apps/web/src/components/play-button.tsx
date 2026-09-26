import { useTranslation } from 'react-i18next'
import * as Tone from 'tone'
import { Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getPiano } from '@/lib/audio'
import { cn } from '@/lib/utils'

export interface PlayButtonProps {
  note: string
  className?: string
  duration?: string
  label?: string
  /** Fired when the screen asks for the note, alongside the click rather than after the
   *  sample has loaded: every other module marks a question heard the moment its play
   *  button is pressed, and waiting on the loader would leave the answer tiles locked
   *  for good if it never arrives. */
  onPlay?: () => void
}

/** Plays a note (or a stored chord/sequence) and resumes the audio context. */
export function PlayButton({ note, className, duration = '8n', label, onPlay }: PlayButtonProps) {
  const { t } = useTranslation('common')

  async function handleClick() {
    onPlay?.()
    await Tone.start()
    const piano = await getPiano()
    piano.triggerAttackRelease(note, duration)
  }

  if (!label) {
    return (
      <Button
        type="button"
        size="icon"
        aria-label={t('actions.playNote', { note })}
        title={t('actions.playNote', { note })}
        className={cn('rounded-none', className)}
        onClick={handleClick}
      >
        <Volume2 className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="hero"
      // The label says "play"; only this says which note is about to sound.
      aria-label={t('actions.playNote', { note })}
      className={cn('gap-3', className)}
      onClick={handleClick}
    >
      <Volume2 className="h-5 w-5" />
      {label}
    </Button>
  )
}
