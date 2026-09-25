import { useTranslation } from 'react-i18next'

import { RackCell } from '@/components/dashboard/rack-cell'
import { modulePath } from '@/components/round-summary'
import { MODULES, MODULE_SWATCH } from '@/components/ui/orb'

/**
 * The Random band: endless practice, open to guests. No progress bars — there is nothing
 * to make progress on — and no sentence under the module's name saying what the module
 * is; the name is the whole statement. The sixth cell is the mistakes notebook, which is
 * drawn from what you have already done rather than from a chain.
 */
export function RandomRack() {
  const { t } = useTranslation('common')

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {MODULES.map((kind) => (
        <RackCell
          key={kind}
          to={`/exercise/${modulePath(kind)}`}
          swatch={MODULE_SWATCH[kind]}
          title={t(`modules.${kind}`)}
        />
      ))}

      <RackCell to="/mistakes" swatch="bg-hairline-strong" title={t('home.mistakesTile')}>
        <span className="mt-2 block text-[13px] leading-snug text-body">
          {t('home.mistakesHint')}
        </span>
      </RackCell>
    </div>
  )
}
