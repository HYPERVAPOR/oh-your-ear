import { createI18n } from '@oh-your-ear/shared/i18n'

import en from './locales/en/landing.json'
import zh from './locales/zh/landing.json'

export default createI18n({ ns: 'landing', resources: { en, zh } })
