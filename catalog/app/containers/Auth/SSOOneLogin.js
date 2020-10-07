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
import * as OneLogin from 'utils/OneLogin'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'
import msg from './messages'

import oneLoginLogo from './onelogin-logo.svg'

const MUTEX_POPUP = 'sso:oneLogin:popup'
const MUTEX_REQUEST = 'sso:oneLogin:request'

export default function SSOOneLogin({ mutex, next, ...props }) {
  const cfg = Config.useConfig()
  invariant(
    !!cfg.oneLoginClientId,
    'Auth.SSO.OneLogin: config missing "oneLoginClientId"',
  )
  invariant(!!cfg.oneLoginBaseUrl, 'Auth.SSO.OneLogin: config missing "oneLoginBaseUrl"')
  const authenticate = OneLogin.use({
    clientId: cfg.oneLoginClientId,
    baseUrl: cfg.oneLoginBaseUrl,
  })

  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const intl = useIntl()
  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()

  const handleClick = React.useCallback(async () => {
    if (mutex.current) return
    mutex.claim(MUTEX_POPUP)

    try {
      const token = await authenticate()
      const provider = 'onelogin'
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
          notify(intl.formatMessage(msg.ssoOneLoginNotFound))
        } else {
          notify(intl.formatMessage(msg.ssoOneLoginErrorUnexpected))
          sentry('captureException', e)
        }
        mutex.release(MUTEX_REQUEST)
      }
    } catch (e) {
      if (e instanceof OneLogin.OneLoginError) {
        if (e.code !== 'popup_closed_by_user') {
          notify(intl.formatMessage(msg.ssoOneLoginError, { details: e.details }))
          sentry('captureException', e)
        }
      } else {
        notify(intl.formatMessage(msg.ssoOneLoginErrorUnexpected))
        sentry('captureException', e)
      }
      mutex.release(MUTEX_POPUP)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authenticate,
    cfg.ssoAuth,
    dispatch,
    intl.formatMessage,
    mutex.claim,
    mutex.release,
    next,
    notify,
    sentry,
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
        <M.Box component="img" src={oneLoginLogo} alt="" height={18} />
      )}
      <M.Box mr={1} />
      <span style={{ whiteSpace: 'nowrap' }}>
        <FM {...msg.ssoOneLoginUse} />
      </span>
    </M.Button>
  )
}
