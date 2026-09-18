import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en/common.json'
import zh from './locales/zh/common.json'

// Keep <html lang> in sync for screen readers, search engines, and hyphenation.
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      zh: { common: zh },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
    },
  })

export default i18n
