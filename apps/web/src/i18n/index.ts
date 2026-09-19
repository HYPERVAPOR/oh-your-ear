import { createI18n } from '@oh-your-ear/shared/i18n'

import en from './locales/en/common.json'
import zh from './locales/zh/common.json'

export default createI18n({ ns: 'common', resources: { en, zh } })
