import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { ConfigRow, Toggle } from '@/components/exercises/config-panel'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
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

  const valid = dailyGoal >= 1 && dailyGoal <= 500

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-[22px] font-medium leading-tight">{t('plan.title')}</h2>
      <p className="mt-2 text-[15px] text-body">{t('plan.description')}</p>

      <div className="mt-6 space-y-5">
        <ConfigRow label={t('plan.dailyGoal')}>
          <Input
            id="daily-goal"
            type="number"
            min={1}
            max={500}
            value={dailyGoal}
            onChange={(event) => {
              setSaved(false)
              setDraft({ dailyGoal: Number(event.target.value), focus })
            }}
            className="tabular w-28"
            aria-label={t('plan.dailyGoal')}
          />
        </ConfigRow>

        <div>
          <ConfigRow label={t('plan.focus')}>
            <div className="flex flex-wrap justify-end gap-2">
              {EXERCISES.map((kind) => (
                <Toggle
                  key={kind}
                  label={t(`modules.${kind}`)}
                  checked={focus.includes(kind)}
                  onChange={() => toggle(kind)}
                />
              ))}
            </div>
          </ConfigRow>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={save} disabled={saving || !valid}>
          {t('plan.save')}
        </Button>
        {saved && <span className="text-[14px] text-success-text">{t('plan.saved')}</span>}
        <Link
          to="/daily"
          className="text-[14px] text-muted underline underline-offset-4 hover:text-ink"
        >
          {t('plan.goToday')}
        </Link>
      </div>
    </Card>
  )
}
