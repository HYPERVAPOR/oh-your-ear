import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { RackCell } from '@/components/dashboard/rack-cell'
import { MODULES, MODULE_SWATCH, type ExerciseKind } from '@/components/ui/orb'
import { levelsFor, useLevelCatalog, type LevelProgressEntry } from '@/lib/levels'
import { useAuthStore } from '@/stores/auth-store'

/**
 * One chain: how far along it is, and where to read the rest of it. The cell carries the
 * module's name, its bar and `passed/total` — no sentence saying what the bar already says.
 */
function ChainCell({
  kind,
  progress,
}: {
  kind: ExerciseKind
  progress: Map<string, LevelProgressEntry>
}) {
  const { t } = useTranslation('common')
  const { data: catalog } = useLevelCatalog()
  const levels = levelsFor(catalog ?? [], kind)
  const passed = levels.filter((level) => progress.get(level.slug)?.passed).length
  const percent = levels.length > 0 ? Math.round((passed / levels.length) * 100) : 0

  // To the module's tab on the levels page, not into whichever level comes next: which one
  // to practise is the reader's call, and the chain is where that call is made. It is also
  // the one page that is open to guests, so nobody is asked to sign in to look.
  const target = `/levels?module=${kind}`

  return (
    <RackCell to={target} swatch={MODULE_SWATCH[kind]} title={t(`modules.${kind}`)}>
      <span className="mt-2 flex items-center gap-2">
        <span className="block h-1 w-full overflow-hidden bg-surface-strong">
          <span className="block h-full bg-primary" style={{ width: `${percent}%` }} />
        </span>
        <span className="tabular shrink-0 text-[12px] text-muted">
          {t('home.passedOf', { passed, total: levels.length })}
        </span>
      </span>
    </RackCell>
  )
}

/**
 * The Learn tab: the five chains, each carrying how far along it is (PRD 7.1.4). The
 * folders of saved levels are not a chain and live with the account instead.
 */
export function LevelRack() {
  const user = useAuthStore((s) => s.user)

  const { data: progress } = useQuery({
    queryKey: ['level-progress'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/levels')
      return data
    },
  })

  const byId = new Map<string, LevelProgressEntry>(
    (progress ?? []).map((entry) => [entry.levelId, entry]),
  )

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {MODULES.map((kind) => (
        <ChainCell key={kind} kind={kind} progress={byId} />
      ))}
    </div>
  )
}
