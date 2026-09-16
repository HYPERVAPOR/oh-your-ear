import { useRef, useState } from 'react'
import * as Tone from 'tone'
import { Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ponytail: built-in synth placeholder; replace with Salamander sampler when
// sample loading / caching is implemented (M1.1 proper).

export interface PlayButtonProps {
  note: string
  className?: string
  duration?: string
  label?: string
}

export function PlayButton({ note, className, duration = '8n', label }: PlayButtonProps) {
  const synthRef = useRef<Tone.Synth | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      await Tone.start()
      if (!synthRef.current) {
        synthRef.current = new Tone.Synth().toDestination()
      }
      synthRef.current.triggerAttackRelease(note, duration)
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
      aria-label={`Play ${note}`}
      title={`Play ${note}`}
    >
      <Volume2 className={cn('h-5 w-5', label && 'h-4 w-4')} />
      {label}
    </Button>
  )
}
