import { useState } from 'react'
import { Settings, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ConfigPanelProps {
  title: string
  onReset?: () => void
  children: React.ReactNode
}

export function ConfigPanel({ title, onReset, children }: ConfigPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          {title}
        </span>
        <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {children}
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-4 gap-1"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

interface CheckboxOption {
  value: string
  label: string
}

interface CheckboxGroupProps {
  label: string
  options: CheckboxOption[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function CheckboxGroup({ label, options, selected, onChange }: CheckboxGroupProps) {
  const selectedSet = new Set(selected)

  function toggle(value: string) {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    onChange(Array.from(next))
  }

  function toggleAll() {
    if (selectedSet.size === options.length) {
      onChange([])
    } else {
      onChange(options.map((o) => o.value))
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={selectedSet.size === options.length}
            onChange={toggleAll}
          />
          全选
        </label>
        {options.map(({ value, label: optLabel }) => (
          <label
            key={value}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              value={value}
              checked={selectedSet.has(value)}
              onChange={() => toggle(value)}
            />
            {optLabel}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function SliderField({ label, value, min, max, onChange }: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}: {value}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

interface BooleanToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function BooleanToggle({ label, checked, onChange }: BooleanToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}
