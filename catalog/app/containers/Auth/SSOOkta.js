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
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'
import msg from './messages'

import oktaLogo from './okta-logo.svg'

const MUTEX_POPUP = 'sso:okta:popup'
const MUTEX_REQUEST = 'sso:okta:request'

export default function SSOOkta({ mutex, next }) {
  const cfg = Config.useConfig()
  invariant(!!cfg.oktaClientId, 'Auth.SSO.Okta: config missing "oktaClientId"')
  invariant(!!cfg.oktaCompanyName, 'Auth.SSO.Okta: config missing "oktaCompanyName"')

  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const intl = useIntl()
  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()

  const handleClick = React.useCallback(() => {
    if (mutex.current) return
    mutex.claim(MUTEX_POPUP)

    const oktaDomain = `https://${cfg.oktaCompanyName}.okta.com`
    const nonce = '1' // TODO
    const state = '2' // TODO
    const query = NamedRoutes.mkSearch({
      client_id: cfg.oktaClientId,
      redirect_uri: window.location.origin,
      response_mode: 'okta_post_message',
      response_type: 'id_token',
      scope: 'openid email',
      nonce,
      state,
    })
    const url = `${oktaDomain}/oauth2/v1/authorize${query}`
    const popup = window.open(url, 'quilt_okta_popup', 'width=300,height=400')
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer)
        handleFailure({ error: 'popup_closed_by_user' })
      }
    }, 500)
    popup.focus()
    window.addEventListener('message', ({ origin, data }) => {
      if (origin !== oktaDomain) return
      const { id_token: idToken, error, error_description: errorDetails } = data
      if (error) {
        handleFailure(error, errorDetails)
      } else {
        handleSuccess(idToken)
      }
      clearInterval(timer)
      popup.close()
    })
  }, [
    mutex.current,
    mutex.claim,
    cfg.oktaCompanyName,
    cfg.oktaClientId,
    window.location.origin,
    handleSuccess,
    handleFailure,
  ])

  const handleSuccess = React.useCallback(
    async (token) => {
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
          notify(intl.formatMessage(msg.ssoOktaNotFound))
        } else {
          notify(intl.formatMessage(msg.ssoOktaErrorUnexpected))
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
        notify(intl.formatMessage(msg.ssoOktaError, { details }))
        const e = new errors.SSOError({ provider: 'okta', code, details })
        sentry('captureException', e)
      }
      mutex.release(MUTEX_POPUP)
    },
    [mutex.release, notify, sentry],
  )

  return (
    <M.Button variant="outlined" onClick={handleClick} disabled={!!mutex.current}>
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
