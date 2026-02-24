import * as React from 'react'
import { useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Spinner from 'components/Spinner'
import * as APIConnector from 'utils/APIConnector'
import parseSearch from 'utils/parseSearch'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_client: 'The application is not recognized.',
  invalid_redirect_uri: 'The application provided an invalid callback URL.',
  invalid_scope: 'The requested permissions are not valid.',
  invalid_resource: 'The requested resource is not valid.',
  invalid_request: 'The authorization request is invalid.',
  unsupported_response_type: 'The requested response type is not supported.',
  unexpected: 'Something went wrong. Please try again.',
}

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string; errorDescription?: string }
  | { status: 'ready'; clientName: string }
  | { status: 'authorizing'; clientName: string }

const useStyles = M.makeStyles((t) => ({
  container: {
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: 400,
    width: '100%',
  },
  heading: {
    marginBottom: t.spacing(3),
  },
  card: {
    padding: t.spacing(3),
  },
  clientName: {
    fontWeight: 500,
  },
  scope: {
    marginTop: t.spacing(2),
    color: t.palette.text.secondary,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: t.spacing(4),
    gap: t.spacing(2),
  },
  errorDetail: {
    marginTop: t.spacing(1),
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(4),
  },
}))

export default function Authorize() {
  const classes = useStyles()
  const { search } = useLocation()
  const req = APIConnector.use()
  const [state, setState] = React.useState<State>({ status: 'loading' })

  const params = parseSearch(search, true)
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: oauthState,
    resource,
  } = params

  const handleError = (e: unknown) => {
    if (e instanceof APIConnector.HTTPError) {
      const { error_code: error, message: errorDescription } = e.json || {}
      setState({ status: 'error', error: error || 'unexpected', errorDescription })
    } else {
      setState({ status: 'error', error: 'unexpected' })
    }
  }

  React.useEffect(() => {
    let cancelled = false

    const validate = async () => {
      try {
        const result = await req({
          endpoint: '/connect/validate',
          method: 'POST',
          body: {
            client_id: clientId,
            redirect_uri: redirectUri,
            scope,
            resource,
          },
        })
        if (!cancelled) {
          setState({ status: 'ready', clientName: result.client_name })
        }
      } catch (e) {
        if (!cancelled) handleError(e)
      }
    }

    validate()
    return () => {
      cancelled = true
    }
  }, [req, clientId, redirectUri, scope, resource])

  const handleContinue = async () => {
    if (state.status !== 'ready') return
    setState({ status: 'authorizing', clientName: state.clientName })

    try {
      const result = await req({
        endpoint: '/connect/authorize',
        method: 'POST',
        body: params,
      })
      window.location.href = result.redirect_uri
    } catch (e) {
      handleError(e)
    }
  }

  const handleCancel = () => {
    if (!redirectUri || !oauthState) return
    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('state', oauthState)
    window.location.href = url.toString()
  }

  if (state.status === 'error') {
    const errorMessage = ERROR_MESSAGES[state.error] || ERROR_MESSAGES.unexpected
    return (
      <Layout>
        <M.Box pt={5} pb={2} className={classes.container}>
          <M.Typography variant="h4" align="center" className={classes.heading}>
            Authorization Failed
          </M.Typography>
          <M.Paper className={classes.card}>
            <M.Typography align="center" color="error">
              {errorMessage}
            </M.Typography>
            {state.errorDescription && (
              <M.Typography
                variant="body2"
                align="center"
                color="textSecondary"
                className={classes.errorDetail}
              >
                {state.errorDescription}
              </M.Typography>
            )}
          </M.Paper>
        </M.Box>
      </Layout>
    )
  }

  if (state.status === 'loading') {
    return (
      <Layout>
        <M.Box pt={5} pb={2} className={classes.container}>
          <M.Typography variant="h4" align="center" className={classes.heading}>
            Authorize Application
          </M.Typography>
          <div className={classes.loading}>
            <Spinner />
          </div>
        </M.Box>
      </Layout>
    )
  }

  const isAuthorizing = state.status === 'authorizing'

  return (
    <Layout>
      <M.Box pt={5} pb={2} className={classes.container}>
        <M.Typography variant="h4" align="center" className={classes.heading}>
          Authorize Application
        </M.Typography>
        <M.Paper className={classes.card}>
          <M.Typography variant="body1">
            <span className={classes.clientName}>{state.clientName}</span> wants to access
            your Quilt account.
          </M.Typography>
          <M.Typography variant="body2" className={classes.scope}>
            This will allow the application to access data on your behalf.
          </M.Typography>
          <div className={classes.actions}>
            <M.Button onClick={handleCancel} disabled={isAuthorizing} color="default">
              Cancel
            </M.Button>
            <M.Button
              onClick={handleContinue}
              disabled={isAuthorizing}
              color="primary"
              variant="contained"
            >
              {isAuthorizing ? (
                <>
                  Authorizing...&nbsp;
                  <Spinner style={{ fontSize: '1.5em', opacity: 0.5 }} />
                </>
              ) : (
                'Continue'
              )}
            </M.Button>
          </div>
        </M.Paper>
      </M.Box>
    </Layout>
  )
}
