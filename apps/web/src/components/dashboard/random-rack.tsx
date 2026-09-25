import { useTranslation } from 'react-i18next'

import { RackCell } from '@/components/dashboard/rack-cell'
import { modulePath } from '@/components/round-summary'
import { MODULES, MODULE_SWATCH } from '@/components/ui/orb'

/**
 * The Random tab: endless practice, open to guests. No progress bars — there is nothing
 * to make progress on — and no sentence under the module's name saying what the module is;
 * the name is the whole statement. The notebook of wrong answers is not a drill either and
 * lives with the account.
 */
export function RandomRack() {
  const { t } = useTranslation('common')

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {MODULES.map((kind) => (
        <RackCell
          key={kind}
          to={`/exercise/${modulePath(kind)}`}
          swatch={MODULE_SWATCH[kind]}
          title={t(`modules.${kind}`)}
        />
      ))}
    </div>
  )
}
