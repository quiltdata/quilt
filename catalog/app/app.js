/* app.js - application entry point */
// Needed for redux-saga es6 generator support
import '@babel/polyfill'

/* eslint-disable import/first */

// Import all the third party stuff
import * as React from 'react'
import ReactDOM from 'react-dom'
import { createBrowserHistory as createHistory } from 'history'
import 'sanitize.css/sanitize.css'
import { ThemeProvider } from '@material-ui/styles'

// Import root app
import Error from 'components/Error'
import * as Intercom from 'components/Intercom'
import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import App from 'containers/App'
import LanguageProvider from 'containers/LanguageProvider'
import * as Auth from 'containers/Auth'
import * as Notifications from 'containers/Notifications'
import * as routes from 'constants/routes'
import * as style from 'constants/style'
import * as AWSCredentials from 'utils/AWS/Credentials'
import * as AWSConfig from 'utils/AWS/Config'
import * as AWSSigner from 'utils/AWS/Signer'
import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'
import FormProvider from 'utils/ReduxFormProvider'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import fontLoader from 'utils/fontLoader'
import { nest, composeComponent } from 'utils/reactTools'
import RouterProvider, { LOCATION_CHANGE, selectLocation } from 'utils/router'
import mkStorage from 'utils/storage'
import Tracking from 'utils/tracking'
// Load the icons
/* eslint-disable import/no-unresolved, import/extensions */
import '!file-loader?name=[name].[ext]!./favicon.ico'
import '!file-loader?name=[name].[ext]!./quilt-og.png'
/* eslint-enable import/no-unresolved, import/extensions */
// Import i18n messages
import { translationMessages } from './i18n'
// Import CSS reset and Global Styles
import WithGlobalStyles from './global-styles'

// listen for Roboto fonts
fontLoader('Roboto', 'Roboto Mono').then(() => {
  // reload doc when we have all custom fonts
  document.body.classList.add('fontLoaded')
})

const ErrorBoundary = composeComponent(
  'ErrorBoundary',
  Sentry.inject(),
  createBoundary(({ sentry }) => (error, info) => {
    sentry('captureException', error, info)
    return (
      <Layout bare>
        <Error headline="Unexpected Error" detail="Something went wrong" />
      </Layout>
    )
  }),
)

// error gets automatically logged to the console, so no need to do it explicitly
const FinalBoundary = createBoundary(() => (/* error, info */) => (
  <h1 style={{ textAlign: 'center' }}>Something went wrong</h1>
))

const history = createHistory()
const MOUNT_NODE = document.getElementById('app')

// TODO: make storage injectable
const storage = mkStorage({ user: 'USER', tokens: 'TOKENS' })

const intercomUserSelector = (state) => {
  const { user: u } = Auth.selectors.domain(state)
  return (
    u && {
      user_id: u.current_user,
      name: u.current_user,
      email: u.email,
    }
  )
}

const sentryUserSelector = (state) => {
  const { user: u } = Auth.selectors.domain(state)
  return u ? { username: u.current_user, email: u.email } : {}
}

const render = (messages) => {
  ReactDOM.render(
    nest(
      WithGlobalStyles,
      FinalBoundary,
      Sentry.Provider,
      [Store.Provider, { history }],
      [LanguageProvider, { messages }],
      [NamedRoutes.Provider, { routes }],
      [RouterProvider, { history }],
      Data.Provider,
      Cache.Provider,
      [Config.Provider, { path: '/config.json' }],
      [ThemeProvider, { theme: style.theme }],
      [React.Suspense, { fallback: <Placeholder /> }],
      [Sentry.Loader, { userSelector: sentryUserSelector }],
      ErrorBoundary,
      FormProvider,
      Notifications.Provider,
      [APIConnector.Provider, { fetch, middleware: [Auth.apiMiddleware] }],
      [Auth.Provider, { checkOn: LOCATION_CHANGE, storage }],
      [
        Intercom.Provider,
        {
          userSelector: intercomUserSelector,
          horizontal_padding:
            // align the launcher with the right side of the container
            (window.innerWidth - Math.min(1280, window.innerWidth)) / 2 + 32,
          vertical_padding: 59,
        },
      ],
      [
        Tracking,
        {
          locationSelector: selectLocation,
          userSelector: Auth.selectors.username,
        },
      ],
      AWSCredentials.Provider,
      AWSConfig.Provider,
      AWSSigner.Provider,
      Notifications.WithNotifications,
      ErrorBoundary,
      App,
    ),
    MOUNT_NODE,
  )
}

/*
if (module.hot) {
  // Hot reloadable React components and translation json files
  // modules.hot.accept does not accept dynamic dependencies,
  // have to be constants at compile-time
  module.hot.accept(['./i18n', 'containers/App'], () => {
    ReactDOM.unmountComponentAtNode(MOUNT_NODE);
    render(translationMessages);
  });
}
*/

// Chunked polyfill for browsers without Intl support
if (!window.Intl) {
  import('intl')
    .then(() => Promise.all([import('intl/locale-data/jsonp/en.js')]))
    .then(() => render(translationMessages))
} else {
  render(translationMessages)
}
