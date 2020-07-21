/*
 *
 * LanguageProvider
 *
 * this component connects the redux state language locale to the
 * IntlProvider component and i18n messages (loaded from `app/translations`)
 */

import * as React from 'react'
import * as redux from 'react-redux'
import { IntlProvider, injectIntl } from 'react-intl'

import { useReducer } from 'utils/ReducerInjector'

import { REDUX_KEY } from './constants'
import reducer from './reducer'
import { makeSelectLocale } from './selectors'

const IntlContext = React.createContext({})

const IntlContextProvider = injectIntl(({ intl, children }) => (
  <IntlContext.Provider value={intl}>{children}</IntlContext.Provider>
))

export function useIntl() {
  return React.useContext(IntlContext)
}

const selectLocale = makeSelectLocale()

export default function LanguageProvider({ children, messages, ...props }) {
  useReducer(REDUX_KEY, reducer)
  const locale = redux.useSelector(selectLocale)
  return (
    <IntlProvider key={locale} locale={locale} messages={messages[locale]} {...props}>
      <IntlContextProvider>{children}</IntlContextProvider>
    </IntlProvider>
  )
}
