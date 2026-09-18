import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import type { components } from '@/api/schema'

type ExerciseKind = components['schemas']['ExerciseKind']

const EXERCISES: ExerciseKind[] = ['singleNote', 'interval', 'chord', 'melody', 'rhythm']

interface Draft {
  dailyGoal: number
  focus: ExerciseKind[]
}

/** Daily goal and focus modules. Creating a plan is what unlocks progress stats. */
export function StudyPlanForm() {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['study-plan'],
    queryFn: async () => {
      const { data: plan } = await apiClient.GET('/me/plan')
      return plan
    },
  })

  // The stored plan is the source of truth until the user edits the form.
  const dailyGoal = draft?.dailyGoal ?? data?.dailyGoal ?? 20
  const focus = draft?.focus ?? data?.focusExercises ?? []

  function toggle(kind: ExerciseKind) {
    setSaved(false)
    const next = focus.includes(kind) ? focus.filter((item) => item !== kind) : [...focus, kind]
    setDraft({ dailyGoal, focus: next })
  }

  async function save() {
    setSaving(true)
    const { data: plan, response } = await apiClient.PUT('/me/plan', {
      body: { dailyGoal, focusExercises: focus },
    })
    setSaving(false)
    if (response.ok && plan) {
      setSaved(true)
      setDraft({ dailyGoal: plan.dailyGoal, focus: plan.focusExercises })
    }
  }

  return (
    <section className="rounded-md border border-border p-6">
      <h2 className="font-medium">{t('plan.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('plan.description')}</p>

      <label className="mt-5 block text-sm font-medium" htmlFor="daily-goal">
        {t('plan.dailyGoal')}
      </label>
      <input
        id="daily-goal"
        type="number"
        min={1}
        max={500}
        value={dailyGoal}
        onChange={(e) => {
          setSaved(false)
          setDraft({ dailyGoal: Number(e.target.value), focus })
        }}
        className="mt-2 w-28 rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">{t('plan.focus')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXERCISES.map((kind) => (
            <label
              key={kind}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={focus.includes(kind)}
                onChange={() => toggle(kind)}
              />
              {t(`modules.${kind}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={saving || dailyGoal < 1 || dailyGoal > 500}>
          {t('plan.save')}
        </Button>
        {saved && <span className="text-sm text-success">{t('plan.saved')}</span>}
      </div>
    </section>
  )
}
