import { useState } from 'react'
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

export function PlayButton({ note, className, duration = '8n', label }: PlayButtonProps) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      await Tone.start()
      const piano = await getPiano()
      piano.triggerAttackRelease(note, duration)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size={label ? 'default' : 'icon'}
      className={cn(className)}
      onClick={handleClick}
      disabled={busy}
      aria-label={t('actions.playNote', { note })}
      title={t('actions.playNote', { note })}
    >
      <Volume2 className={cn('h-5 w-5', label && 'h-4 w-4')} />
      {label}
    </Button>
  )
}
