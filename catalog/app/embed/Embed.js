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
import LanguageProvider from 'containers/LanguageProvider'
import { ThrowNotFound, createNotFound } from 'containers/NotFoundPage'
import * as Notifications from 'containers/Notifications'
import * as routes from 'constants/embed-routes'
import * as style from 'constants/style'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as BucketCache from 'utils/BucketCache'
import * as Config from 'utils/Config'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import defer from 'utils/defer'
import { ErrorDisplay } from 'utils/error'
import * as RT from 'utils/reactTools'
import RouterProvider from 'utils/router'
import useConstant from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'
import usePrevious from 'utils/usePrevious'

// TODO: consider reimplementing these locally or moving to some shared location
import { displayError } from 'containers/Bucket/errors'

import WithGlobalStyles from '../global-styles'

import AppBar from './AppBar'
import * as EmbedConfig from './EmbedConfig'

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

function useInit() {
  const [state, setState] = React.useState(null)

  const handleMessage = React.useCallback(
    ({ data }) => {
      if (!data || data.type !== 'init') return
      const { type, ...init } = data
      try {
        if (!init.bucket) throw new Error('missing .bucket')
        setState(init)
      } catch (e) {
        console.error(`Configuration error: ${e.message}`)
        console.log('init object:', init)
        setState(e)
      }
    },
    [setState],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  return state
}

function Init({ messages }) {
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
      <App {...{ key, init, messages }} />
    </ErrorBoundary>
  )
}

function usePostInit(init) {
  const dispatch = redux.useDispatch()
  const [state, setState] = React.useState(null)

  React.useEffect(() => {
    const result = defer()
    dispatch(Auth.actions.signIn(init.credentials, result.resolver))
    result.promise
      .then(() => {
        setState(true)
      })
      .catch((e) => {
        console.warn('Authentication failure:')
        console.error(e)
        setState(new ErrorDisplay('Authentication Failure'))
      })
  }, [init])

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

function App({ messages, init }) {
  const { urls } = NamedRoutes.use()
  const history = useConstant(() =>
    createHistory({ initialEntries: [urls.bucketDir(init.bucket, init.path)] }),
  )

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
    [LanguageProvider, { messages }],
    [RouterProvider, { history }],
    Cache.Provider,
    [Config.Provider, { path: '/config.json' }],
    [React.Suspense, { fallback: <Placeholder color="text.secondary" /> }],
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

export default function Embed({ messages }) {
  return RT.nest(
    FinalBoundary,
    [M.MuiThemeProvider, { theme: style.appTheme }],
    WithGlobalStyles,
    Layout.Root,
    ErrorBoundary,
    Sentry.Provider,
    [NamedRoutes.Provider, { routes }],
    [Init, { messages }],
  )
}
