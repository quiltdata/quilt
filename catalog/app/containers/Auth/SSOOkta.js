import { push } from 'connected-react-router/esm/immutable'
import invariant from 'invariant'
import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import { useIntl } from 'containers/LanguageProvider'
import * as Notifications from 'containers/Notifications'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Okta from 'utils/Okta'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'
import msg from './messages'

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
  const { formatMessage } = useIntl()
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
          notify(formatMessage(msg.ssoOktaNotFound))
        } else {
          notify(formatMessage(msg.ssoOktaErrorUnexpected))
          sentry('captureException', e)
        }
        mutex.release(MUTEX_REQUEST)
      }
    } catch (e) {
      if (e instanceof Okta.OktaError) {
        if (e.code !== 'popup_closed_by_user') {
          notify(formatMessage(msg.ssoOktaError, { details: e.details }))
          sentry('captureException', e)
        }
      } else {
        notify(formatMessage(msg.ssoOktaErrorUnexpected))
        sentry('captureException', e)
      }
      mutex.release(MUTEX_POPUP)
    }
  }, [
    authenticate,
    dispatch,
    mutex,
    sentry,
    notify,
    cfg.ssoAuth,
    formatMessage,
    next,
    urls,
  ])

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
      <FM {...msg.ssoOktaUse} />
    </M.Button>
  )
}
