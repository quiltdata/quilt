/* app.js - application entry point */
// Needed for redux-saga es6 generator support
import '@babel/polyfill'

/* eslint-disable import/first */

// Import all the third party stuff
import * as React from 'react'
import ReactDOM from 'react-dom'
import { createMemoryHistory as createHistory } from 'history'
import * as M from '@material-ui/core'

// side-effect: inject global css
import 'sanitize.css'

// Import root app
import Error from 'components/Error'
import Placeholder from 'components/Placeholder'
import { BucketCacheProvider } from 'containers/Bucket'
import Headless from 'containers/HeadlessFileBrowser'
import LanguageProvider from 'containers/LanguageProvider'
//import * as Auth from 'containers/Auth'
import * as Notifications from 'containers/Notifications'
import * as routes from 'constants/embed-routes'
import * as style from 'constants/style'
import * as AWS from 'utils/AWS'
import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'
//import FormProvider from 'utils/ReduxFormProvider'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
//import fontLoader from 'utils/fontLoader'
import { nest, composeComponent } from 'utils/reactTools'
import RouterProvider, { LOCATION_CHANGE } from 'utils/router'
// Load the icons
// Import i18n messages
import { translationMessages } from './i18n'
// Import CSS reset and Global Styles
import WithGlobalStyles from './global-styles'

// listen for Roboto fonts
//fontLoader('Roboto', 'Roboto Mono').then(() => {
  //// reload doc when we have all custom fonts
  //document.body.classList.add('fontLoaded')
//})

const ErrorBoundary = composeComponent(
  'ErrorBoundary',
  Sentry.inject(),
  createBoundary(({ sentry }) => (error, info) => {
    sentry('captureException', error, info)
    return (
      <h1
        style={{
          alignItems: 'center',
          color: '#fff',
          display: 'flex',
          height: '90vh',
          justifyContent: 'center',
          maxHeight: '600px',
        }}
      >
        Something went wrong
      </h1>
    )
  }),
)

// error gets automatically logged to the console, so no need to do it explicitly
const FinalBoundary = createBoundary(() => (/* error, info */) => (
  <h1
    style={{
      alignItems: 'center',
      color: '#fff',
      display: 'flex',
      height: '90vh',
      justifyContent: 'center',
      maxHeight: '600px',
    }}
  >
    Something went wrong
  </h1>
))

const history = createHistory()

//const sentryUserSelector = (state) => {
  //const { user: u } = Auth.selectors.domain(state)
  //return u ? { username: u.current_user, email: u.email } : {}
//}

const render = (messages) => {
  ReactDOM.render(
    nest(
      // TODO: customize theme
      [M.MuiThemeProvider, { theme: style.appTheme }],
      WithGlobalStyles,
      FinalBoundary,
      // TODO: do we need / want sentry here
      Sentry.Provider,
      [Store.Provider, { history }],
      [LanguageProvider, { messages }],
      [NamedRoutes.Provider, { routes }],
      [RouterProvider, { history }],
      Cache.Provider,
      // TODO: separate config if needed or maybe just init from postMessage
      [Config.Provider, { path: '/config.json' }],
      [React.Suspense, { fallback: <Placeholder /> }],
      //[Sentry.Loader, { userSelector: sentryUserSelector }],
      ErrorBoundary,
      //FormProvider,
      Notifications.Provider,
      //[APIConnector.Provider, { fetch, middleware: [Auth.apiMiddleware] }],
      [APIConnector.Provider, { fetch }],
      //[Auth.Provider, { checkOn: LOCATION_CHANGE, storage }],
      AWS.Credentials.Provider,
      AWS.Config.Provider,
      AWS.S3.Provider,
      AWS.Signer.Provider,
      Notifications.WithNotifications,
      ErrorBoundary,
      BucketCacheProvider,
      Headless,
    ),
    document.getElementById('app'),
  )
}

const polyfills = []

// Chunked polyfill for browsers without Intl support
if (!window.Intl)
  polyfills.push(
    import('intl').then(() => Promise.all([import('intl/locale-data/jsonp/en.js')])),
  )

if (!window.ResizeObserver)
  polyfills.push(
    import('resize-observer-polyfill').then(({ default: RO }) => {
      window.ResizeObserver = RO
    }),
  )

Promise.all(polyfills).then(() => render(translationMessages))
