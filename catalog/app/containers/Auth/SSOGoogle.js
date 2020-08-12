import { push } from 'connected-react-router/esm/immutable'
import invariant from 'invariant'
import * as React from 'react'
import GoogleLogin from 'react-google-login'
import { FormattedMessage as FM } from 'react-intl'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import { useIntl } from 'containers/LanguageProvider'
import * as Notifications from 'containers/Notifications'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'
import googleLogo from './google-logo.svg'
import msg from './messages'

const MUTEX_POPUP = 'sso:google:popup'
const MUTEX_REQUEST = 'sso:google:request'

export default function SSOGoogle({ mutex, next, ...props }) {
  const cfg = Config.useConfig()
  invariant(!!cfg.googleClientId, 'Auth.SSO.Google: config missing "googleClientId"')

  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const intl = useIntl()
  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()

  const handleClick = (onClick) => (...args) => {
    if (mutex.current) return
    mutex.claim(MUTEX_POPUP)
    onClick(...args)
  }

  const handleSuccess = React.useCallback(
    async (user) => {
      const provider = 'google'
      const { id_token: token } = user.getAuthResponse()
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
          notify(intl.formatMessage(msg.ssoGoogleNotFound))
        } else {
          notify(intl.formatMessage(msg.ssoGoogleErrorUnexpected))
          sentry('captureException', e)
        }
        mutex.release(MUTEX_REQUEST)
      }
    },
    [dispatch, mutex.claim, mutex.release, sentry, notify],
  )

  const handleFailure = React.useCallback(
    ({ error: code, details }) => {
      if (code !== 'popup_closed_by_user') {
        notify(intl.formatMessage(msg.ssoGoogleError, { details }))
        const e = new errors.SSOError({ provider: 'google', code, details })
        sentry('captureException', e)
      }
      mutex.release(MUTEX_POPUP)
    },
    [mutex.release, sentry],
  )

  return (
    <GoogleLogin
      clientId={cfg.googleClientId}
      onSuccess={handleSuccess}
      onFailure={handleFailure}
      cookiePolicy="single_host_origin"
      disabled={!!mutex.current}
      render={({ onClick, disabled }) => (
        <M.Button
          variant="outlined"
          onClick={handleClick(onClick)}
          disabled={disabled}
          {...props}
        >
          {mutex.current === MUTEX_REQUEST ? (
            <M.CircularProgress size={18} />
          ) : (
            <M.Box component="img" src={googleLogo} alt="" />
          )}
          <M.Box mr={1} />
          <FM {...msg.ssoGoogleUse} />
        </M.Button>
      )}
    />
  )
}
