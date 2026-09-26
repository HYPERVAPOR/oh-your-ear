import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { apiClient } from '@/api/client'
import { ConfigRow } from '@/components/exercises/config-panel'
import { MODULE_SWATCH, ModuleSwatch } from '@/components/ui/orb'
import { cn } from '@/lib/utils'
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
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  // Set only by a save that went through: "saved" is something that happened, not a way of
  // describing a plan nobody has touched yet.
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['study-plan'],
    queryFn: async () => {
      const { data: plan } = await apiClient.GET('/me/plan')
      return plan
    },
  })

  // The stored plan is the source of truth until the user edits the form.
  const stored = useMemo(() => {
    const focus = (data?.focusExercises ?? []) as ExerciseKind[]
    // An empty list is stored as "no narrowing down", which the app reads as every module.
    // The form has to show that meaning, or it says the opposite of what the plan does.
    return { dailyGoal: data?.dailyGoal ?? 20, focus: focus.length > 0 ? focus : EXERCISES }
  }, [data])
  const dailyGoal = draft?.dailyGoal ?? stored.dailyGoal
  const focus = draft?.focus ?? stored.focus

  function toggle(kind: ExerciseKind) {
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
      // The saved plan is now the stored plan, so there is nothing left to compare the draft
      // against. Writing it into the cache is what keeps the two in step; without it the form
      // would still be measuring against the plan it just replaced.
      queryClient.setQueryData(['study-plan'], plan)
      setDraft(null)
      setSaved(true)
    }
  }

  const valid = dailyGoal >= 1 && dailyGoal <= 500 && focus.length > 0
  // Whether there is anything to save. Order does not matter in the focus list, so it is
  // compared as a set; nothing counts as changed until the stored plan has arrived.
  const changed =
    data !== undefined &&
    (dailyGoal !== stored.dailyGoal ||
      focus.length !== stored.focus.length ||
      focus.some((kind) => !stored.focus.includes(kind)))
  // A disabled button has to say why it is disabled.
  const refused =
    dailyGoal < 1 || dailyGoal > 500
      ? t('plan.goalRange')
      : focus.length === 0
        ? t('plan.pickOne')
        : null

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-[22px] font-medium leading-tight">{t('plan.title')}</h2>

      <div className="mt-6 space-y-5">
        <ConfigRow label={t('plan.dailyGoal')}>
          <Input
            id="daily-goal"
            type="number"
            min={1}
            max={500}
            value={dailyGoal}
            onChange={(event) => {
              setDraft({ dailyGoal: Number(event.target.value), focus })
            }}
            className="tabular w-28"
            aria-label={t('plan.dailyGoal')}
          />
        </ConfigRow>

        <div>
          <span className="text-[15px] font-medium">{t('plan.focus')}</span>
          {/* The label sits above rather than beside: five cells that have to come out the
              same length cannot share a row with a label that is a different length in every
              language. Equal columns at every width, for the same reason the level page's tabs
              give each module an equal share — the names are nothing like each other in length,
              and a row that resizes as you tick a box is a row that jumps. Five across on a
              phone leaves each one 49px, where "Single Note" runs over its neighbours, so below
              the dashboard's own breakpoint this is two columns like the module grids are. */}
          <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-x-2 md:grid-cols-5">
            {EXERCISES.map((kind) => {
              const on = focus.includes(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(kind)}
                  className={cn(
                    'relative flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-3 py-2.5 text-[15px] transition-colors',
                    on ? 'text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {/* Unlit until chosen, the way a tab's own colour is: a row of five
                      saturated dots promises five things are on. */}
                  <ModuleSwatch kind={kind} className={on ? '' : 'opacity-40'} />
                  {t(`modules.${kind}`)}
                  {/* The level page's handle: the module's own colour under the ones you
                      chose, absolutely placed so that having it or not having it cannot
                      change the height of the row. */}
                  {on && (
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-x-0 bottom-0 h-0.5', MODULE_SWATCH[kind])}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {/* One width for both labels: the button says "saved" where it said "save", and a
            button that changes size when you press it is a button you notice instead of the
            thing it did. */}
        <Button onClick={save} disabled={saving || !valid || !changed} className="min-w-32 gap-2">
          {saved && !changed ? (
            <>
              <Check className="h-4 w-4" />
              {t('plan.saved')}
            </>
          ) : (
            t('plan.save')
          )}
        </Button>
        {refused && <span className="text-[14px] text-muted">{refused}</span>}
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
