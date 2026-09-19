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
}

/** Plays a note (or a stored chord/sequence) and resumes the audio context. */
export function PlayButton({ note, className, duration = '8n', label }: PlayButtonProps) {
  const { t } = useTranslation('common')

  async function handleClick() {
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
        className={cn('rounded-full', className)}
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
