export type Locale = 'en'
export type Messages = Record<string, string>
export type MessagesByLocale = Record<Locale, Messages>

export const DEFAULT_LOCALE: Locale
export const appLocales: Locale[]

export function formatTranslationMessages(locale: Locale, messages: Messages): Messages

export const translationMessages: MessagesByLocale
