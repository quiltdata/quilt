import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'
import { useLocation, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as OIDC from 'utils/OIDC'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import useMutex from 'utils/useMutex'
import * as validators from 'utils/validators'

import * as Layout from './Layout'
import SSOAzure from './SSOAzure'
import SSOGoogle from './SSOGoogle'
import SSOOkta from './SSOOkta'
import SSOOneLogin from './SSOOneLogin'
import * as actions from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const Container = Layout.mkLayout('Sign in')

const MUTEX_ID = 'password'

function PasswordSignIn({ mutex }) {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const onSubmit = React.useCallback(
    async (values) => {
      if (mutex.current) return
      mutex.claim(MUTEX_ID)
      const result = defer()
      dispatch(actions.signIn(values, result.resolver))
      try {
        await result.promise
      } catch (e) {
        if (e instanceof errors.InvalidCredentials) {
          // eslint-disable-next-line consistent-return
          return {
            [FF.FORM_ERROR]: 'invalidCredentials',
          }
        }
        sentry('captureException', e)
        // eslint-disable-next-line consistent-return
        return {
          [FF.FORM_ERROR]: 'unexpected',
        }
      } finally {
        mutex.release(MUTEX_ID)
      }
    },
    [dispatch, mutex, sentry],
  )
  return (
    <RF.Form onSubmit={onSubmit}>
      {({
        error,
        handleSubmit,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
        submitError,
        submitFailed,
        submitting,
      }) => (
        <form onSubmit={handleSubmit}>
          <RF.Field
            component={Layout.Field}
            name="username"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Username or email"
            errors={{
              required: 'Enter your username or email',
            }}
          />
          <RF.Field
            component={Layout.Field}
            name="password"
            type="password"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Password"
            errors={{
              required: 'Enter your password',
            }}
          />
          <Layout.Error
            {...{
              submitFailed,
              error: error || (!modifiedSinceLastSubmit && submitError),
            }}
            errors={{
              invalidCredentials: 'Invalid credentials',
              unexpected: 'Something went wrong. Try again later.',
            }}
          />
          <Layout.Actions>
            <Layout.Submit
              label="Sign in"
              disabled={
                !!mutex.current ||
                submitting ||
                (hasValidationErrors && submitFailed) ||
                (hasSubmitErrors && !modifiedSinceLastSubmit)
              }
              busy={submitting}
            />
          </Layout.Actions>
        </form>
      )}
    </RF.Form>
  )
}

const EXPECTED_SSO_ERRORS = [
  errors.SSOUserNotFound,
  errors.NoDefaultRole,
  errors.SubscriptionInvalid,
]

const ssoErrorMessage = (e) => {
  if (e instanceof errors.SSOUserNotFound) {
    return 'No Quilt user is linked to this account. Notify your Quilt administrator.'
  }
  if (e instanceof errors.NoDefaultRole) {
    return 'Unable to assign role. Ask your Quilt administrator to set a default role.'
  }
  if (e instanceof errors.SubscriptionInvalid) {
    return 'Unable to sign up because of invalid subscription. Contact your Quilt administrator.'
  }
  if (e instanceof OIDC.OIDCError) return `Unable to sign in. ${e.details}`
  return 'Unable to sign in. Try again later or contact support.'
}

// Completes an SSO sign-in that an installed app started by redirect, from the
// callback that oauth-callback.html stored instead of answering a popup.
function useRedirectSignIn() {
  const dispatch = redux.useDispatch()
  const { push: notify } = Notifications.use()
  const sentry = Sentry.use()
  const [result] = React.useState(OIDC.takeRedirectResult)
  const [busy, setBusy] = React.useState(!!result && !result.error)
  React.useEffect(() => {
    if (!result) return
    const fail = (e) => {
      notify(ssoErrorMessage(e))
      const expected =
        EXPECTED_SSO_ERRORS.some((E) => e instanceof E) || e.code === 'no_pending_sign_in'
      if (!expected) sentry('captureException', e)
      setBusy(false)
    }
    if (result.error) {
      fail(result.error)
      return
    }
    const d = defer()
    dispatch(actions.signIn({ provider: result.provider, code: result.code }, d.resolver))
    d.promise.catch(fail)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { busy, next: result?.next }
}

export default () => {
  const { search } = useLocation()
  const authenticated = redux.useSelector(selectors.authenticated)
  const mutex = useMutex()
  const { urls } = NamedRoutes.use()
  const redirected = useRedirectSignIn()

  const ssoEnabled = (provider) => {
    if (!cfg.ssoAuth) return false
    return provider ? cfg.ssoProviders.includes(provider) : !!cfg.ssoProviders.length
  }

  // The callback lands on /qurator, so the URL's `next` is always /qurator.
  const next = redirected.next || parseSearch(search).next

  if (authenticated) {
    return <Redirect to={next || '/'} />
  }

  if (redirected.busy) {
    return (
      <Container>
        <M.Box display="flex" justifyContent="center" mt={4}>
          <M.CircularProgress />
        </M.Box>
      </Container>
    )
  }

  return (
    <Container>
      {ssoEnabled() && (
        <M.Box display="flex" flexDirection="column" mt={2} alignItems="center">
          <M.Box display="flex" flexDirection="column">
            {ssoEnabled('google') && (
              <>
                <M.Box mt={2} />
                <SSOGoogle
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
            {ssoEnabled('okta') && (
              <>
                <M.Box mt={2} />
                <SSOOkta
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
            {ssoEnabled('onelogin') && (
              <>
                <M.Box mt={2} />
                <SSOOneLogin
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
            {ssoEnabled('azure') && (
              <>
                <M.Box mt={2} />
                <SSOAzure
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
          </M.Box>
        </M.Box>
      )}
      {!!cfg.passwordAuth && ssoEnabled() && <Layout.Or />}
      {!!cfg.passwordAuth && <PasswordSignIn mutex={mutex} />}
      {(cfg.passwordAuth === true || cfg.ssoAuth === true) && (
        <Layout.Hint>
          <>
            Don&apos;t have an account? <Link to={urls.signUp(next)}>Sign up</Link>.
          </>
        </Layout.Hint>
      )}
      {!!cfg.passwordAuth && (
        <Layout.Hint>
          <>
            Did you forget your password? <Link to={urls.passReset()}>Reset it</Link>.
          </>
        </Layout.Hint>
      )}
    </Container>
  )
}
