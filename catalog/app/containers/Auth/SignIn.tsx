import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'
import { useLocation, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import useMutex, { Mutex } from 'utils/useMutex'
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

interface PasswordSignInProps {
  mutex: Mutex
}

function PasswordSignIn({ mutex }: PasswordSignInProps) {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const onSubmit = React.useCallback(
    async (values: { username: string; password: string }) => {
      if (mutex.current) return undefined
      mutex.claim(MUTEX_ID)
      const result = defer()
      dispatch(actions.signIn(values, result.resolver))
      try {
        await result.promise
        return undefined
      } catch (e) {
        if (e instanceof errors.InvalidCredentials) {
          return {
            [FF.FORM_ERROR]: 'invalidCredentials',
          }
        }
        sentry('captureException', e)
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
            component={Layout.Field as React.ComponentType<any>}
            name="username"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Username or email"
            errors={{
              required: 'Enter your username or email',
            }}
          />
          <RF.Field
            component={Layout.Field as React.ComponentType<any>}
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

export default function SignIn() {
  const { search } = useLocation()
  const authenticated = redux.useSelector(selectors.authenticated)
  const mutex = useMutex()
  const { urls } = NamedRoutes.use()

  const ssoEnabled = (provider?: string) => {
    if (!cfg.ssoAuth) return false
    return provider ? cfg.ssoProviders.includes(provider) : !!cfg.ssoProviders.length
  }

  const { next } = parseSearch(search) as { next?: string }

  if (authenticated) {
    return <Redirect to={next || '/'} />
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
