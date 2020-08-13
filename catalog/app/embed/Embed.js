// side-effect: inject global css
import 'sanitize.css'

import * as React from 'react'
import { Route, Switch, useHistory, useLocation } from 'react-router-dom'
import { createMemoryHistory as createHistory } from 'history'
import * as M from '@material-ui/core'

import * as Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
// import * as Auth from 'containers/Auth'
import { BucketCacheProvider, useBucketCache } from 'containers/Bucket'
import LanguageProvider from 'containers/LanguageProvider'
import { ThrowNotFound, createNotFound } from 'containers/NotFoundPage'
import * as Notifications from 'containers/Notifications'
import * as routes from 'constants/embed-routes'
import * as style from 'constants/style'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import * as RT from 'utils/reactTools'
import RouterProvider /* , { LOCATION_CHANGE } */ from 'utils/router'
import useConstant from 'utils/useConstant'

// TODO: consider reimplementing these locally or moving to some shared location
import { displayError } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

import WithGlobalStyles from '../global-styles'

import AppBar from './AppBar'

const mkLazy = (load) =>
  RT.loadable(load, { fallback: () => <Placeholder color="text.secondary" /> })

const Dir = mkLazy(() => import('./Dir'))
const File = mkLazy(() => import('./File'))
const Search = mkLazy(() => import('./Search'))

const FinalBoundary = createBoundary(() => () => (
  <h1
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 400,
      maxHeight: '90vh',
      fontFamily: 'sans-serif',
      margin: 0,
    }}
  >
    Something went wrong
  </h1>
))

function StyledError({ children }) {
  return (
    <M.Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      height={400}
      maxHeight="90vh"
      textAlign="center"
    >
      <M.Typography variant="h3">{children}</M.Typography>
    </M.Box>
  )
}

const ErrorBoundary = createBoundary(() => () => (
  <StyledError>Something went wrong</StyledError>
))

const CatchNotFound = createNotFound(() => <StyledError>Page not found</StyledError>)

function Root() {
  const l = useLocation()
  const { paths } = NamedRoutes.use()
  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <Route path={paths.bucketRoot} component={Bucket} />
        <Route component={ThrowNotFound} />
      </Switch>
    </CatchNotFound>
  )
}

function Bucket({
  match: {
    params: { bucket },
  },
}) {
  const { paths } = NamedRoutes.use()

  return (
    <BucketLayout bucket={bucket}>
      <Switch>
        <Route path={paths.bucketFile} component={File} exact strict />
        <Route path={paths.bucketDir} component={Dir} exact />
        <Route path={paths.bucketSearch} component={Search} exact />
        <Route component={ThrowNotFound} />
      </Switch>
    </BucketLayout>
  )
}

function BucketLayout({ bucket, children }) {
  const s3 = AWS.S3.use()
  const cache = useBucketCache()
  const data = useData(requests.bucketExists, { s3, bucket, cache })
  return (
    <>
      <AppBar bucket={bucket} />
      <M.Container maxWidth="lg">
        {data.case({
          Ok: () => children,
          Err: displayError(),
          _: () => <Placeholder color="text.secondary" />,
        })}
      </M.Container>
      <M.Box flexGrow={1} />
    </>
  )
}

function useInit() {
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  const [state, setState] = React.useState(null)

  const handleMessage = React.useCallback(
    ({ data }) => {
      if (!data || data.type !== 'init') return
      const { bucket, path } = data
      console.log('init', data)
      // TODO: receive tokens
      history.replace(urls.bucketDir(bucket, path))
      setState(true)
    },
    [setState, history, urls],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  return state
}

export default function Embed({ messages }) {
  const history = useConstant(() => createHistory())

  return RT.nest(
    FinalBoundary,
    // TODO: customize theme
    [M.MuiThemeProvider, { theme: style.appTheme }],
    WithGlobalStyles,
    Layout.Root,
    ErrorBoundary,
    Sentry.Provider,
    [Store.Provider, { history }],
    [LanguageProvider, { messages }],
    [NamedRoutes.Provider, { routes }],
    [RouterProvider, { history }],
    Cache.Provider,
    // TODO: separate config if needed or maybe just init from postMessage
    [Config.Provider, { path: '/config.json' }],
    [React.Suspense, { fallback: <Placeholder color="text.secondary" /> }],
    Notifications.Provider,
    // [APIConnector.Provider, { fetch, middleware: [Auth.apiMiddleware] }],
    [APIConnector.Provider, { fetch }],
    // [Auth.Provider, { checkOn: LOCATION_CHANGE, storage }],
    AWS.Credentials.Provider,
    AWS.Config.Provider,
    AWS.S3.Provider,
    AWS.Signer.Provider,
    Notifications.WithNotifications,
    BucketCacheProvider,
    function HeadlessFileBrowser() {
      const init = useInit()
      return init ? <Root /> : <Placeholder color="text.secondary" />
    },
  )
}
