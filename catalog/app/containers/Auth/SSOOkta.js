import { push } from 'connected-react-router/esm/immutable'
import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Okta from 'utils/Okta'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'

import oktaLogo from './okta-logo.svg'

const MUTEX_POPUP = 'sso:okta:popup'
const MUTEX_REQUEST = 'sso:okta:request'

export default function SSOOkta({ mutex, next, ...props }) {
  const cfg = Config.useConfig()
  invariant(!!cfg.oktaClientId, 'Auth.SSO.Okta: config missing "oktaClientId"')
  invariant(!!cfg.oktaBaseUrl, 'Auth.SSO.Okta: config missing "oktaBaseUrl"')
  const authenticate = Okta.use({ clientId: cfg.oktaClientId, baseUrl: cfg.oktaBaseUrl })

  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()

  const handleClick = React.useCallback(async () => {
    if (mutex.current) return
    mutex.claim(MUTEX_POPUP)

    try {
      const token = await authenticate()
      const provider = 'okta'
      const result = defer()
      mutex.claim(MUTEX_REQUEST)
      try {
        dispatch(actions.signIn({ provider, token }, result.resolver))
        await result.promise
      } catch (e) {
        if (e instanceof errors.SSOUserNotFound) {
          if (cfg.ssoAuth === true) {
            dispatch(push(urls.ssoSignUp({ provider, token, next })))
            // dont release mutex on redirect
            return
          }
          notify(
            'No Quilt user linked to this Okta account. Notify your Quilt administrator.',
          )
        } else if (e instanceof errors.NoDefaultRole) {
          notify(
            'Unable to assign role. Ask your Quilt administrator to set a default role.',
          )
        } else {
          notify('Unable to sign in with Okta. Try again later or contact support.')
          sentry('captureException', e)
        }
        mutex.release(MUTEX_REQUEST)
      }
    } catch (e) {
      if (e instanceof Okta.OktaError) {
        if (e.code !== 'popup_closed_by_user') {
          notify(`Unable to sign in with Okta. ${e.details}`)
          sentry('captureException', e)
        }
      } else {
        notify('Unable to sign in with Okta. Try again later or contact support.')
        sentry('captureException', e)
      }
      mutex.release(MUTEX_POPUP)
    }
  }, [authenticate, dispatch, mutex, sentry, notify, cfg.ssoAuth, next, urls])

  return (
    <M.Button
      variant="outlined"
      onClick={handleClick}
      disabled={!!mutex.current}
      {...props}
    >
      {mutex.current === MUTEX_REQUEST ? (
        <M.CircularProgress size={18} />
      ) : (
        <M.Box component="img" src={oktaLogo} alt="" height={18} />
      )}
      <M.Box mr={1} />
      Sign in with Okta
    </M.Button>
  )
}
