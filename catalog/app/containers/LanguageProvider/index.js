/*
 *
 * LanguageProvider
 *
 * this component connects the redux state language locale to the
 * IntlProvider component and i18n messages (loaded from `app/translations`)
 */

import PropTypes from 'prop-types'
import * as React from 'react'
import { connect } from 'react-redux'
import { mapProps, setPropTypes } from 'recompose'
import { createSelector } from 'reselect'
import { IntlProvider, injectIntl } from 'react-intl'

import { composeComponent } from 'utils/reactTools'
import { injectReducer } from 'utils/ReducerInjector'

import { REDUX_KEY } from './constants'
import reducer from './reducer'
import { makeSelectLocale } from './selectors'

const IntlContext = React.createContext({})

const IntlContextProvider = injectIntl(({ intl, children }) => (
  <IntlContext.Provider value={intl}>{children}</IntlContext.Provider>
))

export const useIntl = () => React.useContext(IntlContext)

export default composeComponent(
  'LanguageProvider',
  injectReducer(REDUX_KEY, reducer),
  connect(
    createSelector(
      makeSelectLocale(),
      (locale) => ({ locale }),
    ),
  ),
  setPropTypes({
    locale: PropTypes.string,
    messages: PropTypes.object,
    children: PropTypes.element.isRequired,
  }),
  mapProps(({ locale, messages, ...props }) => ({
    locale,
    key: locale,
    messages: messages[locale],
    ...props,
  })),
  ({ children, ...props }) => (
    <IntlProvider {...props}>
      <IntlContextProvider>{children}</IntlContextProvider>
    </IntlProvider>
  ),
)
