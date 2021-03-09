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
import * as Azure from 'utils/Azure'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'
import msg from './messages'

import microsoftLogo from './microsoft-logo.svg'

const MUTEX_POPUP = 'sso:azure:popup'
const MUTEX_REQUEST = 'sso:azure:request'

export default function SSOAzure({ mutex, next, ...props }) {
  const cfg = Config.useConfig()
  invariant(!!cfg.azureClientId, 'Auth.SSO.Azure: config missing "azureClientId"')
  invariant(!!cfg.azureBaseUrl, 'Auth.SSO.Azure: config missing "azureBaseUrl"')
  const authenticate = Azure.use({
    clientId: cfg.azureClientId,
    baseUrl: cfg.azureBaseUrl,
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
      const provider = 'azure'
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
          notify(intl.formatMessage(msg.ssoAzureNotFound))
        } else {
          notify(intl.formatMessage(msg.ssoAzureErrorUnexpected))
          sentry('captureException', e)
        }
        mutex.release(MUTEX_REQUEST)
      }
    } catch (e) {
      if (e instanceof Azure.AzureError) {
        if (e.code !== 'popup_closed_by_user') {
          notify(intl.formatMessage(msg.ssoAzureError, { details: e.details }))
          sentry('captureException', e)
        }
      } else {
        notify(intl.formatMessage(msg.ssoAzureErrorUnexpected))
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
        <M.Box component="img" src={microsoftLogo} alt="" height={18} />
      )}
      <M.Box mr={1} />
      <span style={{ whiteSpace: 'nowrap' }}>
        <FM {...msg.ssoAzureUse} />
      </span>
    </M.Button>
  )
}
