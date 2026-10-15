import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as OIDC from 'utils/OIDC'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import * as actions from './actions'
import * as errors from './errors'

export default function SSOButton({
  provider,
  name,
  logo,
  popupParams,
  mutex,
  next,
  signup,
  onSignupTicketInvalid,
  ...props
}) {
  const MUTEX_POPUP = `sso:${provider}:popup`
  const MUTEX_REQUEST = `sso:${provider}:request`

  const authenticate = OIDC.use({ provider, popupParams })

  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const { push: notify } = Notifications.use()

  const handleClick = React.useCallback(async () => {
    if (mutex.current) return
    mutex.claim(MUTEX_POPUP)

    try {
      const code = await authenticate()
      const result = defer()
      mutex.claim(MUTEX_REQUEST)
      try {
        dispatch(
          actions.signIn(
            {
              provider,
              code,
              ...(signup && { signup_page: signup.page, signup_ticket: signup.ticket }),
            },
            result.resolver,
          ),
        )
        await result.promise
      } catch (e) {
        if (e instanceof errors.SignupTicketInvalid && onSignupTicketInvalid) {
          onSignupTicketInvalid()
        } else if (e instanceof errors.SSOUserNotFound) {
          notify(
            `No Quilt user linked to this ${name} account. Notify your Quilt administrator.`,
          )
        } else if (e instanceof errors.NoDefaultRole) {
          notify(
            'Unable to assign role. Ask your Quilt administrator to set a default role.',
          )
        } else if (e instanceof errors.SubscriptionInvalid) {
          notify(
            'Unable to sign up because of invalid subscription. Contact your Quilt administrator.',
          )
        } else {
          notify(`Unable to sign in with ${name}. Try again later or contact support.`)
          sentry('captureException', e)
        }
        mutex.release(MUTEX_REQUEST)
      }
    } catch (e) {
      if (e instanceof OIDC.OIDCError) {
        if (e.code !== 'popup_closed_by_user') {
          notify(`Unable to sign in with ${name}. ${e.details}`)
          sentry('captureException', e)
        }
      } else {
        notify(`Unable to sign in with ${name}. Try again later or contact support.`)
        sentry('captureException', e)
      }
      mutex.release(MUTEX_POPUP)
    }
  }, [
    MUTEX_POPUP,
    MUTEX_REQUEST,
    authenticate,
    dispatch,
    mutex,
    name,
    notify,
    onSignupTicketInvalid,
    provider,
    sentry,
    signup,
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
        <M.Box component="img" src={logo} alt="" height={18} />
      )}
      <M.Box mr={1} />
      <span style={{ whiteSpace: 'nowrap' }}>
        {signup ? 'Continue' : 'Sign in'} with {name}
      </span>
    </M.Button>
  )
}
