// side-effect: inject global css
import 'sanitize.css'

import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Route, Switch, useLocation } from 'react-router-dom'
import { createMemoryHistory as createHistory } from 'history'
import * as M from '@material-ui/core'

import * as Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as Auth from 'containers/Auth'
import { ThrowNotFound, createNotFound } from 'containers/NotFoundPage'
import * as Notifications from 'containers/Notifications'
import * as routes from 'constants/embed-routes'
import * as style from 'constants/style'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as BucketCache from 'utils/BucketCache'
import * as Config from 'utils/Config'
import { createBoundary } from 'utils/ErrorBoundary'
import { GraphQLProvider } from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import defer from 'utils/defer'
import { ErrorDisplay } from 'utils/error'
import parseSearch from 'utils/parseSearch'
import * as RT from 'utils/reactTools'
import RouterProvider from 'utils/router'
import * as s3paths from 'utils/s3paths'
import useConstant from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'
import usePrevious from 'utils/usePrevious'

// TODO: consider reimplementing these locally or moving to some shared location
import { displayError } from 'containers/Bucket/errors'

import WithGlobalStyles from '../global-styles'

import AppBar from './AppBar'
import * as EmbedConfig from './EmbedConfig'

const EVENT_SOURCE = 'quilt-embed'
const search = parseSearch(window.location.search)
const NONCE = search.nonce || `${Math.random}`
const PARENT_ORIGIN = search.origin || '*'

const mkLazy = (load) =>
  RT.loadable(load, { fallback: () => <Placeholder color="text.secondary" /> })

const Dir = mkLazy(() => import('./Dir'))
const File = mkLazy(() => import('./File'))
const Search = mkLazy(() => import('./Search'))

const FinalBoundary = createBoundary(() => (error) => (
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
    {error.headline || 'Something went wrong'}
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

const ErrorBoundary = createBoundary(() => (error) => (
  <StyledError>{error.headline || 'Something went wrong'}</StyledError>
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
  const data = BucketCache.useBucketExistence(bucket)
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

function useMessageParent() {
  return React.useCallback((data) => {
    window.parent.postMessage(
      { source: EVENT_SOURCE, nonce: NONCE, ...data },
      PARENT_ORIGIN,
    )
  }, [])
}

function useMessageHandler(fn) {
  const handleMessage = React.useCallback(
    (e) => {
      if (
        e.source !== window.parent ||
        (PARENT_ORIGIN !== '*' && e.origin !== PARENT_ORIGIN) ||
        !e.data?.type
      )
        return
      fn(e.data)
    },
    [fn],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])
}

function useInit() {
  const messageParent = useMessageParent()
  const [state, setState] = React.useState(null)

  useMessageHandler(
    React.useCallback(
      ({ type, ...init }) => {
        if (type !== 'init') return
        try {
          if (!init.bucket && !init.route)
            throw new Error('missing either .bucket or .route')
          if (init.scope) {
            if (typeof init.scope !== 'string') throw new Error('.scope must be a string')
            // eslint-disable-next-line no-param-reassign
            init.scope = s3paths.ensureSlash(init.scope)
          }
          setState(init)
        } catch (e) {
          const message = `Configuration error: ${e.message}`
          // eslint-disable-next-line no-console
          console.error(message)
          // eslint-disable-next-line no-console
          console.log('init object:', init)
          messageParent({ type: 'error', message, init })
          setState(e)
        }
      },
      [setState, messageParent],
    ),
  )

  React.useEffect(() => {
    messageParent({ type: 'ready' })
  }, [messageParent])

  return state
}

function Init() {
  const [key, setKey] = React.useState(0)
  const init = useInit()
  usePrevious(init, (prev) => {
    if (init !== prev) {
      setKey((k) => k + 1)
    }
  })
  if (!init) return <Placeholder color="text.secondary" />
  if (init instanceof Error) {
    return <StyledError>Configuration error</StyledError>
  }
  return (
    <ErrorBoundary key={key}>
      <App {...{ key, init }} />
    </ErrorBoundary>
  )
}

function usePostInit(init) {
  const dispatch = redux.useDispatch()
  const messageParent = useMessageParent()
  const [state, setState] = React.useState(null)

  React.useEffect(() => {
    const result = defer()
    dispatch(Auth.actions.signIn(init.credentials, result.resolver))
    result.promise
      .then(() => {
        setState(true)
        messageParent({ type: 'init', init })
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('Authentication failure:')
        // eslint-disable-next-line no-console
        console.error(e)
        setState(new ErrorDisplay('Authentication Failure'))
        messageParent({
          type: 'error',
          message: `Authentication failure: ${e.message}`,
          credentials: init.credentials,
        })
      })
  }, [init, dispatch, messageParent])

  return state
}

function PostInit({ init, children }) {
  const state = usePostInit(init)
  if (!state) return <Placeholder color="text.secondary" />
  if (state instanceof Error) throw state
  return children
}

function WithCustomTheme({ theme, children }) {
  const customTheme = useMemoEq(theme, style.createCustomAppTheme)
  return (
    <M.MuiThemeProvider theme={customTheme}>
      <WithGlobalStyles>{children}</WithGlobalStyles>
    </M.MuiThemeProvider>
  )
}

function CustomThemeProvider({ theme, children }) {
  if (!theme || R.isEmpty(theme)) return children
  return <WithCustomTheme theme={theme}>{children}</WithCustomTheme>
}

const appendLink = (el) => {
  const x = window.document.getElementsByTagName('link')[0]
  x.parentNode.insertBefore(el, x)
}

const removeLink = (el) => {
  el.parentNode.removeChild(el)
}

function useCssFiles(files = []) {
  React.useEffect(() => {
    const els = files.map((href) => {
      const el = window.document.createElement('link')
      el.rel = 'stylesheet'
      el.href = href
      appendLink(el)
      return el
    })

    return () => {
      els.forEach(removeLink)
    }
  }, [files])
}

function useSyncHistory(history) {
  const messageParent = useMessageParent()

  useMessageHandler(
    React.useCallback(
      ({ type, ...data }) => {
        if (type !== 'navigate') return
        try {
          if (!data.route) throw new Error('missing .route')
          if (typeof data.route !== 'string') throw new Error('.route must be a string')
          history.push(data.route)
        } catch (e) {
          const message = `Navigate: error: ${e.message}`
          // eslint-disable-next-line no-console
          console.error(message)
          // eslint-disable-next-line no-console
          console.log('params:', data)
          messageParent({ type: 'error', message, data })
        }
      },
      [history, messageParent],
    ),
  )

  React.useEffect(
    () =>
      history.listen((location, action) => {
        messageParent({
          type: 'navigate',
          route: `${location.pathname}${location.search}${location.hash}`,
          action,
        })
      }),
    [history, messageParent],
  )
}

function App({ init }) {
  const { urls } = NamedRoutes.use()
  const history = useConstant(() =>
    createHistory({
      initialEntries: [init.route || urls.bucketDir(init.bucket, init.path)],
    }),
  )

  useSyncHistory(history)

  const storage = useConstant(() => ({
    load: () => ({}),
    set: () => {},
    remove: () => {},
  }))

  useCssFiles(init.css)

  return RT.nest(
    [EmbedConfig.Provider, { config: init }],
    [CustomThemeProvider, { theme: init.theme }],
    [Store.Provider, { history }],
    [RouterProvider, { history }],
    Cache.Provider,
    [Config.Provider, { path: '/config.json' }],
    [React.Suspense, { fallback: <Placeholder color="text.secondary" /> }],
    GraphQLProvider,
    Notifications.Provider,
    [APIConnector.Provider, { fetch, middleware: [Auth.apiMiddleware] }],
    [Auth.Provider, { storage }],
    AWS.Credentials.Provider,
    AWS.Config.Provider,
    AWS.S3.Provider,
    Notifications.WithNotifications,
    BucketCache.Provider,
    [PostInit, { init }],
    Root,
  )
}

export default function Embed() {
  return RT.nest(
    FinalBoundary,
    [M.MuiThemeProvider, { theme: style.appTheme }],
    WithGlobalStyles,
    Layout.Root,
    ErrorBoundary,
    Sentry.Provider,
    [NamedRoutes.Provider, { routes }],
    [Init],
  )
}
