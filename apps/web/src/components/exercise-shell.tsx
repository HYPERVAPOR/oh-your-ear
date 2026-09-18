import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Orb } from '@/components/ui/orb'
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
  children,
}: {
  kind: ExerciseKind
  onBack?: () => void
  score: { correct: number; total: number }
  children: ReactNode
}) {
  const { t } = useTranslation('common')

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <Orb kind={kind} size="lg" className="-top-48 left-1/2 -translate-x-1/2" />

      <header className="relative border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-[21px] font-light leading-none">
              {t(`modules.${kind}`)}
            </h1>
            <span className="badge-label hidden pt-1 text-muted sm:inline">
              {t('exercises.randomTest')}
            </span>
          </div>

          <p className="tabular text-[15px] text-muted">{t('score', score)}</p>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-[600px] flex-1 flex-col items-center justify-center px-5 py-12 sm:py-16">
        <p className="mb-7 text-center text-[15px] text-body">{t(`moduleHints.${kind}`)}</p>
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
          ? 'rounded-full bg-success/10 px-4 py-2 text-center text-[15px] font-medium text-success-text'
          : 'rounded-full bg-error/10 px-4 py-2 text-center text-[15px] font-medium text-error-text'
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
