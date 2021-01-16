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
  const { formatMessage } = useIntl()
  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()
  const { claim, release } = mutex

  const handleClick = (onClick) => (...args) => {
    if (mutex.current) return
    claim(MUTEX_POPUP)
    onClick(...args)
  }

  const handleSuccess = React.useCallback(
    async (user) => {
      const provider = 'google'
      const { id_token: token } = user.getAuthResponse()
      const result = defer()
      claim(MUTEX_REQUEST)
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
          notify(formatMessage(msg.ssoGoogleNotFound))
        } else {
          notify(formatMessage(msg.ssoGoogleErrorUnexpected))
          sentry('captureException', e)
        }
        release(MUTEX_REQUEST)
      }
    },
    [dispatch, claim, release, sentry, notify, formatMessage, cfg.ssoAuth, next, urls],
  )

  const handleFailure = React.useCallback(
    ({ error: code, details }) => {
      if (code !== 'popup_closed_by_user') {
        notify(formatMessage(msg.ssoGoogleError, { details }))
        const e = new errors.SSOError({ provider: 'google', code, details })
        sentry('captureException', e)
      }
      release(MUTEX_POPUP)
    },
    [release, sentry, formatMessage, notify],
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
