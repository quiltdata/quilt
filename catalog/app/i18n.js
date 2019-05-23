/**
 * i18n.js
 *
 * This will setup the i18n language files and locale data for your app.
 *
 *   IMPORTANT: This file is used by the internal build
 *   script `extract-intl`, and must use CommonJS module syntax
 *   You CANNOT use import/export in this file.
 */
const { addLocaleData } = require('react-intl')
const enLocaleData = require('react-intl/locale-data/en')

const enTranslationMessages = require('./translations/en.json')

addLocaleData(enLocaleData)

const DEFAULT_LOCALE = 'en'
exports.DEFAULT_LOCALE = DEFAULT_LOCALE

const appLocales = ['en']
exports.appLocales = appLocales

const formatTranslationMessages = (locale, messages) => {
  const defaultFormattedMessages =
    locale !== DEFAULT_LOCALE
      ? formatTranslationMessages(DEFAULT_LOCALE, enTranslationMessages)
      : {}
  return Object.keys(messages).reduce((formattedMessages, key) => {
    let message = messages[key]
    if (!message && locale !== DEFAULT_LOCALE) {
      message = defaultFormattedMessages[key]
    }
    return Object.assign(formattedMessages, { [key]: message })
  }, {})
}
exports.formatTranslationMessages = formatTranslationMessages

const translationMessages = {
  en: formatTranslationMessages('en', enTranslationMessages),
}
exports.translationMessages = translationMessages
