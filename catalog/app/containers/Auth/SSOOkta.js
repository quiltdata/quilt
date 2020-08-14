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

export default function SSOOkta({ mutex, next, ...props }) {
  const cfg = Config.useConfig()
  invariant(!!cfg.oktaClientId, 'Auth.SSO.Okta: config missing "oktaClientId"')
  invariant(!!cfg.oktaBaseUrl, 'Auth.SSO.Okta: config missing "oktaBaseUrl"')

  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const intl = useIntl()
  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()

  const handleClick = React.useCallback(() => {
    if (mutex.current) return
    mutex.claim(MUTEX_POPUP)

    const nonce = Math.random().toString(36).substr(2)
    const state = Math.random().toString(36).substr(2)
    const query = NamedRoutes.mkSearch({
      client_id: cfg.oktaClientId,
      redirect_uri: window.location.origin,
      response_mode: 'okta_post_message',
      response_type: 'id_token',
      scope: 'openid email',
      nonce,
      state,
    })
    const url = `${cfg.oktaBaseUrl}/v1/authorize${query}`
    const popup = window.open(url, 'quilt_okta_popup', 'width=300,height=400')
    const timer = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener('message', handleMessage)
        clearInterval(timer)
        handleFailure({ error: 'popup_closed_by_user' })
      }
    }, 500)
    const handleMessage = ({ source, origin, data }) => {
      if (source !== popup || !url.startsWith(`${origin}/`)) return
      const {
        id_token: idToken,
        error,
        error_description: errorDetails,
        state: respState,
      } = data
      if (respState !== state) return
      if (error) {
        handleFailure(error, errorDetails)
      } else {
        const { nonce: respNonce } = JSON.parse(atob(idToken.split('.')[1]))
        if (respNonce !== nonce) return
        handleSuccess(idToken)
      }
      window.removeEventListener('message', handleMessage)
      clearInterval(timer)
      popup.close()
    }
    window.addEventListener('message', handleMessage)
    popup.focus()
  }, [
    mutex.current,
    mutex.claim,
    cfg.oktaBaseUrl,
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
