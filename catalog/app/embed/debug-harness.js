/* embed/debug-harness.js - debug tool for embedded browser */
import * as R from 'ramda'
import * as React from 'react'
import ReactDOM from 'react-dom'
import * as M from '@material-ui/core'

import 'sanitize.css' // side-effect: inject global css

import JsonDisplay from 'components/JsonDisplay'
import * as Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as style from 'constants/style'
import * as Config from 'utils/Config'
import { createBoundary } from 'utils/ErrorBoundary'
import * as Okta from 'utils/Okta'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import mkSearch from 'utils/mkSearch'
import * as RT from 'utils/reactTools'

import WithGlobalStyles from '../global-styles'

const SRC = '/__embed'
const EMBED_ORIGIN = window.location.origin
const PARENT_ORIGIN = window.location.origin
const EVENT_SOURCE = 'quilt-embed'

const mkNonce = () => `${Math.random()}`

function useField(init) {
  const [value, set] = React.useState(init)
  const onChange = React.useCallback(
    (e) => {
      set(e.target.value)
    },
    [set],
  )
  return { value, set, input: { value, onChange } }
}

function Embedder() {
  const cfg = Config.useConfig()
  const authenticate = Okta.use({ clientId: cfg.oktaClientId, baseUrl: cfg.oktaBaseUrl })

  const iframeRef = React.useRef(null)

  const [nonce, setNonce] = React.useState(mkNonce)

  const src = `${SRC}${mkSearch({ nonce, origin: PARENT_ORIGIN })}`

  const fields = {
    credentials: useField('{}'),
    bucket: useField(''),
    path: useField(''),
    scope: useField(''),
    rest: useField('{}'),
    route: useField(''),
    newRoute: useField(''),
  }

  const [messages, setMessages] = React.useState([])

  const logMessage = React.useCallback(
    (direction, { type, ...contents }) => {
      setMessages(R.prepend({ direction, type, contents, time: new Date() }))
    },
    [setMessages],
  )

  const initParams = React.useMemo(() => {
    try {
      return {
        bucket: fields.bucket.value,
        path: fields.path.value,
        scope: fields.scope.value,
        credentials: JSON.parse(fields.credentials.value),
        route: fields.route.value,
        ...JSON.parse(fields.rest.value || '{}'),
      }
    } catch (e) {
      return e
    }
  }, [
    fields.credentials.value,
    fields.bucket.value,
    fields.path.value,
    fields.scope.value,
    fields.rest.value,
    fields.route.value,
  ])

  const getOktaCredentials = React.useCallback(async () => {
    const token = await authenticate()
    fields.credentials.set(JSON.stringify({ provider: 'okta', token }))
  }, [authenticate, fields.credentials.set]) // eslint-disable-line react-hooks/exhaustive-deps

  const postMessage = React.useCallback(
    (msg) => {
      if (!iframeRef.current) return
      const w = iframeRef.current.contentWindow
      w.postMessage(msg, EMBED_ORIGIN)
      logMessage('out', msg)
    },
    [iframeRef, logMessage],
  )

  const postInit = React.useCallback(() => {
    if (initParams instanceof Error) return
    postMessage({ type: 'init', ...initParams })
  }, [postMessage, initParams])

  const navigate = React.useCallback(() => {
    postMessage({ type: 'navigate', route: fields.newRoute.value })
  }, [postMessage, fields.newRoute.value])

  const reloadIframe = React.useCallback(() => {
    setNonce(mkNonce)
    setMessages([])
  }, [setNonce, setMessages])

  const handleMessage = React.useCallback(
    (e) => {
      if (
        e.source !== iframeRef.current.contentWindow ||
        e.origin !== EMBED_ORIGIN ||
        e.data.source !== EVENT_SOURCE ||
        nonce !== e.data.nonce
      )
        return
      logMessage('in', R.omit(['source', 'nonce'], e.data))
    },
    [iframeRef, logMessage, nonce],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  return (
    <M.Box display="flex" justifyContent="space-between" p={2} maxHeight="100vh">
      <M.Box
        display="flex"
        flexDirection="column"
        flexGrow={1}
        pr={2}
        maxWidth={400}
        overflow="auto"
      >
        <M.Button variant="outlined" onClick={getOktaCredentials}>
          Get credentials from Okta
        </M.Button>

        <M.Box mt={2} />
        <M.TextField
          multiline
          label="Credentials (JSON)"
          rowsMax={10}
          fullWidth
          {...fields.credentials.input}
        />

        <M.Box mt={2} />
        <M.TextField label="Bucket" fullWidth {...fields.bucket.input} />

        <M.Box mt={2} />
        <M.TextField label="Path" fullWidth {...fields.path.input} />

        <M.Box mt={2} />
        <M.TextField label="Route" fullWidth {...fields.route.input} />

        <M.Box mt={2} />
        <M.TextField label="Scope" fullWidth {...fields.scope.input} />

        <M.Box mt={2} />
        <M.TextField
          multiline
          label="Extra params (JSON, merged with the rest)"
          rowsMax={10}
          fullWidth
          {...fields.rest.input}
        />

        <M.Box mt={2} />
        <M.Button variant="outlined" onClick={postInit}>
          init
        </M.Button>

        <M.Box mt={1} />
        <M.Button variant="outlined" onClick={reloadIframe}>
          reload iframe
        </M.Button>

        <M.Box mt={2}>
          {initParams instanceof Error ? (
            `${initParams}`
          ) : (
            <JsonDisplay name="init params" value={initParams} defaultExpanded />
          )}
        </M.Box>

        <M.Box mt={4} />
        <M.Button variant="outlined" onClick={navigate}>
          navigate to
        </M.Button>

        <M.Box mt={2} />
        <M.TextField label="New route" fullWidth {...fields.newRoute.input} />
      </M.Box>

      <M.Box flexShrink={0}>
        <iframe
          title="embed"
          src={src}
          width="900"
          height="600"
          ref={iframeRef}
          style={{ border: '1px solid' }}
        />

        <M.Box mt={3}>
          <M.Typography variant="h6" gutterBottom>
            Messages
          </M.Typography>
          {messages.map((m) => (
            <M.Box key={m.time.toISOString()}>
              <JsonDisplay
                name={`[${m.time.toISOString()}] ${
                  m.direction === 'in' ? '<==' : '==>'
                } ${m.type}`}
                value={m.contents}
                color={
                  // eslint-disable-next-line no-nested-ternary
                  m.direction === 'in'
                    ? m.type === 'error'
                      ? 'error.main'
                      : 'success.main'
                    : undefined
                }
              />
            </M.Box>
          ))}
        </M.Box>
      </M.Box>
    </M.Box>
  )
}

const ErrorBoundary = createBoundary(() => (/* error, info */) => (
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

function App() {
  return RT.nest(
    ErrorBoundary,
    [M.MuiThemeProvider, { theme: style.appTheme }],
    WithGlobalStyles,
    Layout.Root,
    Sentry.Provider,
    Store.Provider,
    Cache.Provider,
    [Config.Provider, { path: '/config.json' }],
    [React.Suspense, { fallback: <Placeholder color="text.secondary" /> }],
    Embedder,
  )
}

ReactDOM.render(<App />, document.getElementById('app'))
