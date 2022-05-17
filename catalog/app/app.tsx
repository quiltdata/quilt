/* app.tsx - application entry point */
/* eslint-disable import/first */

// Import all the third party stuff
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { createBrowserHistory as createHistory } from 'history'
import * as M from '@material-ui/core'

// side-effect: inject global css
import 'sanitize.css'

// Import root app
import { ExperimentsProvider } from 'components/Experiments'
import * as Intercom from 'components/Intercom'
import Placeholder from 'components/Placeholder'
import App from 'containers/App'
import * as Auth from 'containers/Auth'
import * as Errors from 'containers/Errors'
import * as Notifications from 'containers/Notifications'
import * as routes from 'constants/routes'
import * as style from 'constants/style'
import * as AWS from 'utils/AWS'
import * as APIConnector from 'utils/APIConnector'
import { GraphQLProvider } from 'utils/GraphQL'
import { BucketCacheProvider } from 'utils/BucketCache'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import fontLoader from 'utils/fontLoader'
import { nest } from 'utils/reactTools'
import RouterProvider, { LOCATION_CHANGE, selectLocation } from 'utils/router'
import mkStorage from 'utils/storage'
import * as Tracking from 'utils/tracking'
// Load the icons
/* eslint-disable import/no-unresolved, import/extensions */
import '!file-loader?name=[name].[ext]!./favicon.ico'
import '!file-loader?name=[name].[ext]!./quilt-og.png'
// Import CSS reset and Global Styles
import WithGlobalStyles from './global-styles'

// listen for Roboto fonts
fontLoader('Roboto', 'Roboto Mono').then(() => {
  // reload doc when we have all custom fonts
  document.body.classList.add('fontLoaded')
})

const history = createHistory()
const MOUNT_NODE = document.getElementById('app')

// TODO: make storage injectable
const storage = mkStorage({ user: 'USER', tokens: 'TOKENS' })

const intercomUserSelector = (state: $TSFixMe) => {
  const { user: u } = Auth.selectors.domain(state)
  return (
    u && {
      user_id: u.current_user,
      name: u.current_user,
      email: u.email,
    }
  )
}

const sentryUserSelector = (state: $TSFixMe) => {
  const { user: u } = Auth.selectors.domain(state)
  return u ? { username: u.current_user, email: u.email } : {}
}

const render = () => {
  ReactDOM.render(
    nest(
      [M.MuiThemeProvider as React.ComponentType, { theme: style.appTheme }],
      WithGlobalStyles,
      Errors.FinalBoundary,
      // @ts-expect-error
      Sentry.Provider,
      [Store.Provider, { history }],
      [NamedRoutes.Provider, { routes }],
      [RouterProvider, { history }],
      Cache.Provider,
      [Config.Provider, { path: '/config.json' }],
      [React.Suspense, { fallback: <Placeholder /> }],
      [Sentry.Loader, { userSelector: sentryUserSelector }],
      GraphQLProvider,
      Errors.ErrorBoundary,
      Notifications.Provider,
      [APIConnector.Provider, { fetch, middleware: [Auth.apiMiddleware] }],
      [Auth.Provider, { checkOn: LOCATION_CHANGE, storage }],
      [
        Intercom.Provider,
        {
          userSelector: intercomUserSelector,
          horizontal_padding:
            // align the launcher with the right side of the container
            (window.innerWidth - Math.min(1280, window.innerWidth)) / 2 + 24,
          vertical_padding: 59,
        },
      ],
      ExperimentsProvider,
      [
        Tracking.Provider,
        {
          locationSelector: selectLocation,
          userSelector: Auth.selectors.username,
        },
      ],
      AWS.Credentials.Provider,
      AWS.Config.Provider,
      AWS.Athena.Provider,
      AWS.S3.Provider,
      Notifications.WithNotifications,
      Errors.ErrorBoundary,
      BucketCacheProvider,
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

render()
