import * as React from 'react'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import { composeComponent } from 'utils/reactTools'
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

const PasswordSignIn = composeComponent(
  'Auth.SignIn.Password',
  Sentry.inject(),
  reduxForm({
    form: 'Auth.SignIn.Password',
    onSubmit: async (values, dispatch, { sentry, mutex }) => {
      if (mutex.current) return
      mutex.claim(MUTEX_ID)
      const result = defer()
      dispatch(actions.signIn(values.toJS(), result.resolver))
      try {
        await result.promise
      } catch (e) {
        if (e instanceof errors.InvalidCredentials) {
          throw new SubmissionError({ _error: 'invalidCredentials' })
        }
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      } finally {
        mutex.release(MUTEX_ID)
      }
    },
  }),
  ({ mutex, handleSubmit, submitting, submitFailed, invalid, error }) => (
    <form onSubmit={handleSubmit}>
      <Field
        component={Layout.Field}
        name="username"
        validate={[validators.required]}
        disabled={!!mutex.current || submitting}
        floatingLabelText="Username or email"
        errors={{
          required: 'Enter your username or email',
        }}
      />
      <Field
        component={Layout.Field}
        name="password"
        type="password"
        validate={[validators.required]}
        disabled={!!mutex.current || submitting}
        floatingLabelText="Password"
        errors={{
          required: 'Enter your password',
        }}
      />
      <Layout.Error
        {...{ submitFailed, error }}
        errors={{
          invalidCredentials: 'Invalid credentials',
          unexpected: 'Something went wrong. Try again later.',
        }}
      />
      <Layout.Actions>
        <Layout.Submit
          label="Sign in"
          disabled={!!mutex.current || submitting || (submitFailed && invalid)}
          busy={submitting}
        />
      </Layout.Actions>
    </form>
  ),
)

export default ({ location: { search } }) => {
  const authenticated = redux.useSelector(selectors.authenticated)
  const cfg = Config.useConfig()
  const mutex = useMutex()
  const { urls } = NamedRoutes.use()

  const ssoEnabled = (provider) => {
    if (!cfg.ssoAuth) return false
    const { ssoProviders = [] } = cfg
    return provider ? ssoProviders.includes(provider) : !!ssoProviders.length
  }

  const { next } = parseSearch(search)

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
