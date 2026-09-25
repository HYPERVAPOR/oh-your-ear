import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { RackCell } from '@/components/dashboard/rack-cell'
import { modulePath } from '@/components/round-summary'
import { MODULES, MODULE_SWATCH, type ExerciseKind } from '@/components/ui/orb'
import { loginPath } from '@/lib/auth'
import { currentLevel, levelsFor, useLevelCatalog, type LevelProgressEntry } from '@/lib/levels'
import { useAuthStore } from '@/stores/auth-store'

/**
 * One chain: how far along it is, and where to pick it up. The cell carries the module's
 * name, its bar and `passed/total` — no sentence saying what the bar already says.
 */
function ChainCell({
  kind,
  signedIn,
  progress,
}: {
  kind: ExerciseKind
  signedIn: boolean
  progress: Map<string, LevelProgressEntry>
}) {
  const { t } = useTranslation('common')
  const { data: catalog } = useLevelCatalog()
  const sets = catalog ?? []

  const levels = levelsFor(sets, kind)
  const passed = levels.filter((level) => progress.get(level.slug)?.passed).length
  const percent = levels.length > 0 ? Math.round((passed / levels.length) * 100) : 0
  const level = currentLevel(sets, kind, progress)

  const target = level ? `/exercise/${modulePath(kind)}?level=${level.slug}` : '/levels'

  return (
    <RackCell
      to={signedIn ? target : loginPath(target)}
      swatch={MODULE_SWATCH[kind]}
      title={t(`modules.${kind}`)}
    >
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
        <ChainCell key={kind} kind={kind} signedIn={!!user} progress={byId} />
      ))}
    </div>
  )
}
