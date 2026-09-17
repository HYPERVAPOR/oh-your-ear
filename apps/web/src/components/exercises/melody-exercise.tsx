import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, EyeOff, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { playSequence } from '@/lib/audio'
import { BooleanToggle, ConfigPanel, SliderField } from '@/components/exercises/config-panel'
import { buildMelodyNotePool, useExerciseConfig } from '@/lib/exercise-config'

interface MelodyNote {
  id: string
  note: string
}

function generateMelody(length: number, notePool: string[]): MelodyNote[] {
  return Array.from({ length }, () => ({
    id: crypto.randomUUID(),
    note: notePool[Math.floor(Math.random() * notePool.length)],
  }))
}

interface MelodyExerciseProps {
  onBack?: () => void
}

export function MelodyExercise({ onBack }: MelodyExerciseProps) {
  const { t } = useTranslation('common')
  const { config, updateConfig, resetConfig } = useExerciseConfig('melody')
  const notePool = useMemo(() => buildMelodyNotePool(config), [config])
  const [notes, setNotes] = useState(() => generateMelody(config.length, notePool))
  const [playing, setPlaying] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const noteNames = notes.map((item) => item.note)

  const playMelody = useCallback(async () => {
    setPlaying(true)
    await playSequence(noteNames, '8n', 0.4)
    setTimeout(() => setPlaying(false), noteNames.length * 400)
  }, [noteNames])

  const newMelody = useCallback(() => {
    setNotes(generateMelody(config.length, buildMelodyNotePool(config)))
    setShowNotes(false)
  }, [config])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t('modules.melody')}</h1>
              <p className="text-xs text-muted-foreground">{t('exercises.randomTest')}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <p className="mb-8 text-center text-muted-foreground">{t('exercises.instructionMelody')}</p>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={playMelody} disabled={playing}>
            {playing ? t('actions.playing') : t('actions.play')}
          </Button>
          <Button variant="outline" onClick={playMelody} disabled={playing}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('actions.replay')}
          </Button>
        </div>

        <div className="mb-8 grid min-h-[4rem] auto-cols-min grid-flow-col gap-2">
          {showNotes ? (
            notes.map((item) => (
              <div
                key={item.id}
                className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted text-lg font-medium"
              >
                {item.note}
              </div>
            ))
          ) : (
            <div className="flex h-12 items-center justify-center text-sm text-muted-foreground">
              {t('exercises.hiddenNotation')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => setShowNotes((prev) => !prev)}>
            {showNotes ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                {t('actions.hideNotes')}
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                {t('actions.showNotes')}
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={newMelody}>
            {t('actions.newMelody')}
          </Button>
        </div>

        <div className="mt-8 w-full max-w-md">
          <ConfigPanel title={t('exerciseConfig.title')} onReset={resetConfig}>
            <div className="space-y-4">
              <SliderField
                label={t('exerciseConfig.melodyLength')}
                value={config.length}
                min={3}
                max={7}
                onChange={(length) => updateConfig({ length })}
              />
              <BooleanToggle
                label={t('exerciseConfig.whiteKeys')}
                checked={config.whiteKeys}
                onChange={(whiteKeys) => updateConfig({ whiteKeys })}
              />
              <BooleanToggle
                label={t('exerciseConfig.blackKeys')}
                checked={config.blackKeys}
                onChange={(blackKeys) => updateConfig({ blackKeys })}
              />
            </div>
          </ConfigPanel>
        </div>
      </main>
    </div>
  )
}
