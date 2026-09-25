import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bookmark } from 'lucide-react'

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
 * The Learn band: the five chains, each carrying how far along it is, plus the folders of
 * levels a reader has made for themselves (PRD 7.1.4).
 */
export function LevelRack() {
  const { t } = useTranslation('common')
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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {MODULES.map((kind) => (
        <ChainCell key={kind} kind={kind} signedIn={!!user} progress={byId} />
      ))}

      {/* The sixth cell closes the rectangle and belongs to this mode: a folder of levels
          is still a set of levels. */}
      <RackCell
        to={user ? '/bookmarks' : loginPath('/bookmarks')}
        title={t('collections.title')}
        swatch="bg-hairline-strong"
      >
        <span className="mt-3.5 flex items-center gap-2 text-[13px] leading-snug text-body">
          <Bookmark aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {t('home.collectionsHint')}
        </span>
      </RackCell>
    </div>
  )
}
