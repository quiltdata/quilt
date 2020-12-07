/* embed/debug-harness.js - debug tool for embedded browser */
// Needed for redux-saga es6 generator support
import '@babel/polyfill'

import * as React from 'react'
import ReactDOM from 'react-dom'
import * as M from '@material-ui/core'

import 'sanitize.css' // side-effect: inject global css

import * as Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import LanguageProvider from 'containers/LanguageProvider'
import * as style from 'constants/style'
import * as Config from 'utils/Config'
import { createBoundary } from 'utils/ErrorBoundary'
import * as Okta from 'utils/Okta'
import * as Cache from 'utils/ResourceCache'
import * as Sentry from 'utils/Sentry'
import * as Store from 'utils/Store'
import * as RT from 'utils/reactTools'

import WithGlobalStyles from '../global-styles'

import { translationMessages } from '../i18n'

const SRC = '/__embed'

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

  const fields = {
    credentials: useField('{}'),
    bucket: useField(''),
    path: useField(''),
    scope: useField(''),
    rest: useField('{}'),
  }

  const initParams = React.useMemo(() => {
    try {
      return {
        bucket: fields.bucket.value,
        path: fields.path.value,
        scope: fields.scope.value,
        credentials: JSON.parse(fields.credentials.value),
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
  ])

  const getOktaCredentials = React.useCallback(async () => {
    const token = await authenticate()
    fields.credentials.set(JSON.stringify({ provider: 'okta', token }))
  }, [authenticate, fields.credentials.set])

  const postMessage = React.useCallback(
    (msg) => {
      if (!iframeRef.current) return
      const w = iframeRef.current.contentWindow
      // eslint-disable-next-line no-console
      console.log('Sending message to the iframe', msg)
      // TODO: use origin?
      w.postMessage(msg)
    },
    [iframeRef],
  )

  const postInit = React.useCallback(() => {
    if (initParams instanceof Error) return
    postMessage({ type: 'init', ...initParams })
  }, [postMessage, initParams])

  const reloadIframe = React.useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = SRC
    }
  }, [iframeRef])

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

        <M.Box
          component="pre"
          mt={2}
          mb={0}
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {initParams instanceof Error
            ? `${initParams}`
            : JSON.stringify(initParams, null, 2)}
        </M.Box>
      </M.Box>

      <iframe
        title="embed"
        src={SRC}
        width="900"
        height="600"
        ref={iframeRef}
        style={{ border: '1px solid', flexShrink: 0 }}
      />
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

function App({ messages }) {
  return RT.nest(
    ErrorBoundary,
    [M.MuiThemeProvider, { theme: style.appTheme }],
    WithGlobalStyles,
    Layout.Root,
    Sentry.Provider,
    Store.Provider,
    [LanguageProvider, { messages }],
    Cache.Provider,
    [Config.Provider, { path: '/config.json' }],
    [React.Suspense, { fallback: <Placeholder color="text.secondary" /> }],
    Embedder,
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

Promise.all(polyfills).then(() => {
  ReactDOM.render(<App messages={translationMessages} />, document.getElementById('app'))
})
