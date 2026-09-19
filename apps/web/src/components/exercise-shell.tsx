import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ExerciseKind } from '@/components/ui/orb'

/**
 * Shared frame for every exercise screen: 64px header, the module's orb blooming
 * behind the top of the page, and a centred stage, because the object of attention
 * on these screens is one control in the middle.
 */
export function ExerciseShell({
  kind,
  onBack,
  score,
  progress,
  instruction = true,
  children,
}: {
  kind: ExerciseKind
  onBack?: () => void
  score: { correct: number; total: number }
  /** Questions done out of the round's size, when a round is running. */
  progress?: { done: number; size: number }
  /** Off for screens that are not asking a question, such as a round summary. */
  instruction?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-[21px] font-medium leading-none">
              {t(`modules.${kind}`)}
            </h1>
            <span className="badge-label hidden pt-1 text-muted sm:inline">
              {t('exercises.randomTest')}
            </span>
          </div>

          <p className="tabular text-[15px] text-muted">
            {progress ? t('round.progress', progress) : t('score', score)}
          </p>
        </div>

        {/* The header's own rule is the progress track: it fills in from the left
            as the round advances, so progress is visible without another element. */}
        {progress && (
          <div className="absolute inset-x-0 -bottom-px h-[3px] bg-hairline">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.min(100, (progress.done / progress.size) * 100)}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col items-center justify-center px-5 py-12 sm:py-16">
        {instruction && (
          <p className="mb-7 text-center text-[15px] text-body">{t(`moduleHints.${kind}`)}</p>
        )}
        {children}
      </main>
    </div>
  )
}

/** Feedback for one answered question. Sentence case, no exclamation marks. */
export function FeedbackNote({
  tone,
  children,
}: {
  tone: 'success' | 'error'
  children: ReactNode
}) {
  return (
    <p
      role="status"
      className={
        tone === 'success'
          ? 'rounded-none bg-success/10 px-4 py-2 text-center text-[15px] font-medium text-success-text'
          : 'rounded-none bg-error/10 px-4 py-2 text-center text-[15px] font-medium text-error-text'
      }
    >
      {children}
    </p>
  )
}

/**
 * Answer tile. Idle tiles are surfaces on hairlines; once answered they become
 * tinted the same way the feedback note is, so the screen reads as one verdict.
 */
export function OptionTile({
  state = 'idle',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  state?: 'idle' | 'correct' | 'wrong'
}) {
  // The verdict has to be unmistakable at a glance, and it cannot rest on colour
  // alone: a tint plus a full-strength border plus a mark.
  const states = {
    idle: 'border-hairline bg-surface hover:border-hairline-strong hover:shadow-soft',
    correct: 'border-success bg-success/15 text-success-text',
    wrong: 'border-error bg-error/15 text-error-text',
  }

  return (
    <button
      type="button"
      className={`relative rounded-xl border px-4 py-4 text-[17px] font-medium transition-all disabled:cursor-default disabled:hover:border-hairline disabled:hover:shadow-none ${states[state]} ${className ?? ''}`}
      {...props}
    >
      {children}
      {state !== 'idle' && (
        <span className="absolute right-3 top-3" aria-hidden="true">
          {state === 'correct' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </span>
      )}
    </button>
  )
}
