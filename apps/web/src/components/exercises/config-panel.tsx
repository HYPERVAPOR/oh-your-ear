import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, RotateCcw, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { useLevelRequested } from '@/lib/levels'
import { cn } from '@/lib/utils'

/** Collapsed settings: a quiet control that opens into hairline-separated rows. */
export function ConfigPanel({
  title,
  onReset,
  children,
}: {
  title: string
  onReset?: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const levelRequested = useLevelRequested()

  // A question set fixes the configuration: its screen shows what the level asks and
  // nothing to change. Hidden here rather than in each exercise, because every exercise
  // screen draws its settings through this component — the same `if` in five files is
  // five chances to forget it, and one of them will be forgotten.
  if (levelRequested) return null

  return (
    <div className="w-full rounded-xl border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-[15px] font-medium text-body transition-colors hover:text-ink"
      >
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          {title}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-hairline px-5 py-5">
          <div className="space-y-5">{children}</div>
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-5 gap-1.5"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('exerciseConfig.reset')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Label on the left, control on the right, wrapping on narrow screens. */
export function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[15px] font-medium">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/** Multi-select as pills: an ink pill means included. */
export function ToggleGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const { t } = useTranslation('common')
  const selectedSet = new Set(selected)
  const allSelected = selectedSet.size === options.length

  function toggle(value: string) {
    const next = new Set(selectedSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(Array.from(next))
  }

  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-[15px] font-medium">{label}</legend>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
          className="text-[13px] text-muted underline underline-offset-4 transition-colors hover:text-ink"
        >
          {allSelected ? t('exerciseConfig.clearAll') : t('exerciseConfig.selectAll')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label: optionLabel }) => {
          const active = selectedSet.has(value)
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(value)}
              className={cn(
                'rounded-none border px-3.5 py-1.5 text-[14px] transition-colors',
                // Twelve ink pills would be a wall of black: a multi-select uses the
                // quiet fill for "on" and lets ink stay for the primary action.
                active
                  ? 'border-transparent bg-surface-strong text-ink'
                  : 'border-hairline text-muted-soft hover:border-hairline-strong hover:text-ink',
              )}
            >
              {optionLabel}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Single on/off pill. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'rounded-none border px-3.5 py-1.5 text-[14px] transition-colors',
        checked
          ? 'border-transparent bg-surface-strong text-ink'
          : 'border-hairline text-muted-soft hover:border-hairline-strong hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <ConfigRow label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-40 accent-[var(--ink)]"
          aria-label={label}
        />
        <span className="tabular w-8 text-right text-[15px] text-body">
          {value}
          {suffix}
        </span>
      </div>
    </ConfigRow>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <ConfigRow label={label}>
      <Select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="w-48"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </ConfigRow>
  )
}
